import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Onboarding from './components/Onboarding.jsx'
import Feed from './components/Feed.jsx'
import Discovery from './components/Discovery.jsx'
import KeptPile from './components/KeptPile.jsx'
import Profile from './components/Profile.jsx'
import Comments from './components/Comments.jsx'
import { loadCards, SEED_CARDS } from './lib/cardStore.js'
import { fetchCommentCounts } from './lib/comments.js'
import { onAuthChange, isPermanent, signOut } from './lib/session.js'
import AuthWall from './components/AuthWall.jsx'
import { DEMO_COMMENTS } from './data/demoComments.js'
import { loadState, saveState, resetState, STATE_VERSION } from './lib/storage.js'
import { initialScores, applySwipe, pickNextCard, addInterestBonus } from './lib/scoring.js'
import { haptic } from './lib/haptics.js'
import { track, setPersonProps, resetAnalytics, identifyUser, EV } from './lib/analytics.js'

export default function App() {
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState('feed') // feed | discover | kept | profile
  const [commentsCard, setCommentsCard] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingInterests, setEditingInterests] = useState(false)

  // Card library. Starts as the bundled seed set so the first paint is
  // instant and the feed is never empty, then swaps to the Supabase store
  // once it loads. If the store is unreachable we simply stay on seed —
  // spec R2: the feed must stay responsive when the store isn't.
  const [cards, setCards] = useState(SEED_CARDS)
  const [cardSource, setCardSource] = useState('seed')
  const cardsRef = useRef(SEED_CARDS) // drawNext reads this, never a stale closure
  // Gates the Feed's first deck draw. Without it a returning user — who skips
  // onboarding and lands straight on the feed — builds their whole deck from
  // SEED_CARDS before the real library arrives.
  const [cardsReady, setCardsReady] = useState(false)

  // ── R9: identity + the swipe gate ───────────────────────────
  const FREE_SWIPE_ACTIONS = 7
  const [authUser, setAuthUser] = useState(null)
  const [wallOpen, setWallOpen] = useState(false)
  const signedIn = isPermanent(authUser)

  // Which account we've already reported. onAuthStateChange fires on token
  // refresh and tab focus too, not only on a real sign-in — without this guard
  // a long session would emit signin_completed repeatedly and the gate's
  // conversion rate would climb above 100%.
  const reportedAuthRef = useRef(null)
  const statsRef = useRef({ swipes: 0, kept: 0 })
  statsRef.current = { swipes: state.swipes.length, kept: state.kept.length }

  useEffect(() => {
    // Fires on load with any restored session — including the one Supabase
    // rebuilds from the OAuth redirect — and again on sign-in/sign-out.
    return onAuthChange((user) => {
      setAuthUser(user)
      if (!isPermanent(user)) {
        if (!user) reportedAuthRef.current = null // signed out; report next one
        return
      }

      setWallOpen(false)
      // Stitch the pre-signup visitor onto the account so the gate funnel is
      // one funnel rather than two disconnected people.
      identifyUser(user.id, { auth_provider: user.app_metadata?.provider ?? 'unknown' })
      if (reportedAuthRef.current !== user.id) {
        reportedAuthRef.current = user.id
        // Google is the only provider, and it returns the same identity for a
        // returning user — so "new account" is judged on the account's age,
        // not on which button was pressed.
        const createdMs = Date.now() - new Date(user.created_at).getTime()
        // From the ref, not from state: this callback is registered once, so
        // its closure holds the counts as they were at mount.
        track(createdMs < 60_000 ? EV.SIGNUP_COMPLETED : EV.SIGNIN_COMPLETED, {
          swipe_count: statsRef.current.swipes,
          kept_count: statsRef.current.kept,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The gate opens on the 8th swipe-action; saves count as swipes (R4).
  const gated = !signedIn && state.swipes.length >= FREE_SWIPE_ACTIONS

  const hitGate = useCallback(() => {
    setWallOpen(true)
    track(EV.SIGNUP_GATE_SHOWN, { swipe_count: state.swipes.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.swipes.length])

  useEffect(() => {
    let cancelled = false
    loadCards().then(({ cards: loaded, source, error }) => {
      if (cancelled) return
      cardsRef.current = loaded
      setCards(loaded)
      setCardSource(source)
      setCardsReady(true)
      if (import.meta.env.DEV) {
        console.info(`[cards] ${loaded.length} from ${source}${error ? ` (${error})` : ''}`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards])

  // Refs mirror the fields drawNext() depends on, so the deck always draws
  // against the freshest scores/seen even through async swipe callbacks.
  const scoresRef = useRef(state.topicScores)
  const seenRef = useRef(new Set(state.seen))

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1400)
    return () => clearTimeout(t)
  }, [toast])

  // ── Migration notice (R8): semantics changed under this user's habits ──
  const needsMigrationNotice = state.onboarded && state.stateVersion < STATE_VERSION
  useEffect(() => {
    if (needsMigrationNotice) {
      track(EV.MIGRATION_NOTICE_SHOWN, { from_version: state.stateVersion, to_version: STATE_VERSION })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMigrationNotice])

  function dismissMigrationNotice() {
    haptic.tap()
    track(EV.MIGRATION_NOTICE_DISMISSED, { from_version: state.stateVersion, to_version: STATE_VERSION })
    setState((s) => ({ ...s, stateVersion: STATE_VERSION }))
  }

  // ── Onboarding (first run) ──────────────────────────────────
  function finishOnboarding(interests) {
    const scores = initialScores(interests)
    scoresRef.current = scores
    seenRef.current = new Set()
    setState((s) => ({
      ...s,
      onboarded: true,
      stateVersion: STATE_VERSION, // fresh users start on current semantics — no migration notice
      interests,
      topicScores: scores,
      seen: [],
      kept: [],
      swipes: [],
    }))
    track(EV.ONBOARDING_COMPLETED, { interests, interest_count: interests.length })
    setPersonProps({ interests, interest_count: interests.length })
  }

  // ── Edit interests later (keeps learned scores; only bonuses new picks) ──
  function saveInterests(interests) {
    const added = interests.filter((id) => !state.interests.includes(id))
    const removed = state.interests.filter((id) => !interests.includes(id))
    const nextScores = addInterestBonus(scoresRef.current, added)
    scoresRef.current = nextScores
    setState((s) => ({ ...s, interests, topicScores: nextScores }))
    setEditingInterests(false)
    setToast('Interests updated')
    track(EV.INTERESTS_UPDATED, {
      interests,
      interest_count: interests.length,
      added,
      removed,
      added_count: added.length,
      removed_count: removed.length,
    })
    setPersonProps({ interests, interest_count: interests.length })
  }

  // ── Draw the next weighted, unseen card ─────────────────────
  const drawNext = useCallback((excludeIds = []) => {
    const exclude = new Set([...seenRef.current, ...excludeIds])
    const pool = cardsRef.current.filter((c) => !exclude.has(c.id))
    return pickNextCard(pool, scoresRef.current)
  }, [])

  // ── Record a swipe (interested | pass) — swiping no longer saves ──
  const recordSwipe = useCallback((card, action, method = 'gesture') => {
    const swipeIndex = seenRef.current.size // how many cards deep the user is
    const nextScores = applySwipe(scoresRef.current, card.topic, action)
    scoresRef.current = nextScores
    seenRef.current = new Set(seenRef.current).add(card.id)

    setState((s) => ({
      ...s,
      topicScores: nextScores,
      seen: [...s.seen, card.id],
      swipes: [...s.swipes, { cardId: card.id, action, ts: Date.now() }],
    }))

    track(EV.CARD_SWIPED, {
      card_id: card.id,
      topic: card.topic,
      subtopic: card.subtopic,
      action, // 'interested' | 'pass'
      method, // 'gesture' | 'button'
      swipe_index: swipeIndex,
    })
  }, [])

  // ── Save / unsave a card to the Kept pile (explicit, deliberate) ──
  // Spec R4: free tier caps at 20 saves; a feed save auto-swipes right with
  // +5 (recorded as an 'interested' swipe, method 'save'); a Discover save
  // applies the plain +3 and does not touch the deck. Unsaving frees a cap
  // slot but never retracts scores (signals are historical).
  // Returns 'saved' | 'removed' | 'blocked' so callers (Feed) can react.
  const SAVE_CAP = 20
  const isSaved = (cardId) => state.kept.includes(cardId)
  function toggleSave(card, source = 'unknown') {
    const already = state.kept.includes(card.id)

    if (already) {
      setState((s) => ({ ...s, kept: s.kept.filter((id) => id !== card.id) }))
      setToast('Removed from Kept')
      track(EV.CARD_UNSAVED, {
        card_id: card.id,
        topic: card.topic,
        subtopic: card.subtopic,
        source,
        kept_count: state.kept.length - 1,
      })
      return 'removed'
    }

    // Cap check — a blocked save adds nothing, scores nothing, swipes nothing.
    if (state.kept.length >= SAVE_CAP) {
      setToast('Kept pile full — Curio+ is unlimited')
      track(EV.SAVE_LIMIT_REACHED, { kept_count: SAVE_CAP })
      return 'blocked'
    }

    // Score the save: feed saves are the strongest signal (+5); saves from
    // other surfaces apply the plain interested delta (+3).
    const action = source === 'feed' ? 'save' : 'interested'
    const nextScores = applySwipe(scoresRef.current, card.topic, action)
    scoresRef.current = nextScores

    const newCount = state.kept.length + 1
    if (source === 'feed') {
      // Feed save auto-swipes right: record it as a swipe too, and mark seen.
      seenRef.current = new Set(seenRef.current).add(card.id)
      setState((s) => ({
        ...s,
        kept: [card.id, ...s.kept],
        topicScores: nextScores,
        seen: [...s.seen, card.id],
        swipes: [...s.swipes, { cardId: card.id, action: 'interested', ts: Date.now() }],
      }))
      track(EV.CARD_SWIPED, {
        card_id: card.id,
        topic: card.topic,
        subtopic: card.subtopic,
        action: 'interested',
        method: 'save',
        swipe_index: seenRef.current.size - 1,
      })
    } else {
      setState((s) => ({
        ...s,
        kept: [card.id, ...s.kept],
        topicScores: nextScores,
      }))
    }

    setToast(newCount >= 15 ? `Saved ♥ · ${newCount}/${SAVE_CAP}` : 'Saved ♥')
    track(EV.CARD_SAVED, {
      card_id: card.id,
      topic: card.topic,
      subtopic: card.subtopic,
      source,
      kept_count: newCount,
    })
    return 'saved'
  }

  // ── Replay (keep learned taste, reshuffle the deck) ─────────
  function replay() {
    track(EV.FEED_REPLAYED, { swipes_so_far: state.swipes.length })
    seenRef.current = new Set()
    setState((s) => ({ ...s, seen: [] }))
  }

  function hardReset() {
    track(EV.PROTOTYPE_RESET, {
      swipes: state.swipes.length,
      kept: state.kept.length,
    })
    resetState()
    const fresh = loadState()
    scoresRef.current = fresh.topicScores
    seenRef.current = new Set()
    setState(fresh)
    setTab('feed')
    resetAnalytics()
  }

  // ── Comments ────────────────────────────────────────────────
  //
  // Comments live in Supabase now, so this is only the salvage path: it keeps
  // a comment on the device when the post failed, so the user doesn't lose
  // what they wrote. COMMENT_POSTED is fired by Comments.jsx on the success
  // path — firing it here would have counted every failure as a post.
  function stashCommentLocally({ text, parentId }) {
    const cardId = commentsCard.id
    const entry = { id: `u${Date.now()}`, text, parentId: parentId ?? null, ts: Date.now() }
    setState((s) => ({
      ...s,
      comments: { ...s.comments, [cardId]: [...(s.comments[cardId] || []), entry] },
    }))
  }

  // Server counts for the card face, refreshed when the sheet closes so a new
  // comment updates the number behind it.
  const [commentCounts, setCommentCounts] = useState({})
  const refreshCommentCounts = useCallback(() => {
    fetchCommentCounts().then(setCommentCounts)
  }, [])
  useEffect(() => {
    refreshCommentCounts()
  }, [refreshCommentCounts])

  const commentCountFor = useCallback(
    (cardId) =>
      // Server count when we have one; the local tally is the offline answer.
      commentCounts[cardId] ??
      (DEMO_COMMENTS[cardId]?.length || 0) + (state.comments[cardId]?.length || 0),
    [commentCounts, state.comments]
  )

  // Cards saved before the Supabase migration reference the old seed IDs and
  // will not resolve against UUID-keyed rows; filter(Boolean) drops them
  // rather than rendering holes. See the migration note in CLAUDE.md.
  const keptCards = useMemo(
    () => state.kept.map((id) => cardById[id]).filter(Boolean),
    [state.kept, cardById]
  )

  if (!state.onboarded) {
    return (
      <div className="app">
        <Onboarding onDone={finishOnboarding} />
      </div>
    )
  }

  if (editingInterests) {
    return (
      <div className="app">
        <Onboarding
          mode="edit"
          initialSelected={state.interests}
          onDone={saveInterests}
          onCancel={() => setEditingInterests(false)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          Curio<span className="dot">.</span>
        </div>
        <div className="sub">
          {tab === 'feed' && 'Swipe to tune your feed'}
          {tab === 'discover' && 'Browse any topic'}
          {tab === 'kept' && 'Your saved cards'}
          {tab === 'profile' && 'Your Curio'}
        </div>
      </header>

      <main className="screen">
        {tab === 'feed' && (
          <Feed
            drawNext={drawNext}
            onSwipe={recordSwipe}
            onReplay={replay}
            scores={state.topicScores}
            swipeCount={state.swipes.length}
            onOpenComments={setCommentsCard}
            commentCountFor={commentCountFor}
            onToggleSave={(card) => toggleSave(card, 'feed')}
            isSaved={isSaved}
            cardsReady={cardsReady}
            gated={gated}
            onGateHit={hitGate}
          />
        )}
        {tab === 'discover' && (
          <Discovery
            cards={cards}
            onOpenComments={setCommentsCard}
            commentCountFor={commentCountFor}
            onToggleSave={(card) => toggleSave(card, 'discovery')}
            isSaved={isSaved}
          />
        )}
        {tab === 'kept' && (
          <KeptPile
            keptCards={keptCards}
            onOpenComments={setCommentsCard}
            commentCountFor={commentCountFor}
            onToggleSave={(card) => toggleSave(card, 'kept')}
          />
        )}
        {tab === 'profile' && (
          <Profile
            state={state}
            authUser={authUser}
            signedIn={signedIn}
            onSignIn={() => setWallOpen(true)}
            onSignOut={async () => {
              await signOut()
              setAuthUser(null)
              resetAnalytics() // don't attribute the next person to this account
            }}
            onReset={hardReset}
            onEditInterests={() => {
              haptic.tap()
              track(EV.INTERESTS_EDIT_STARTED, { interest_count: state.interests.length })
              setEditingInterests(true)
            }}
            onUpgradeAttempt={() => {
              haptic.error()
              track(EV.PAYWALL_CLICKED, {
                swipes: state.swipes.length,
                kept: state.kept.length,
              })
              setToast('Curio+ is a prototype — no payment taken')
            }}
          />
        )}
      </main>

      <nav className="bottomnav">
        {[
          { id: 'feed', ic: '🗂️', label: 'Feed' },
          { id: 'discover', ic: '🔍', label: 'Discover' },
          { id: 'kept', ic: '📌', label: 'Kept', badge: keptCards.length },
          { id: 'profile', ic: '👤', label: 'You' },
        ].map((item) => (
          <button
            key={item.id}
            className={`navitem ${tab === item.id ? 'on' : ''}`}
            onClick={() => {
              haptic.nav()
              if (item.id !== tab) track(EV.TAB_CHANGED, { from: tab, to: item.id })
              setTab(item.id)
            }}
          >
            <span className="ic">{item.ic}</span>
            {item.badge ? <span className="badge">{item.badge}</span> : null}
            {item.label}
          </button>
        ))}
      </nav>

      {wallOpen && (
        <AuthWall
          swipeCount={state.swipes.length}
          keptCount={state.kept.length}
          onDismiss={() => setWallOpen(false)}
        />
      )}

      {commentsCard && (
        <Comments
          card={commentsCard}
          userComments={state.comments[commentsCard.id]}
          onAdd={stashCommentLocally}
          onClose={() => {
            setCommentsCard(null)
            refreshCommentCounts()
          }}
        />
      )}

      {/* R8: one-time semantics-change notice for returning users. Dims but
          never hides the content underneath; explicit dismiss only. */}
      {needsMigrationNotice && (
        <div className="migration-backdrop">
          <div className="migration-notice">
            <div className="mn-kicker">What changed</div>
            <h3>Swipes work differently now</h3>
            <p>
              Right swipe = <b>Interested</b> — it tunes your feed but{' '}
              <b>doesn&apos;t save</b> anymore. Tap <b>🔖 Save</b> to keep a card
              — it saves <em>and</em> moves to the next one.
            </p>
            <p className="mn-fine">Your kept cards and tuned feed are untouched.</p>
            <button className="btn-primary" onClick={dismissMigrationNotice}>
              Got it
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

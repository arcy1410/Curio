import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Onboarding from './components/Onboarding.jsx'
import Feed from './components/Feed.jsx'
import Discovery from './components/Discovery.jsx'
import KeptPile from './components/KeptPile.jsx'
import Profile from './components/Profile.jsx'
import Comments from './components/Comments.jsx'
import { CARDS } from './data/cards.js'
import { DEMO_COMMENTS } from './data/demoComments.js'
import { loadState, saveState, resetState } from './lib/storage.js'
import { initialScores, applySwipe, pickNextCard, addInterestBonus } from './lib/scoring.js'
import { haptic } from './lib/haptics.js'
import { track, setPersonProps, resetAnalytics, EV } from './lib/analytics.js'

const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]))

export default function App() {
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState('feed') // feed | discover | kept | profile
  const [commentsCard, setCommentsCard] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingInterests, setEditingInterests] = useState(false)

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

  // ── Onboarding (first run) ──────────────────────────────────
  function finishOnboarding(interests) {
    const scores = initialScores(interests)
    scoresRef.current = scores
    seenRef.current = new Set()
    setState((s) => ({
      ...s,
      onboarded: true,
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
    const pool = CARDS.filter((c) => !exclude.has(c.id))
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
  const isSaved = (cardId) => state.kept.includes(cardId)
  function toggleSave(card, source = 'unknown') {
    const already = state.kept.includes(card.id)
    setState((s) => ({
      ...s,
      kept: already ? s.kept.filter((id) => id !== card.id) : [card.id, ...s.kept],
    }))
    setToast(already ? 'Removed from Kept' : 'Saved ♥')

    track(already ? EV.CARD_UNSAVED : EV.CARD_SAVED, {
      card_id: card.id,
      topic: card.topic,
      subtopic: card.subtopic,
      source, // 'feed' | 'discovery' | 'kept'
      kept_count: already ? state.kept.length - 1 : state.kept.length + 1,
    })
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
  function addComment({ text, parentId }) {
    const cardId = commentsCard.id
    const entry = { id: `u${Date.now()}`, text, parentId: parentId ?? null, ts: Date.now() }
    setState((s) => ({
      ...s,
      comments: { ...s.comments, [cardId]: [...(s.comments[cardId] || []), entry] },
    }))
    // Never send the comment text itself — only structural facts.
    track(EV.COMMENT_POSTED, {
      card_id: cardId,
      topic: commentsCard.topic,
      is_reply: Boolean(parentId),
      length_bucket: text.length < 40 ? 'short' : text.length < 140 ? 'medium' : 'long',
    })
  }

  const commentCountFor = useCallback(
    (cardId) => (DEMO_COMMENTS[cardId]?.length || 0) + (state.comments[cardId]?.length || 0),
    [state.comments]
  )

  const keptCards = useMemo(
    () => state.kept.map((id) => CARD_BY_ID[id]).filter(Boolean),
    [state.kept]
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
          />
        )}
        {tab === 'discover' && (
          <Discovery
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

      {commentsCard && (
        <Comments
          card={commentsCard}
          userComments={state.comments[commentsCard.id]}
          onAdd={addComment}
          onClose={() => setCommentsCard(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

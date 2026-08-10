import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Onboarding from './components/Onboarding.jsx'
import Feed from './components/Feed.jsx'
import Discovery from './components/Discovery.jsx'
import KeptPile from './components/KeptPile.jsx'
import Profile from './components/Profile.jsx'
import Comments from './components/Comments.jsx'
import { loadCards, SEED_CARDS } from './lib/cardStore.js'
import { fetchCommentCounts } from './lib/comments.js'
import {
  onAuthChange,
  isPermanent,
  signOut,
  ensureDisplayName,
  consumeAuthError,
  isAlreadyLinkedError,
  signInDirect,
} from './lib/session.js'
import {
  syncSwipe,
  syncSave,
  syncScores,
  syncInterests,
  hydrate,
  mergeState,
  pushLocalToServer,
} from './lib/userData.js'
import AuthWall from './components/AuthWall.jsx'
import CardDetail from './components/CardDetail.jsx'
import { DEMO_COMMENTS } from './data/demoComments.js'
import { loadState, saveState, resetState, STATE_VERSION } from './lib/storage.js'
import {
  initialScores,
  applySwipe,
  applyTopSignal,
  pickNextCard,
  addInterestBonus,
  topicDistribution,
} from './lib/scoring.js'
import { generateOneCard } from './lib/refill.js'
import QuizMode from './components/QuizMode.jsx'
import { haptic } from './lib/haptics.js'
import { storedTheme, setTheme } from './lib/theme.js'
import { markReviewed } from './lib/review.js'
import {
  GOALS,
  currentStreak,
  longestStreak,
  lastSevenDays,
  recordCardDone,
  todayState,
} from './lib/streak.js'
import { track, setPersonProps, resetAnalytics, identifyUser, EV } from './lib/analytics.js'

export default function App() {
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState('feed') // feed | discover | kept | profile
  const [commentsCard, setCommentsCard] = useState(null)
  const [detailCard, setDetailCard] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingInterests, setEditingInterests] = useState(false)
  const [theme, setThemeState] = useState(storedTheme)

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
  //
  // Three, not the spec's original seven. The redesign introduced a daily set
  // (default 5 cards), and a gate at 7 could never fire on day one — a user
  // finishes their set and never meets it, so the account they need to keep
  // their history is never offered. The gate has to sit INSIDE the first set
  // or it does not exist.
  //
  // Three is also where the pitch is honest: by the third card the feed has
  // visibly started tuning, so "keep what you've built" refers to something
  // the user can actually see.
  const FREE_SWIPE_ACTIONS = 3
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
  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Pull this account's history down and fold it into local state.
   *
   * Runs whenever a signed-in session appears — including on a fresh device,
   * which is the entire point: without this, signing in on a second phone
   * restores nothing and G4's cross-device promise is empty.
   *
   * hydrate() returns null when the server has nothing, so a new account can
   * never blank a device that already has history.
   */
  const restoreFromServer = useCallback((mergeUpAfter = false) => {
    hydrate().then((server) => {
      if (!server) {
        // Nothing on the server for this account. If we just signed in, this
        // is a first sign-in on a fresh account — local state is all there is,
        // so push it up rather than leaving the account empty.
        if (mergeUpAfter) pushLocalToServer(stateRef.current)
        return
      }
      setState((local) => {
        const merged = mergeState(local, server)
        // The refs feed drawNext(), so they have to move with the state or the
        // deck keeps dealing cards this account already swiped.
        scoresRef.current = merged.topicScores
        seenRef.current = new Set(merged.seen)
        revealedRef.current = new Set(merged.revealed ?? [])
        creditedRef.current = new Set(merged.creditedCards ?? [])
        // Server → local is done; now local → server, so activity from an
        // anonymous session that COULDN'T be linked (a returning user signing
        // in on a second device) lands under the real account instead of being
        // abandoned with the throwaway session.
        if (mergeUpAfter) pushLocalToServer(merged)
        return merged
      })
    })
  }, [])

  // If we just came back from a failed Google round trip, say so. Without
  // this the failure is a silent reload and the user has no idea why they are
  // still signed out.
  useEffect(() => {
    const authError = consumeAuthError()
    if (!authError) return

    // "Identity is already linked to another user" is not a failure the user
    // should have to read, let alone act on — it means they already HAVE an
    // account and we tried to attach their Google to a throwaway one instead.
    // linkIdentity() returns a URL happily and only fails server-side after
    // the round trip, so this is the first moment the app can know. Retry
    // once as a plain sign-in, which lands them in their real account; their
    // local activity merges up afterwards.
    if (isAlreadyLinkedError(authError)) {
      let alreadyRetried = false
      try {
        alreadyRetried = sessionStorage.getItem('curio.link.blocked') === '1'
        sessionStorage.setItem('curio.link.blocked', '1') // don't link again this session
      } catch {
        // storage unavailable — fall through to the visible error
      }
      if (!alreadyRetried) {
        track(EV.SIGNUP_FAILED, { reason: 'already_linked_retrying' })
        setToast('Signing you in…')
        signInDirect()
        return
      }
    }

    setToast(`Sign-in failed: ${authError}`)
    track(EV.SIGNUP_FAILED, { reason: 'callback_error', detail: authError.slice(0, 80) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Fires on load with any restored session — including the one Supabase
    // rebuilds from the OAuth redirect — and again on sign-in/sign-out.
    return onAuthChange((user) => {
      setAuthUser(user)

      // Restore for ANY session, anonymous included. The session is the
      // identity; a name is just attached to it later. Gating this on
      // isPermanent meant an anonymous user who cleared their app state — or
      // whose device dropped it — silently started over while their history
      // sat on the server.
      //
      // On a NEW permanent sign-in we also merge upward — see restoreFromServer.
      const freshSignIn = isPermanent(user) && reportedAuthRef.current !== user?.id
      if (user) restoreFromServer(freshSignIn)

      if (!isPermanent(user)) {
        if (!user) reportedAuthRef.current = null // signed out; report next one
        return
      }

      setWallOpen(false)
      ensureDisplayName(user) // otherwise every commenter reads as "Reader"
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

  // A dismissed wall re-raises on the next swipe-action — which is what AC4
  // specified all along. The shipped version "respected" the dismissal by
  // downgrading to a toast pointing at the You tab, and the first real tester
  // to hit it (Yashvi, 8 Aug) experienced that as a dead end: "it should be an
  // actionable pop up". She's right about the intent model too — dismissing
  // says "not now", but *swiping again* is the user asking to continue, and
  // answering that with a passive toast refuses the very intent the gate
  // exists to capture. The wall stays dismissable, so this never loops.
  const wallDismissedRef = useRef(false)
  const hitGate = useCallback((source = 'swipe') => {
    setWallOpen(true)
    track(EV.SIGNUP_GATE_SHOWN, {
      swipe_count: statsRef.current.swipes,
      reopened: wallDismissedRef.current,
      source,
    })
  }, [])

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
  // Score budgets live in refs so they can be checked and spent synchronously,
  // before any re-render or repeated updater invocation can double-count.
  const revealedRef = useRef(new Set(state.revealed ?? []))
  const creditedRef = useRef(new Set(state.creditedCards ?? []))

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (!toast) return
    // Errors need long enough to actually read; confirmations don't.
    const isError = /failed|couldn|error/i.test(toast)
    const t = setTimeout(() => setToast(null), isError ? 8000 : 1400)
    return () => clearTimeout(t)
  }, [toast])

  // ── R8 state version ────────────────────────────────────────
  //
  // The blocking "what changed" modal is gone. It existed because a gesture's
  // MEANING changed invisibly — right-swipe stopped saving — and an invisible
  // change to a habit is the one case that earns an interruption.
  //
  // The redesign removed that condition: the controls are now labelled in
  // words (Later · Like · Keep), so a returning user reads what each one does
  // instead of discovering it. A modal explaining labelled buttons is friction
  // with nothing to justify it, and it greeted every existing user on open.
  //
  // The versioning itself stays — it costs nothing and the next semantic
  // change may genuinely need it. It just migrates silently now.
  useEffect(() => {
    if (state.onboarded && state.stateVersion < STATE_VERSION) {
      track(EV.MIGRATION_NOTICE_SHOWN, {
        from_version: state.stateVersion,
        to_version: STATE_VERSION,
        surface: 'silent',
      })
      setState((s) => ({ ...s, stateVersion: STATE_VERSION }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Onboarding (first run) ──────────────────────────────────
  function finishOnboarding(interests, dailyGoal = 1) {
    const scores = initialScores(interests)
    scoresRef.current = scores
    seenRef.current = new Set()
    setState((s) => ({
      ...s,
      onboarded: true,
      stateVersion: STATE_VERSION, // fresh users start on current semantics — no migration notice
      interests,
      dailyGoal,
      topicScores: scores,
      seen: [],
      kept: [],
      swipes: [],
    }))
    track(EV.ONBOARDING_COMPLETED, {
      interests,
      interest_count: interests.length,
      goal_cards: GOALS[dailyGoal]?.cards,
    })
    setPersonProps({ interests, interest_count: interests.length })
    syncInterests(interests)
    syncScores(scores)
  }

  // ── Edit interests later (keeps learned scores; only bonuses new picks) ──
  function saveInterests(interests) {
    const added = interests.filter((id) => !state.interests.includes(id))
    const removed = state.interests.filter((id) => !interests.includes(id))
    const nextScores = addInterestBonus(scoresRef.current, added)
    scoresRef.current = nextScores
    injectRef.current = [...injectRef.current, ...added]
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
    syncInterests(interests)
    syncScores(nextScores)
  }

  // R7 guaranteed visibility: topics queued here get the NEXT draw, ahead of
  // the weighted lottery. Parity alone is only probabilistic — a user who adds
  // a topic and then sees three cards of something else has no evidence their
  // edit did anything, which is the exact complaint R7 exists to fix.
  //
  // Deliberately not persisted: the score parity survives a reload and does
  // the long-run work; this only smooths the moment right after the edit.
  const injectRef = useRef([])

  // ── Draw the next weighted, unseen card ─────────────────────
  const drawNext = useCallback((excludeIds = []) => {
    const exclude = new Set([...seenRef.current, ...excludeIds])
    const pool = cardsRef.current.filter((c) => !exclude.has(c.id))

    // One injected card per added topic, then normal weighted draw resumes.
    while (injectRef.current.length) {
      const topic = injectRef.current.shift()
      const candidates = pool.filter((c) => c.topic === topic)
      // Nothing unseen left in that topic — drop it rather than blocking the
      // queue on a promise the library cannot keep.
      if (candidates.length) return pickNextCard(candidates, scoresRef.current)
    }

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

    // Write through to the server. Not awaited — R2: a swipe never waits on
    // the network, and by here the card has already left the screen.
    syncSwipe({ cardId: card.id, action, surface: 'feed' })
    syncScores(nextScores)
    countTowardToday()
  }, [])

  // ── Daily set + streak ──────────────────────────────────────
  //
  // Progress is a per-day count; the streak is DERIVED from it (see
  // streak.js) rather than stored, so there is no counter to drift or inflate.
  // Deliberately: finishing the set is where the set ends — nothing rewards
  // exceeding it, and no prompt asks for one more.
  const countTowardToday = useCallback(() => {
    setState((s) => {
      const progress = recordCardDone(s.progress)
      const before = todayState(s.progress, s.dailyGoal)
      const after = todayState(progress, s.dailyGoal)
      if (!before.complete && after.complete) {
        setToast(`Set complete — ${after.need} cards`)
        track(EV.DAILY_SET_COMPLETED, {
          goal_cards: after.need,
          streak_days: currentStreak(progress, s.dailyGoal),
        })
      }
      return { ...s, progress }
    })
  }, [])

  const streak = currentStreak(state.progress, state.dailyGoal)
  const today = todayState(state.progress, state.dailyGoal)

  // ── Locked Curio+ controls (R6 nested reply, R3 swipe undo) ──
  //
  // These are visible and tappable but never do the thing. That is the point:
  // a lock the user can see before they need it is a legible boundary, where
  // one that appears only at the moment of need reads as a trap (NG3).
  //
  // `feature` is what makes the paywall measurable — without it every locked
  // control collapses into one undifferentiated paywall_clicked count and we
  // cannot tell which lock actually drives intent.
  const lockedFeature = useCallback((feature, message) => {
    haptic.error()
    track(EV.PAYWALL_CLICKED, {
      feature,
      swipes: statsRef.current.swipes,
      kept: statsRef.current.kept,
    })
    setToast(message)
  }, [])

  // ── Quiz reveal: the smallest real signal (+1) ──────────────
  //
  // Tapping Reveal means the guess was attempted, which is a genuine — if
  // slight — statement of interest, and it is the mechanic the whole card
  // treatment exists for. Once per card: re-revealing after a re-render must
  // not farm score.
  const recordReveal = useCallback((card) => {
    // Guarded OUTSIDE the updater. React may invoke a state updater more than
    // once (StrictMode does so deliberately), and this one is not pure — it
    // advances scoresRef and fires a network write. Deciding inside it scored
    // the same card twice. Refs are checked and advanced synchronously here;
    // the updater below only merges.
    if (revealedRef.current.has(card.id)) return
    revealedRef.current.add(card.id)

    const nextScores = applySwipe(scoresRef.current, card.topic, 'reveal')
    scoresRef.current = nextScores
    syncScores(nextScores)
    setState((s) => ({
      ...s,
      revealed: [...new Set([...(s.revealed ?? []), card.id])],
      topicScores: nextScores,
    }))
  }, [])

  // ── Deep read: 15s in the detail sheet scores like a Keep ───
  //
  // Routed through applyTopSignal so a card can only ever spend its +5 once —
  // reading deeply AND keeping the same card is one opinion about one topic,
  // not two, and letting it reach +10 would let a single card outweigh two
  // genuine saves.
  const recordDeepRead = useCallback((card, ms) => {
    // Same rule as recordReveal: the +5 budget is spent against a ref, not
    // against state read inside an updater. This is what stopped a deep read
    // and a Keep on one card from summing to +10.
    if (creditedRef.current.has(card.id)) return
    creditedRef.current.add(card.id)

    const nextScores = applySwipe(scoresRef.current, card.topic, 'deep_read')
    scoresRef.current = nextScores
    syncScores(nextScores)
    track(EV.CARD_DEEP_READ, { card_id: card.id, topic: card.topic, dwell_ms: ms })
    setState((s) => ({
      ...s,
      topicScores: nextScores,
      creditedCards: [...new Set([...(s.creditedCards ?? []), card.id])],
    }))
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

    // R9: a save is a swipe-action, so the gate applies HERE, not just in the
    // feed. Checking only in Feed.saveTop left every other surface open —
    // the first tester to hit the wall (Krittika, 10 Aug) found that the
    // detail sheet's Keep buttons still worked while gated. One choke point
    // now: any NEW save while gated raises the wall instead. Unsaving stays
    // allowed — removing something you built is not the action being gated.
    if (!already && gated) {
      hitGate(`save_${source}`)
      return 'blocked'
    }

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
      syncSave({ cardId: card.id, saved: false })
      return 'removed'
    }

    // Cap check — a blocked save adds nothing, scores nothing, swipes nothing.
    if (state.kept.length >= SAVE_CAP) {
      setToast('Kept pile full — Curio+ is unlimited')
      track(EV.SAVE_LIMIT_REACHED, { kept_count: SAVE_CAP })
      return 'blocked'
    }

    // Score the save. A feed save is the strongest signal (+5) but shares one
    // budget with a deep read of the same card — applyTopSignal refuses a
    // second +5 for a card that already spent it. Saves from other surfaces
    // apply the plain interested delta (+3) and are not capped.
    // A deliberate Keep — from the feed or from the detail sheet — spends the
    // card's single +5, the same budget a 15s deep read spends. So reading
    // deeply AND keeping the same card totals +5, not +10 and not +8: one card
    // is one opinion about one topic.
    //
    // 'detail' belongs in this branch, not with Discover's +3. It is the same
    // deliberate keep, just pressed from the sheet — routing it elsewhere let
    // a deep read plus a sheet Keep reach +8 and quietly bypass the cap.
    let nextScores
    if (source === 'feed' || source === 'detail') {
      if (creditedRef.current.has(card.id)) {
        nextScores = scoresRef.current // already spent by a deep read
      } else {
        creditedRef.current.add(card.id)
        nextScores = applySwipe(scoresRef.current, card.topic, 'save')
      }
    } else {
      nextScores = applySwipe(scoresRef.current, card.topic, 'interested')
    }
    const nextCredited = [...creditedRef.current]
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
        creditedCards: nextCredited,
        // savedAt starts the decay clock (review.js) — without it every kept
        // card looks equally fresh forever and "retained" is unmeasurable.
        reviewMeta: { ...s.reviewMeta, [card.id]: { savedAt: Date.now(), reviewCount: 0 } },
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
        reviewMeta: { ...s.reviewMeta, [card.id]: { savedAt: Date.now(), reviewCount: 0 } },
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

    syncSave({ cardId: card.id, saved: true })
    syncScores(nextScores)
    if (source === 'feed') countTowardToday() // a feed save IS a swipe-action (R4)
    // A feed save auto-swipes right (R4), so it is a swipe row too — without
    // this the Kept pile and the swipe history would disagree about the card.
    if (source === 'feed') syncSwipe({ cardId: card.id, action: 'interested', surface: 'feed' })
    return 'saved'
  }

  // ── Exhaustion refill: write fresh cards while the user detours ──
  //
  // When the deck runs dry, App asks /api/refill for one card at a time, ten
  // times. One request per card is the whole progress mechanism — the chip's
  // "writing 3/10" is just the loop counter, no run table to poll — and it
  // means closing the tab stops the spend mid-batch.
  //
  // The batch is buffered and released whole. Cards trickling into the deck
  // one at a time would yank the empty state — and the quiz/explore options
  // on it — out from under the user twenty seconds after they read it. One
  // release, one notification, and the deck deals back in when they return.
  const REFILL_BATCH = 10
  const [gen, setGen] = useState(null) // null | {status:'running',done,total} | {status:'done',delivered} | {status:'error'}
  const genRunningRef = useRef(false)

  // Personalized: each slot samples a topic from the same distribution the
  // deck draws with, so ten new cards lean the way the user's tuning leans.
  const sampleTopic = useCallback(() => {
    const dist = topicDistribution(scoresRef.current)
    let r = Math.random()
    for (const [id, p] of Object.entries(dist)) {
      r -= p
      if (r <= 0) return id
    }
    return Object.keys(dist)[0]
  }, [])

  const startRefill = useCallback(() => {
    if (genRunningRef.current) return
    // Seed mode means no Supabase behind us — nowhere to write, nothing to
    // read back. The empty state still offers quiz/explore, just no promise.
    if (cardSource !== 'supabase') return
    genRunningRef.current = true

    const total = REFILL_BATCH
    const t0 = Date.now()
    setGen({ status: 'running', done: 0, total })
    track(EV.FEED_REFILL_STARTED, { requested: total })

    ;(async () => {
      const fresh = []
      let failed = 0
      let skipped = 0
      let done = 0
      let next = 0
      // Two workers, not ten and not one. Generation with a reasoning-model
      // verifier runs ~60–90s per card (measured), so a serial batch is ~13
      // minutes — too long for "while you take the quiz". Two in flight
      // halves it without hammering the API's rate limits.
      const worker = async () => {
        while (next < total && failed < 3) {
          next++
          const out = await generateOneCard(sampleTopic())
          if (import.meta.env.DEV) console.debug(`[refill] out=${out.result} ${out.error ?? ''}`)
          if (out.result === 'published' && out.card) {
            fresh.push(out.card)
            failed = 0 // only CONSECUTIVE failures abort
          } else if (out.result === 'error') {
            failed++ // auth gone, rate-limited, or API down — workers drain out
          } else {
            skipped++ // no_source / discarded: normal, move on
          }
          done++
          setGen((g) => (g?.status === 'running' ? { ...g, done } : g))
        }
      }
      await Promise.all([worker(), worker()])

      if (fresh.length) {
        // Release the batch: newest first, same as the store's own ordering.
        cardsRef.current = [...fresh, ...cardsRef.current]
        setCards(cardsRef.current)
        haptic.success()
        setToast(`✨ ${fresh.length} fresh card${fresh.length === 1 ? '' : 's'} in your feed`)
      }
      track(EV.FEED_REFILL_COMPLETED, {
        requested: total,
        delivered: fresh.length,
        skipped,
        failed,
        duration_s: Math.round((Date.now() - t0) / 1000),
      })
      setGen(fresh.length ? { status: 'done', delivered: fresh.length } : { status: 'error' })
      // Chip lingers long enough to be seen from any tab, then clears. The
      // running-guard resets with it so a future exhaustion can refill again.
      setTimeout(() => {
        setGen(null)
        genRunningRef.current = false
      }, 8000)
    })()
  }, [cardSource, sampleTopic])

  // ── Recall quiz over seen cards (offered while the refill runs) ──
  const [quizCards, setQuizCards] = useState(null)
  const quizPool = useMemo(
    () =>
      state.seen
        .map((id) => cardById[id])
        .filter((c) => c?.quiz_question && c?.quiz_answer),
    [state.seen, cardById]
  )
  const startQuiz = useCallback(() => {
    haptic.open()
    // Snapshot: shuffled once at open, capped at 8 — the sheet must not
    // reshuffle under the user on a re-render.
    const picked = [...quizPool].sort(() => Math.random() - 0.5).slice(0, 8)
    setQuizCards(picked)
  }, [quizPool])

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
        {/* Refill progress, visible from every tab — the user is most likely
            in the quiz or Discover while the batch writes. */}
        {gen && (
          <div className={`gen-chip ${gen.status}`} role="status">
            {gen.status === 'running' && (
              <>
                <span className="gen-dot" />
                writing {Math.min(gen.done + 1, gen.total)}/{gen.total}
              </>
            )}
            {gen.status === 'done' && <>✓ {gen.delivered} new cards</>}
            {gen.status === 'error' && <>no new cards yet</>}
          </div>
        )}
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
            onGoDeeper={setDetailCard}
            onReveal={recordReveal}
            commentCountFor={commentCountFor}
            onToggleSave={(card) => toggleSave(card, 'feed')}
            isSaved={isSaved}
            cardsReady={cardsReady}
            today={today}
            streak={streak}
            gated={gated}
            onGateHit={hitGate}
            onLockedUndo={() => lockedFeature('swipe_undo', 'Undo is a Curio+ feature')}
            onExhausted={startRefill}
            genStatus={gen}
            onStartQuiz={startQuiz}
            onExplore={() => {
              haptic.nav()
              track(EV.TAB_CHANGED, { from: 'feed', to: 'discover', source: 'exhausted' })
              setTab('discover')
            }}
            quizAvailable={quizPool.length}
            libraryVersion={cards.length}
            seenVersion={state.seen.length}
          />
        )}
        {tab === 'discover' && (
          <Discovery
            cards={cards}
            alreadySeen={state.seen}
            onOpenComments={setCommentsCard}
            commentCountFor={commentCountFor}
            onToggleSave={(card) => toggleSave(card, 'discovery')}
            isSaved={isSaved}
          />
        )}
        {tab === 'kept' && (
          <KeptPile
            keptCards={keptCards}
            reviewMeta={state.reviewMeta}
            onReview={(cards) => {
              // A review is a re-read, which is the retention signal itself.
              haptic.tap()
              const now = Date.now()
              setState((s) => ({
                ...s,
                reviewMeta: cards.reduce(
                  (acc, c) => ({ ...acc, [c.id]: markReviewed(s.reviewMeta[c.id] ?? {}, now) }),
                  { ...s.reviewMeta }
                ),
              }))
              track(EV.REVIEW_COMPLETED, { card_count: cards.length })
              setToast(`${cards.length} card${cards.length === 1 ? '' : 's'} refreshed`)
            }}
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
            streak={streak}
            longest={longestStreak(state.progress, state.dailyGoal)}
            week={lastSevenDays(state.progress, state.dailyGoal)}
            theme={theme}
            onToggleTheme={() => {
              const next = theme === 'dark' ? 'light' : 'dark'
              setTheme(next)
              setThemeState(next)
            }}
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
          { id: 'feed', label: 'Feed' },
          { id: 'discover', label: 'Wander' },
          { id: 'kept', label: 'Kept', badge: keptCards.length },
          { id: 'profile', label: 'You' },
        ].map((item) => (
          <button
            key={item.id}
            data-tab={item.id}
            className={`navitem ${tab === item.id ? 'on' : ''}`}
            onClick={() => {
              haptic.nav()
              if (item.id !== tab) track(EV.TAB_CHANGED, { from: tab, to: item.id })
              setTab(item.id)
            }}
          >
            <span className="ic" />
            {item.badge ? <span className="badge">{item.badge}</span> : null}
            {item.label}
          </button>
        ))}
      </nav>

      {detailCard && (
        <CardDetail
          card={detailCard}
          isSaved={isSaved(detailCard.id)}
          commentCount={commentCountFor(detailCard.id)}
          onOpenComments={() => setCommentsCard(detailCard)}
          onDeepRead={recordDeepRead}
          onKeep={() => toggleSave(detailCard, 'detail')}
          onClose={() => setDetailCard(null)}
        />
      )}

      {wallOpen && (
        <AuthWall
          swipeCount={state.swipes.length}
          keptCount={state.kept.length}
          onDismiss={() => {
            wallDismissedRef.current = true
            setWallOpen(false)
          }}
        />
      )}

      {quizCards && <QuizMode cards={quizCards} onClose={() => setQuizCards(null)} />}

      {commentsCard && (
        <Comments
          card={commentsCard}
          userComments={state.comments[commentsCard.id]}
          onAdd={stashCommentLocally}
          onLockedReply={() =>
            lockedFeature('nested_reply', 'Deeper threads are Curio+')
          }
          onClose={() => {
            setCommentsCard(null)
            refreshCommentCounts()
          }}
        />
      )}

      {/* R8: one-time semantics-change notice for returning users. Dims but
          never hides the content underneath; explicit dismiss only. */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

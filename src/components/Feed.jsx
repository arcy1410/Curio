import React, { useEffect, useRef, useState } from 'react'
import TinderCard from 'react-tinder-card'
import Card from './Card.jsx'
import TuningMeter from './TuningMeter.jsx'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

const DECK_SIZE = 3
const BURST_EMOJI = ['✨', '💚', '🌟', '⭐', '💫', '🎉']

// Maps swipe direction → our two actions. Up/down are disabled.
// Right = "interested" (tunes the feed up, but does NOT save).
// Left = "pass". Saving to the Kept pile is a separate, explicit button.
function dirToAction(dir) {
  if (dir === 'right') return 'interested'
  if (dir === 'left') return 'pass'
  return null
}

export default function Feed({
  drawNext,
  onSwipe,
  onReplay,
  scores,
  swipeCount,
  onOpenComments,
  commentCountFor,
  onToggleSave,
  isSaved,
  cardsReady = true,
  today = { done: 0, need: 5, complete: false },
  streak = 0,
  gated = false, // R9: swipe-actions blocked until they sign in
  onGateHit = () => {},
  onLockedUndo = () => {},
  onGoDeeper,
  onReveal,
}) {
  const weekdayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long' })
  const [deck, setDeck] = useState([]) // deck[0] = top card
  const [ready, setReady] = useState(false)
  const [burst, setBurst] = useState(null) // { key, parts } emoji burst on save
  const childRefs = useRef({})
  const swiped = useRef(new Set()) // guard against double-recording
  const advanced = useRef(new Set()) // guard against double-advancing the deck
  const methodRef = useRef('gesture') // how the current swipe was initiated
  const viewedRef = useRef(new Set()) // fire card_viewed once per card

  function fireBurst() {
    const parts = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      e: BURST_EMOJI[Math.floor(Math.random() * BURST_EMOJI.length)],
      dx: (Math.random() - 0.5) * 200,
      dy: -70 - Math.random() * 130,
      rot: `${(Math.random() - 0.5) * 90}deg`,
    }))
    setBurst({ key: Date.now(), parts })
    setTimeout(() => setBurst(null), 900)
  }

  function getRef(id) {
    if (!childRefs.current[id]) childRefs.current[id] = React.createRef()
    return childRefs.current[id]
  }

  // Fill the initial deck once the card library has actually loaded.
  //
  // This waits on `cardsReady` for a reason that only shows up for RETURNING
  // users. App seeds its card state with SEED_CARDS so the first paint is
  // never empty, then swaps in the Supabase library when it arrives. A new
  // user spends long enough in onboarding that the swap lands first — but a
  // returning user goes straight to the feed, so drawing on mount built the
  // whole deck out of seed cards. They'd read stale content, and every comment
  // thread would fail, because a seed slug ("bly-lagaan") is not a UUID and
  // the store 400s on it.
  //
  // loadCards() always resolves — it falls back to seed rather than throwing —
  // so this can never hang the feed.
  useEffect(() => {
    if (!cardsReady) return
    swiped.current = new Set()
    advanced.current = new Set()
    const initial = []
    for (let i = 0; i < DECK_SIZE; i++) {
      const c = drawNext(initial.map((x) => x.id))
      if (!c) break
      initial.push(c)
    }
    setDeck(initial)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsReady])

  /**
   * Light or clear a card's swipe stamp by touching the DOM directly.
   *
   * Deliberately not React state: any re-render during a drag breaks
   * react-tinder-card's gesture, and the stamp is pure decoration that the
   * rest of the app never reads.
   */
  function markStamp(cardId, action) {
    const el = document.querySelector(`[data-card="${cardId}"]`)
    if (!el) return
    el.dataset.stamp = action ?? ''
  }

  function handleSwipe(card, dir) {
    const action = dirToAction(dir)
    if (!action) return
    if (swiped.current.has(card.id)) return
    swiped.current.add(card.id)
    markStamp(card.id, null)
    if (action === 'interested') haptic.keep()
    else haptic.pass()
    onSwipe(card, action, methodRef.current)
    methodRef.current = 'gesture' // reset; buttons set it explicitly

    // Advance IMMEDIATELY — not on onCardLeftScreen, and not on a timer.
    //
    // The deck used to move only when react-tinder-card reported the card had
    // left the screen. That callback is unreliable on touch, so the swipe was
    // recorded while the card sprang back with its stamp still showing, and
    // the user had to swipe twice.
    //
    // A 240ms timer fixed that but introduced its own failure: browsers
    // throttle timers in a backgrounded tab, so the deck could stall entirely.
    // Nothing about correctness should wait on either a timer or an animation
    // — one swipe, the card goes.
    advance(card)
  }

  /**
   * Drop a card from the deck and draw its replacement. Idempotent — both the
   * timer above and onCardLeftScreen call it, and whichever arrives first
   * wins. Without the guard the second call would append an extra card.
   */
  function advance(card) {
    if (advanced.current.has(card.id)) return
    advanced.current.add(card.id)
    setDeck((prev) => {
      const remaining = prev.filter((c) => c.id !== card.id)
      const next = drawNext(remaining.map((c) => c.id))
      return next ? [...remaining, next] : remaining
    })
    delete childRefs.current[card.id]
  }

  function handleLeftScreen(card) {
    advance(card)
  }

  // Buttons act on the card directly; the fling is cosmetic.
  //
  // This used to `await ref.current.swipe(dir)` and rely on react-tinder-card
  // to report back. It didn't, reliably — the first tap worked and later ones
  // recorded a swipe while leaving the card sitting there, so the user had to
  // tap twice. Correctness no longer depends on an animation completing:
  // handleSwipe records and schedules the advance, and the fling is fired
  // alongside purely for looks.
  function trigger(action) {
    const top = deck[0]
    if (!top) return
    if (gated) return onGateHit() // R9: block the action, keep the card
    methodRef.current = 'button'
    const dir = action === 'pass' ? 'left' : 'right'

    handleSwipe(top, dir)
    childRefs.current[top.id]?.current?.swipe(dir)?.catch?.(() => {})
  }

  // Explicit save of the current top card. Spec R4: a feed save auto-swipes
  // right — App records the save AND the swipe (+5); we only animate the
  // card away and advance the deck. The swiped-guard prevents the TinderCard
  // onSwipe callback from double-recording it as a plain swipe.
  async function saveTop() {
    const top = deck[0]
    if (!top) return
    if (gated) return onGateHit() // a save is a swipe-action too (R4/R9)
    const result = onToggleSave(top) // 'saved' | 'blocked' | 'removed'
    if (result === 'saved') {
      haptic.success()
      fireBurst()
      swiped.current.add(top.id) // already recorded by App — don't record again
      setDragDir(null)
      // Same rule as trigger(): App already recorded the save, so mark it
      // swiped, advance, and fling purely for looks.
      swiped.current.add(top.id)
      markStamp(top.id, null)
      advance(top)
      childRefs.current[top.id]?.current?.swipe('right')?.catch?.(() => {})
    } else if (result === 'blocked') {
      haptic.error() // cap hit — card stays put, nudge toast is showing
    } else {
      haptic.tap()
    }
  }

  const topId = deck[0]?.id
  const topSaved = topId ? isSaved(topId) : false

  // Fire card_viewed once when a card reaches the top of the deck.
  useEffect(() => {
    const top = deck[0]
    if (!top || viewedRef.current.has(top.id)) return
    viewedRef.current.add(top.id)
    track(EV.CARD_VIEWED, {
      card_id: top.id,
      topic: top.topic,
      subtopic: top.subtopic,
      verified: top.verified,
      position: viewedRef.current.size - 1,
    })
  }, [topId, deck])

  // The user reached the end of the available deck.
  useEffect(() => {
    if (ready && deck.length === 0) {
      track(EV.FEED_EXHAUSTED, { cards_seen: viewedRef.current.size })
    }
  }, [ready, deck.length])

  return (
    // feed-root, not a bare div: .screen is a flex column and this sits
    // between it and .deck-wrap. Without joining the flex chain the deck never
    // gets the leftover height, so the card clipped its own footer.
    <div className="feed-root">
      {/* Today's set. The counter and bar exist to make the set FINISHABLE —
          a feed with no end is the doom-scroll shape this product is
          deliberately not (NG3). */}
      <div className="set-head">
        <div>
          <div className="mono">{weekdayLabel} · Today&apos;s set</div>
          <div className="set-count">
            {Math.min(today.done, today.need)} of {today.need}
          </div>
        </div>
        {streak > 0 && (
          <div className="streak-pill">
            <span className="dot" />
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
        )}
      </div>
      <div className="set-progress">
        <div
          className="fill"
          style={{ width: `${Math.min(100, (today.done / today.need) * 100)}%` }}
        />
      </div>

      <TuningMeter scores={scores} swipeCount={swipeCount} />

      <div className="deck-wrap">
        <div className="deck">
          {ready && deck.length === 0 && (
            <div className="empty">
              <div className="big">🎉</div>
              <h3>You&apos;re all caught up</h3>
              <p>
                You&apos;ve been through every card in this prototype. Start over to swipe
                the deck again — your feed keeps the taste it learned.
              </p>
              <button className="btn-ghost" onClick={onReplay}>
                Swipe again
              </button>
            </div>
          )}

          {/* Render reversed so deck[0] sits on top of the stack. */}
          {[...deck].reverse().map((card) => {
            const isTop = card.id === topId
            const depth = deck.findIndex((c) => c.id === card.id) // 0 = top
            return (
              <TinderCard
                ref={getRef(card.id)}
                className="swipe"
                key={card.id}
                // Gated: the card physically cannot leave the screen, so the
                // user keeps the card they were reading (R9) instead of losing
                // it to a swipe that was never recorded.
                preventSwipe={gated ? ['up', 'down', 'left', 'right'] : ['up', 'down']}
                swipeRequirementType="position"
                swipeThreshold={90}
                onSwipe={(dir) => handleSwipe(card, dir)}
                onCardLeftScreen={() => handleLeftScreen(card)}
                // The stamp is toggled on the DOM node, NOT through state.
                //
                // setDragDir here re-rendered the component in the middle of a
                // live drag, which tore down react-tinder-card's in-flight
                // gesture: the stamp lit up at the threshold and then release
                // never committed, so the card sprang back still asking to be
                // kept and the swipe had to be repeated. Buttons were immune
                // because they never re-render mid-gesture — which is exactly
                // why Like worked and swiping didn't.
                onSwipeRequirementFulfilled={(dir) => {
                  if (!isTop) return
                  if (gated) return onGateHit()
                  markStamp(card.id, dirToAction(dir))
                }}
                onSwipeRequirementUnfulfilled={() => isTop && markStamp(card.id, null)}
              >
                <div
                  data-card={card.id}
                  style={{
                    height: '100%',
                    transform: `scale(${1 - depth * 0.03}) translateY(${depth * 10}px)`,
                    transition: 'transform 0.25s ease',
                  }}
                >
                  <Card
                    card={card}
                    commentCount={commentCountFor(card.id)}
                    onOpenComments={() => onOpenComments(card)}
                    onGoDeeper={() => onGoDeeper?.(card)}
                    onReveal={onReveal}
                  />
                </div>
              </TinderCard>
            )
          })}

          {burst && (
            <div className="burst" key={burst.key}>
              {burst.parts.map((p) => (
                <span key={p.id} style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': p.rot }}>
                  {p.e}
                </span>
              ))}
            </div>
          )}
        </div>

        {deck.length > 0 && (
          <>
            {/* FOUR controls, not the handoff's three.
                The design brief says "Keep, don't like" and merges the two —
                but Curio's spec separates them deliberately (R3/R4), and that
                separation is the product: Like tunes the feed and costs
                nothing, Keep commits a card to a pile capped at 20. Collapsing
                them means every card you found interesting also spends a slot
                you were saving for the ones worth re-reading. */}
            <div className="actions">
              <button
                className="act-circle"
                onClick={() => trigger('pass')}
                aria-label="Later — pass this card"
              >
                Later
              </button>

              <button
                className="act-deeper"
                onClick={() => {
                  haptic.open()
                  onGoDeeper?.(deck[0])
                }}
              >
                Go deeper
              </button>

              <button
                className="act-circle like"
                onClick={() => trigger('interested')}
                aria-label="Interested — more like this"
              >
                Like
              </button>

              <button
                className={`act-circle keep ${topSaved ? 'on' : ''}`}
                onClick={saveTop}
                aria-label={topSaved ? 'Saved to Kept' : 'Keep — save to your pile'}
              >
                {topSaved ? 'Kept' : 'Keep'}
              </button>
            </div>

            <div className="hint-row">
              <span className="action-hint mono">← later · like → · keep saves it</span>
              {/* R3: visible-but-locked, kept out of the primary row so it
                  doesn't compete with the three actions that actually work. */}
              <button
                className="undo-locked mono"
                onClick={onLockedUndo}
                disabled={swipeCount === 0}
                aria-label="Undo last swipe — Curio+"
              >
                🔒 undo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

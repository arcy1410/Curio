import React, { useEffect, useRef, useState } from 'react'
import TinderCard from 'react-tinder-card'
import Card from './Card.jsx'
import TuningMeter from './TuningMeter.jsx'
import { haptic } from '../lib/haptics.js'

const DECK_SIZE = 3
const BURST_EMOJI = ['✨', '💚', '🌟', '⭐', '💫', '🎉']

// Maps swipe direction → our two actions. Up/down are disabled.
function dirToAction(dir) {
  if (dir === 'right') return 'keep'
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
}) {
  const [deck, setDeck] = useState([]) // deck[0] = top card
  const [dragDir, setDragDir] = useState(null) // 'keep' | 'pass' | null (top card only)
  const [ready, setReady] = useState(false)
  const [burst, setBurst] = useState(null) // { key, parts } emoji burst on keep
  const childRefs = useRef({})
  const swiped = useRef(new Set()) // guard against double-recording

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

  // Fill the initial deck once on mount.
  useEffect(() => {
    const initial = []
    for (let i = 0; i < DECK_SIZE; i++) {
      const c = drawNext(initial.map((x) => x.id))
      if (!c) break
      initial.push(c)
    }
    setDeck(initial)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSwipe(card, dir) {
    const action = dirToAction(dir)
    if (!action) return
    if (swiped.current.has(card.id)) return
    swiped.current.add(card.id)
    setDragDir(null)
    if (action === 'keep') {
      haptic.keep()
      fireBurst()
    } else {
      haptic.pass()
    }
    onSwipe(card, action)
  }

  function handleLeftScreen(card) {
    setDeck((prev) => {
      const remaining = prev.filter((c) => c.id !== card.id)
      const next = drawNext(remaining.map((c) => c.id))
      return next ? [...remaining, next] : remaining
    })
    delete childRefs.current[card.id]
  }

  // Buttons trigger a programmatic swipe on the top card.
  async function trigger(action) {
    const top = deck[0]
    if (!top) return
    haptic.tap()
    const ref = childRefs.current[top.id]
    const dir = action === 'keep' ? 'right' : 'left'
    if (ref?.current) {
      try {
        await ref.current.swipe(dir)
      } catch {
        // if the animation ref isn't ready, fall back to direct handling
        handleSwipe(top, dir)
        handleLeftScreen(top)
      }
    }
  }

  const topId = deck[0]?.id

  return (
    <div>
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
                preventSwipe={['up', 'down']}
                swipeRequirementType="position"
                swipeThreshold={90}
                onSwipe={(dir) => handleSwipe(card, dir)}
                onCardLeftScreen={() => handleLeftScreen(card)}
                onSwipeRequirementFulfilled={(dir) => isTop && setDragDir(dirToAction(dir))}
                onSwipeRequirementUnfulfilled={() => isTop && setDragDir(null)}
              >
                <div
                  style={{
                    height: '100%',
                    transform: `scale(${1 - depth * 0.03}) translateY(${depth * 10}px)`,
                    transition: 'transform 0.25s ease',
                  }}
                >
                  <Card
                    card={card}
                    swipeDir={isTop ? dragDir : null}
                    commentCount={commentCountFor(card.id)}
                    onOpenComments={() => onOpenComments(card)}
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
            <div className="actions">
              <button className="round pass" onClick={() => trigger('pass')} aria-label="Pass">
                ✕
              </button>
              <button
                className="round small"
                onClick={() => {
                  haptic.open()
                  onOpenComments(deck[0])
                }}
                aria-label="Comments"
              >
                💬
              </button>
              <button className="round keep" onClick={() => trigger('keep')} aria-label="Keep">
                ♥
              </button>
            </div>
            <div className="action-hint">← Pass · Keep → &nbsp;·&nbsp; or drag the card</div>
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

/**
 * The first-swipe guide — shown exactly once, on the first feed a person
 * ever sees, and never to anyone with swipe history.
 *
 * This exists because the first real tester to onboard cold (Krittika,
 * 10 Aug) landed on the deck and didn't know what to do. The feed's own
 * affordances are labelled, but they're four controls + a stamp + a daily
 * set meter arriving all at once; one calm screen naming the three moves is
 * cheaper than a confused first minute.
 *
 * Deliberately NOT a tour: no steps, no spotlights, no "next" chain — the
 * app's own R8 lesson is that interruptions have to earn their keep. One
 * card, three rows, dismissable by tapping literally anywhere.
 */
export default function FirstRunGuide({ onDone }) {
  const openedAt = useRef(Date.now())

  useEffect(() => {
    track(EV.GUIDE_SHOWN, {})
  }, [])

  const dismiss = (method) => {
    haptic.tap()
    track(EV.GUIDE_DISMISSED, { method, open_ms: Date.now() - openedAt.current })
    onDone()
  }

  return (
    <div className="guide-backdrop" onClick={() => dismiss('backdrop')}>
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <div className="mono guide-kicker">How Curio works</div>
        <h2>Three moves, that&apos;s it</h2>

        <div className="guide-rows">
          <div className="guide-row">
            <span className="guide-glyph">→</span>
            <div>
              <strong>Like</strong>
              <span>swipe right — more like this</span>
            </div>
          </div>
          <div className="guide-row">
            <span className="guide-glyph">←</span>
            <div>
              <strong>Later</strong>
              <span>swipe left — less of this</span>
            </div>
          </div>
          <div className="guide-row">
            <span className="guide-glyph">🔖</span>
            <div>
              <strong>Keep</strong>
              <span>saves it to your pile to re-read</span>
            </div>
          </div>
        </div>

        <p className="guide-note">
          Every card is fact-checked and cites its source — tap <em>Go deeper</em> to
          see the receipts. Your feed tunes itself to what you like.
        </p>

        <button className="btn-primary guide-cta" onClick={() => dismiss('button')}>
          Got it — deal me in
        </button>
      </div>
    </div>
  )
}

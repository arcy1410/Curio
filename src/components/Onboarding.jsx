import { useEffect, useState } from 'react'
import { TOPICS } from '../data/topics.js'
import { GOALS } from '../lib/streak.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

// The prototype's topic list is small (4), so we require at least 2 rather
// than the design's "pick three or more" — asking for 3 of 4 is not a choice.
const MIN_PICKS = 2

/**
 * Onboarding — three steps on one screen (redesign), or a single-step editor.
 *
 * Step 0 sets expectations with a sample card, 1 collects topics, 2 sets the
 * daily goal. The goal step exists because the streak needs a target the user
 * chose: a goal the product picks for you is a demand, one you pick is a
 * commitment (see streak.js on why that distinction is load-bearing).
 *
 * `mode: 'edit'` reuses only the topic step — editing interests should not
 * re-ask someone their appetite.
 */
export default function Onboarding({
  onDone,
  mode = 'onboard',
  initialSelected = [],
  initialGoal = 1,
  onCancel,
}) {
  const isEdit = mode === 'edit'
  const [step, setStep] = useState(isEdit ? 1 : 0)
  const [picked, setPicked] = useState(() => new Set(initialSelected))
  const [goal, setGoal] = useState(initialGoal)

  // Funnel entry — the denominator for onboarding completion.
  useEffect(() => {
    if (!isEdit) track(EV.ONBOARDING_STARTED)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(id) {
    haptic.select()
    // Track outside the updater — StrictMode double-invokes updaters in dev.
    track(EV.ONBOARDING_TOPIC_TOGGLED, { topic: id, selecting: !picked.has(id), mode })
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const enough = picked.size >= MIN_PICKS
  const canAdvance = step === 0 || (step === 1 ? enough : true)

  function next() {
    haptic.tap()
    if (isEdit || step === 2) {
      onDone([...picked], goal)
      return
    }
    setStep(step + 1)
  }

  function back() {
    haptic.nav()
    if (step === 0 || isEdit) return onCancel?.()
    setStep(step - 1)
  }

  return (
    <div className="onboard">
      {!isEdit && (
        <div className="steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`step-dot ${i === step ? 'on' : ''}`} />
          ))}
        </div>
      )}

      <div className="onboard-body">
        {step === 0 && (
          <>
            {/* A sample card, so the first thing anyone sees is the thing
                itself rather than a description of it. */}
            <div className="sample-card">
              <div className="mono">Card 001 · Cricket</div>
              <div className="sample-q">Which outlaw group adopted cricket in 1700s India?</div>
              <div className="sample-bars">
                <span style={{ background: 'var(--rose)' }} />
                <span style={{ background: 'var(--moss)' }} />
                <span style={{ background: 'var(--accent)' }} />
              </div>
            </div>

            <h1 className="hero">
              Two minutes a day.
              <br />
              <em>Facts that stick.</em>
            </h1>
            <p className="lede">
              Every card is one idea, cited to a real source, and quizzed back to you
              before you forget it.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h1>{isEdit ? 'Edit your interests' : 'What are you curious about?'}</h1>
            <p className="lede">
              {isEdit
                ? 'Add or remove topics. New picks get a head start, and the taste your swipes have already built is kept.'
                : 'Pick two or more. You can change these later.'}
            </p>

            <div className="chip-grid">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  className={`pick-chip ${picked.has(t.id) ? 'on' : ''}`}
                  onClick={() => toggle(t.id)}
                  aria-pressed={picked.has(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <div className="count">
              {picked.size === 0
                ? `Choose at least ${MIN_PICKS}`
                : `${picked.size} selected${enough ? '' : ` · pick ${MIN_PICKS - picked.size} more`}`}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>How big is your appetite?</h1>
            <p className="lede">A streak only counts if you finish the set.</p>

            <div className="goal-list">
              {GOALS.map((g, i) => (
                <button
                  key={g.name}
                  className={`goal-row ${goal === i ? 'on' : ''}`}
                  onClick={() => {
                    haptic.select()
                    setGoal(i)
                  }}
                  aria-pressed={goal === i}
                >
                  <div>
                    <div className="gname">{g.name}</div>
                    <div className="gsub">{g.cards} cards a day</div>
                  </div>
                  <div className="mono">{g.minutes} min</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="onboard-foot">
        {(step > 0 || isEdit) && (
          <button className="btn-back" onClick={back}>
            {isEdit ? 'Cancel' : 'Back'}
          </button>
        )}
        <button className="btn-primary" disabled={!canAdvance} onClick={next}>
          {isEdit
            ? 'Save changes'
            : step === 2
              ? 'Start my first set'
              : step === 1 && !enough
                ? `Pick ${MIN_PICKS - picked.size} more`
                : 'Continue'}
        </button>
      </div>
    </div>
  )
}

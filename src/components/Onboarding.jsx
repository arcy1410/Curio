import { useState } from 'react'
import { TOPICS } from '../data/topics.js'
import { haptic } from '../lib/haptics.js'

// For the prototype the topic list is small (4), so we let users pick any
// number and just require at least 2. The pitch describes 10–15 interests
// across a larger taxonomy; the mechanism is identical.
const MIN_PICKS = 2

// mode: 'onboard' (first run) | 'edit' (reselect interests later).
export default function Onboarding({ onDone, mode = 'onboard', initialSelected = [], onCancel }) {
  const [picked, setPicked] = useState(() => new Set(initialSelected))
  const isEdit = mode === 'edit'

  function toggle(id) {
    haptic.select()
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const enough = picked.size >= MIN_PICKS

  return (
    <div className="onboard">
      {isEdit ? (
        <button
          className="back-link"
          style={{ marginTop: 8 }}
          onClick={() => {
            haptic.nav()
            onCancel?.()
          }}
        >
          ← Cancel
        </button>
      ) : (
        <div className="wordmark" style={{ marginTop: 8 }}>
          Curio<span className="dot">.</span>
        </div>
      )}

      <h1>{isEdit ? 'Edit your interests' : 'What are you curious about?'}</h1>
      <p className="lede">
        {isEdit
          ? 'Add or remove topics. New picks get a head start, and the taste your swipes have already built is kept.'
          : "Pick a few topics to start. Every swipe tunes your feed from here — right to show interest, left to pass."}
      </p>
      <div className="count">
        {picked.size === 0
          ? `Choose at least ${MIN_PICKS}`
          : `${picked.size} selected${enough ? '' : ` · pick ${MIN_PICKS - picked.size} more`}`}
      </div>

      <div className="topic-grid">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            className={`topic-card ${picked.has(t.id) ? 'on' : ''}`}
            style={{ '--topic-c': t.color }}
            onClick={() => toggle(t.id)}
            aria-pressed={picked.has(t.id)}
          >
            <div className="emoji">{t.emoji}</div>
            <div className="tname">{t.name}</div>
            <div className="tblurb">{t.blurb}</div>
            <div className="subs">
              {t.subtopics.map((s) => (
                <span className="chip" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="cta-bar">
        <button
          className="btn-primary"
          disabled={!enough}
          onClick={() => {
            haptic.keep()
            onDone([...picked])
          }}
        >
          {enough
            ? isEdit
              ? 'Save changes'
              : 'Start swiping →'
            : `Pick ${MIN_PICKS - picked.size} more`}
        </button>
      </div>
    </div>
  )
}

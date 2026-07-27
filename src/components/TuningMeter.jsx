import { useState } from 'react'
import { TOPICS } from '../data/topics.js'
import { topicDistribution, topTopic } from '../lib/scoring.js'
import { track, EV } from '../lib/analytics.js'

// The visible personalization signal. After ~10–15 swipes the leading topic
// and the bars should have shifted noticeably — this is the whole point.
export default function TuningMeter({ scores, swipeCount }) {
  const [open, setOpen] = useState(false)
  const dist = topicDistribution(scores)
  const lead = topTopic(scores)
  const leadTopic = TOPICS.find((t) => t.id === lead)

  const sorted = [...TOPICS].sort((a, b) => (dist[b.id] ?? 0) - (dist[a.id] ?? 0))
  const leadColor = leadTopic?.color ?? 'var(--accent)'

  return (
    <div className="tuning">
      {/* One line, and the line IS the toggle. "Your feed is learning…" beside
          "Leaning X" read as a typo — two near-identical words a few pixels
          apart — so the label now names the mechanism and the value names the
          topic, with no echo. Collapsed to a single row because the handoff
          has no panel here and the boxed version was stealing card height. */}
      <button
        className="tuning-line"
        onClick={() => {
          track(EV.TUNING_METER_TOGGLED, { opening: !open, swipe_count: swipeCount, lead_topic: lead })
          setOpen((o) => !o)
        }}
      >
        <span className="mono">
          {swipeCount < 3 ? 'Tuning to your swipes' : 'Your feed right now'}
        </span>
        <span className="lead" style={{ color: leadColor }}>
          {leadTopic ? `Mostly ${leadTopic.name}` : ''}
          <span className="caret">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="bars">
          {sorted.map((t) => (
            <div className="bar" key={t.id}>
              <span className="bname">
                {t.emoji} {t.name}
              </span>
              <span className="track">
                <span
                  className="fill"
                  style={{ width: `${Math.round((dist[t.id] ?? 0) * 100)}%`, '--bar-c': t.color }}
                />
              </span>
              <span className="pct">{Math.round((dist[t.id] ?? 0) * 100)}%</span>
            </div>
          ))}
        </div>
      )}


    </div>
  )
}

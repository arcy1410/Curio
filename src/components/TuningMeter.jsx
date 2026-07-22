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
      <div className="row">
        <span className="label">
          {swipeCount < 3 ? 'Your feed is learning…' : 'Your feed right now'}
        </span>
        <span className="lead" style={{ color: leadColor }}>
          {leadTopic ? `${leadTopic.emoji} Leaning ${leadTopic.name}` : ''}
        </span>
      </div>

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

      <button
        className="expand"
        onClick={() => {
          track(EV.TUNING_METER_TOGGLED, { opening: !open, swipe_count: swipeCount, lead_topic: lead })
          setOpen((o) => !o)
        }}
      >
        {open ? 'Hide the mix' : 'See how your feed is weighted'}
      </button>
    </div>
  )
}

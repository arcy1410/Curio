import { useEffect, useState } from 'react'
import { TOPICS, topicColor, topicEmoji, topicName } from '../data/topics.js'
import { CARDS } from '../data/cards.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

// Discovery — pick any topic and drill into every card in it, filtered by
// sub-topic. Cards can be saved to the Kept pile straight from here.
export default function Discovery({ onOpenComments, commentCountFor, onToggleSave, isSaved }) {
  const [topicId, setTopicId] = useState(null)
  const [sub, setSub] = useState(null)

  useEffect(() => {
    track(EV.DISCOVERY_OPENED)
  }, [])

  // ── Topic chooser ──
  if (!topicId) {
    return (
      <div>
        <div className="kept-head">
          <h1>Discover</h1>
          <p>Pick any topic and dive into every card in it.</p>
        </div>
        <div className="topic-grid" style={{ marginTop: 16 }}>
          {TOPICS.map((t) => {
            const count = CARDS.filter((c) => c.topic === t.id).length
            return (
              <button
                key={t.id}
                className="topic-card"
                style={{ '--topic-c': t.color }}
                onClick={() => {
                  haptic.tap()
                  track(EV.DISCOVERY_TOPIC_SELECTED, { topic: t.id, card_count: count })
                  setTopicId(t.id)
                  setSub(null)
                }}
              >
                <div className="emoji">{t.emoji}</div>
                <div className="tname">{t.name}</div>
                <div className="tblurb">{t.blurb}</div>
                <div className="subs">
                  <span className="chip">
                    {count} card{count === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Inside a topic ──
  const topic = TOPICS.find((t) => t.id === topicId)
  const all = CARDS.filter((c) => c.topic === topicId)
  const shown = sub ? all.filter((c) => c.subtopic === sub) : all

  return (
    <div>
      <button
        className="back-link"
        onClick={() => {
          haptic.nav()
          setTopicId(null)
        }}
      >
        ← All topics
      </button>

      <div className="kept-head" style={{ marginTop: 6 }}>
        <h1 style={{ color: topic.color }}>
          {topic.emoji} {topic.name}
        </h1>
        <p>
          {shown.length} card{shown.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="sub-filter">
        <button
          className={`chip ${!sub ? 'on' : ''}`}
          onClick={() => {
            haptic.tap()
            setSub(null)
          }}
        >
          All
        </button>
        {topic.subtopics.map((s) => (
          <button
            key={s}
            className={`chip ${sub === s ? 'on' : ''}`}
            onClick={() => {
              haptic.tap()
              track(EV.DISCOVERY_SUBTOPIC_FILTERED, { topic: topicId, subtopic: s })
              setSub(s)
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="kept-list discover-list" style={{ marginTop: 14 }}>
        {shown.map((card) => {
          const saved = isSaved(card.id)
          return (
            <div className="kept-item" key={card.id} style={{ '--topic': topicColor(card.topic) }}>
              <div className="tag">
                {topicEmoji(card.topic)} {topicName(card.topic)}
                {card.subtopic ? ` · ${card.subtopic}` : ''}
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <div className="meta">
                <a
                  className="link"
                  href={card.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none', color: 'var(--ink-soft)', fontSize: 12 }}
                >
                  🔗 {hostOf(card.source_url)}
                </a>
                <div style={{ display: 'flex', gap: 14 }}>
                  <button className="comment-trigger" onClick={() => onOpenComments(card)}>
                    💬 {commentCountFor(card.id) || 'Comment'}
                  </button>
                  <button
                    className={`comment-trigger save-inline ${saved ? 'on' : ''}`}
                    onClick={() => onToggleSave(card)}
                  >
                    🔖 {saved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

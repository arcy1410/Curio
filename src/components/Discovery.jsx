import { useEffect, useState } from 'react'
import { TOPICS, topicColor, topicName } from '../data/topics.js'
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
export default function Discovery({
  cards = [],
  onOpenComments,
  commentCountFor,
  onToggleSave,
  isSaved,
  onSearchTap,
}) {
  const CARDS = cards // library comes from App (Supabase-backed, seed fallback)
  const [topicId, setTopicId] = useState(null)
  const [sub, setSub] = useState(null)

  useEffect(() => {
    track(EV.DISCOVERY_OPENED)
  }, [])

  // ── Wander: browse any topic ──
  if (!topicId) {
    return (
      <div>
        <div className="kept-head">
          <h1>Wander</h1>
          <span className="mono">{CARDS.length} cards</span>
        </div>

        {/* A visual mock in the handoff, and honest about it here: tapping it
            says so rather than opening a dead field. Building fake search that
            silently does nothing is worse than admitting it isn't built. */}
        <button
          className="wander-search"
          onClick={() => {
            haptic.tap()
            onSearchTap?.()
          }}
        >
          <span className="glyph" />
          Ask anything — &ldquo;why is the sky blue&rdquo;
        </button>

        <div className="section-head mono">Browse</div>
        <div className="tile-grid">
          {TOPICS.map((t) => {
            const count = CARDS.filter((c) => c.topic === t.id).length
            return (
              <button
                key={t.id}
                className="topic-tile on"
                style={{ '--tile': t.color, '--on-tile': t.onColor }}
                onClick={() => {
                  haptic.tap()
                  track(EV.DISCOVERY_TOPIC_SELECTED, { topic: t.id, card_count: count })
                  setTopicId(t.id)
                  setSub(null)
                }}
              >
                <span className="tname">{t.name}</span>
                <span className="mono tsub">
                  {count} card{count === 1 ? '' : 's'}
                </span>
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
        <h1>{topic.name}</h1>
        <span className="mono">
          {shown.length} card{shown.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="sub-filter">
        <button
          className={`filter-chip ${!sub ? 'on' : ''}`}
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
            className={`filter-chip ${sub === s ? 'on' : ''}`}
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
            <div
              className="kept-item"
              key={card.id}
              style={{ '--topic': topicColor(card.topic) }}
            >
              <div className="kept-meta-row">
                <span className="mono">
                  {topicName(card.topic)}
                  {card.subtopic ? ` · ${card.subtopic}` : ''}
                </span>
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

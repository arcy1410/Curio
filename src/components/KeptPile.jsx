import { useEffect } from 'react'
import { topicName, topicEmoji, topicColor } from '../data/topics.js'
import { track, EV } from '../lib/analytics.js'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

// The saved pile — everything the user explicitly saved, most-recent first.
export default function KeptPile({ keptCards, onOpenComments, commentCountFor, onToggleSave }) {
  useEffect(() => {
    track(EV.KEPT_PILE_VIEWED, { kept_count: keptCards.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="kept-head">
        <h1>Kept</h1>
        <p>
          {keptCards.length === 0
            ? 'Cards you keep will collect here.'
            : `${keptCards.length} card${keptCards.length === 1 ? '' : 's'} saved`}
        </p>
      </div>

      {keptCards.length === 0 ? (
        <div className="empty" style={{ padding: '48px 20px' }}>
          <div className="big">📚</div>
          <h3>Nothing kept yet</h3>
          <p>Tap 🔖 Save on a card to keep it here for later.</p>
        </div>
      ) : (
        <div className="kept-list">
          {keptCards.map((card) => (
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
                  <button className="comment-trigger save-inline on" onClick={() => onToggleSave(card)}>
                    🔖 Saved
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

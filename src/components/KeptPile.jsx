import { useEffect, useState } from 'react'
import { topicName, topicEmoji, topicColor } from '../data/topics.js'
import { track, EV } from '../lib/analytics.js'
import { haptic } from '../lib/haptics.js'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

// The saved pile — everything the user explicitly saved, most-recent first.
// Tapping a card expands it to the full text in place (spec G4: "retained"
// means re-reading, not just checking the list — kept_card_opened is the
// re-engagement signal the North Star depends on).
export default function KeptPile({ keptCards, onOpenComments, commentCountFor, onToggleSave }) {
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    track(EV.KEPT_PILE_VIEWED, { kept_count: keptCards.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleExpand(card) {
    haptic.tap()
    const opening = expandedId !== card.id
    setExpandedId(opening ? card.id : null)
    if (opening) {
      track(EV.KEPT_CARD_OPENED, { card_id: card.id, topic: card.topic })
    }
  }

  return (
    <div>
      <div className="kept-head">
        <h1>Kept</h1>
        <p>
          {keptCards.length === 0
            ? 'Cards you keep will collect here.'
            : `${keptCards.length} card${keptCards.length === 1 ? '' : 's'} saved · tap one to re-read`}
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
          {keptCards.map((card) => {
            const expanded = expandedId === card.id
            return (
              <div
                className={`kept-item ${expanded ? 'expanded' : ''}`}
                key={card.id}
                style={{ '--topic': topicColor(card.topic) }}
              >
                <button className="kept-open" onClick={() => toggleExpand(card)}>
                  <div className="tag">
                    {topicEmoji(card.topic)} {topicName(card.topic)}
                    {card.subtopic ? ` · ${card.subtopic}` : ''}
                  </div>
                  <h3>{card.title}</h3>
                  <p className="kept-body">{card.body}</p>
                  {expanded && card.verified && (
                    <span className="verified" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      ✓ Fact-checked
                    </span>
                  )}
                </button>
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
            )
          })}
        </div>
      )}
    </div>
  )
}

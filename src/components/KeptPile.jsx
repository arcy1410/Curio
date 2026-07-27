import { useEffect, useMemo, useState } from 'react'
import { topicName, topicColor } from '../data/topics.js'
import { strengthOf, dueLabel, dueCards, STRENGTH } from '../lib/review.js'
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
export default function KeptPile({
  keptCards,
  onOpenComments,
  commentCountFor,
  onToggleSave,
  reviewMeta = {},
  onReview,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')

  // Attach review state. A card the user saved but never revisited is not
  // "retained" — decay is what makes the second half of the North Star
  // ("kept AND retained") observable rather than assumed.
  const withState = useMemo(
    () =>
      keptCards.map((c) => {
        const meta = { savedAt: c.savedAt, ...(reviewMeta[c.id] ?? {}) }
        return { ...c, meta, strength: strengthOf(meta), due: dueLabel(meta) }
      }),
    [keptCards, reviewMeta]
  )

  const fading = withState.filter((c) => c.strength === STRENGTH.FADING)
  const shown =
    filter === 'all'
      ? withState
      : filter === 'due'
        ? fading
        : withState.filter((c) => c.strength === STRENGTH.SOLID)

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
        <span className="mono">{keptCards.length} cards</span>
      </div>

      {keptCards.length > 0 && (
        <div className="filter-row">
          {[
            { id: 'all', label: 'All' },
            { id: 'due', label: 'Due to review' },
            { id: 'solid', label: 'Solid' },
          ].map((f) => (
            <button
              key={f.id}
              className={`filter-chip ${filter === f.id ? 'on' : ''}`}
              onClick={() => {
                haptic.tap()
                setFilter(f.id)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Surfaces the only state that asks for action. Phrased as an
          invitation with a real time cost, not an alarm — "4 cards are
          fading" is a fact; "don't lose your progress!" would be a threat. */}
      {fading.length > 0 && filter !== 'solid' && (
        <div className="review-prompt">
          <div>
            <div className="rp-title">
              {fading.length} card{fading.length === 1 ? '' : 's'}{' '}
              {fading.length === 1 ? 'is' : 'are'} fading
            </div>
            <div className="rp-sub">A 90-second review locks them in.</div>
          </div>
          <button
            className="rp-btn"
            onClick={() => {
              haptic.tap()
              onReview?.(dueCards(fading.map((c) => c.meta)).length ? fading : [])
            }}
          >
            Review
          </button>
        </div>
      )}

      {keptCards.length === 0 ? (
        <div className="empty" style={{ padding: '48px 20px' }}>
          <div className="big">📚</div>
          <h3>Nothing kept yet</h3>
          <p>Tap 🔖 Save on a card to keep it here for later.</p>
        </div>
      ) : (
        <div className="kept-list">
          {shown.map((card) => {
            const expanded = expandedId === card.id
            return (
              <div
                className={`kept-item ${expanded ? 'expanded' : ''}`}
                key={card.id}
                style={{ '--topic': topicColor(card.topic) }}
              >
                <button className="kept-open" onClick={() => toggleExpand(card)}>
                  <div className="kept-meta-row">
                    <span className="mono">{topicName(card.topic)}</span>
                    <span className={`strength ${card.strength}`}>{card.strength}</span>
                  </div>
                  <h3>{card.title}</h3>
                  <p className="kept-body">{card.body}</p>
                  {!expanded && <div className="mono due-label">{card.due}</div>}
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

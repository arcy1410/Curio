import { topicName, topicEmoji, topicColor } from '../data/topics.js'
import { track, EV } from '../lib/analytics.js'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

// Presentational card. `swipeDir` (‘interested’ | ‘pass’ | null) drives the
// stamp overlay while a drag is in progress.
export default function Card({ card, swipeDir, onOpenComments, commentCount = 0 }) {
  return (
    <article className="card" style={{ '--topic': topicColor(card.topic) }}>
      <div className="tag">
        <span>{topicEmoji(card.topic)}</span>
        {topicName(card.topic)}
        {card.subtopic ? ` · ${card.subtopic}` : ''}
        <span className="readtime">2 min read</span>
      </div>

      <h2>{card.title}</h2>
      <div className="body">{card.body}</div>

      <div className="foot">
        <a
          className="source"
          href={card.source_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.stopPropagation()
            // Engagement with the source = engagement with the trust mechanism.
            track(EV.SOURCE_LINK_CLICKED, {
              card_id: card.id,
              topic: card.topic,
              host: hostOf(card.source_url),
            })
          }}
        >
          <span>🔗</span>
          <span className="host">
            Source: <u>{hostOf(card.source_url)}</u>
          </span>
        </a>
        {card.verified && (
          <span className="verified" title="Every claim checked against the source">
            ✓ Fact-checked
          </span>
        )}
      </div>

      <button
        className="comment-trigger"
        style={{ marginTop: 12 }}
        onClick={(e) => {
          e.stopPropagation()
          onOpenComments?.()
        }}
      >
        💬 {commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add a comment'}
      </button>

      <div className="stamp keep" style={{ opacity: swipeDir === 'interested' ? 1 : 0, fontSize: 18 }}>
        INTERESTED
      </div>
      <div className="stamp pass" style={{ opacity: swipeDir === 'pass' ? 1 : 0 }}>
        PASS
      </div>
    </article>
  )
}

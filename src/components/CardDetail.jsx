import { useEffect, useRef } from 'react'
import { topicName, topicColor } from '../data/topics.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

/**
 * The card detail sheet — "Go deeper" / "Why it's true →".
 *
 * This screen is Curio's trust mechanism made visible. Everywhere else the
 * product just asserts a card is fact-checked; here it shows the working: the
 * source it was written from, and the claim that the verifier passed. That is
 * the difference between a badge and evidence, and it is the reason "Where
 * this comes from" gets a section of its own rather than a link in a footer.
 *
 * Body paragraphs render separately rather than as one block — a 150-word card
 * read as a wall is the thing the 2-minute promise is supposed to prevent.
 */
const DEEP_READ_MS = 15_000

export default function CardDetail({
  card,
  onClose,
  onKeep,
  isSaved,
  onOpenComments,
  commentCount = 0,
  onDeepRead,
}) {
  useEffect(() => {
    track(EV.CARD_DETAIL_OPENED, { card_id: card.id, topic: card.topic })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  /**
   * 15 seconds of ACTIVE reading in this sheet counts as strongly as a Keep.
   *
   * Active, not elapsed: the clock stops when the tab is hidden, for the same
   * reason R5's dwell rule did — a sheet left open while someone takes a call
   * is not reading, and crediting it would put a +5 into the feed on a card
   * they never looked at. Time already banked survives the interruption.
   *
   * Fires at most once per card; the parent also refuses a second credit for
   * the same card (scoring.applyTopSignal), so this can't double with a Keep.
   */
  const firedRef = useRef(false)
  useEffect(() => {
    firedRef.current = false
    let banked = 0
    let since = document.visibilityState === 'visible' ? Date.now() : null

    const bank = () => {
      if (since != null) {
        banked += Date.now() - since
        since = null
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') since = Date.now()
      else bank()
    }
    document.addEventListener('visibilitychange', onVis)

    const timer = setInterval(() => {
      const total = banked + (since != null ? Date.now() - since : 0)
      if (total >= DEEP_READ_MS && !firedRef.current) {
        firedRef.current = true
        onDeepRead?.(card, Math.round(total))
      }
    }, 1000)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  const paragraphs = String(card.body || '')
    .split(/\n{2,}|(?<=\.)\s{2,}/)
    .filter(Boolean)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />

        <div className="detail-head">
          <span className="topic-chip" style={{ '--topic': topicColor(card.topic) }}>
            {topicName(card.topic)}
          </span>
          <div className="detail-head-right">
            <button
              className={`keep-pill ${isSaved ? 'on' : ''}`}
              onClick={() => {
                haptic.success()
                onKeep?.()
              }}
            >
              {isSaved ? 'Kept' : 'Keep'}
            </button>
            <button className="x-round" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="detail-body">
          <h2>{card.title}</h2>

          <div className="mono detail-meta">
            2 min read <span className="sep">•</span>{' '}
            {card.verified ? '1 cited source' : 'unverified'}
          </div>

          {card.stat && (
            <div className="detail-stat">
              <span className="stat">{card.stat}</span>
              <span className="mono stat-label">{card.stat_label}</span>
            </div>
          )}

          {paragraphs.map((p, i) => (
            <p key={i} className="detail-para">
              {p}
            </p>
          ))}

          {card.quiz_question && (
            <div className="pull-quote">{card.quiz_question}</div>
          )}

          <button
            className="source-row discuss-row"
            onClick={() => {
              onOpenComments?.()
              onClose()
            }}
          >
            <span className="spine" style={{ background: 'var(--rose)' }} />
            <span className="src-text">
              <span className="src-title">
                {commentCount > 0
                  ? `${commentCount} note${commentCount === 1 ? '' : 's'} on this card`
                  : 'Discuss this card'}
              </span>
              <span className="mono src-meta">Shared with everyone reading Curio</span>
            </span>
            <span className="arrow">→</span>
          </button>

          {/* The receipts. */}
          <div className="section-head mono source-head">
            Where this comes from
            {card.verified && <span className="checked-pill">Fact-checked</span>}
          </div>

          <a
            className="source-row"
            href={card.source_url}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              track(EV.SOURCE_LINK_CLICKED, {
                card_id: card.id,
                topic: card.topic,
                host: hostOf(card.source_url),
                surface: 'detail',
              })
            }
          >
            <span className="spine" />
            <span className="src-text">
              <span className="src-title">{hostOf(card.source_url)}</span>
              <span className="mono src-meta">
                {card.verified
                  ? 'Every claim checked against this source'
                  : 'Source not yet verified'}
              </span>
            </span>
            <span className="arrow">↗</span>
          </a>
        </div>

        <div className="detail-foot">
          <button className="x-round" onClick={onClose} aria-label="Back">
            ←
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              haptic.success()
              onKeep?.()
              onClose()
            }}
          >
            {isSaved ? 'Done' : 'Keep and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

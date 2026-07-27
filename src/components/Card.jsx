import { useEffect, useState } from 'react'
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
 * A card, in one of two treatments.
 *
 * QUIZ (default) — asks a question, makes the reader commit to a guess, then
 * reveals. This is the treatment that serves the North Star: a fact you
 * guessed at is one you are likelier to retain, which is the whole difference
 * between "cards swiped" and "cards kept AND retained".
 *
 * EDITORIAL — the fallback for any card without quiz data. Not a lesser
 * design: it's the treatment the handoff specifies for prose-led cards, and it
 * means the feed never blocks on the quiz pipeline having caught up.
 */
export default function Card({ card, swipeDir, onOpenComments, commentCount = 0, onGoDeeper }) {
  const hasQuiz = Boolean(card.quiz_question && card.quiz_answer)
  const [revealed, setRevealed] = useState(false)

  // Reset per card — otherwise the next card arrives pre-revealed and the
  // reader never gets the guess, which is the entire mechanic.
  useEffect(() => {
    setRevealed(false)
  }, [card.id])

  const topicLabel = `${topicName(card.topic)}${card.subtopic ? ` · ${card.subtopic}` : ''}`

  const footer = (
    <div className="card-foot">
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
        {hostOf(card.source_url)}
      </a>
      <div className="foot-right">
        <button
          className="comment-trigger"
          onClick={(e) => {
            e.stopPropagation()
            onOpenComments?.()
          }}
        >
          {commentCount > 0 ? `${commentCount} note${commentCount === 1 ? '' : 's'}` : 'Discuss'}
        </button>
        <button
          className="why-true"
          onClick={(e) => {
            e.stopPropagation()
            onGoDeeper?.()
          }}
        >
          Why it&apos;s true →
        </button>
      </div>
    </div>
  )

  return (
    <article
      className={`card ${hasQuiz ? 'card-quiz' : 'card-editorial'}`}
      style={{ '--topic': topicColor(card.topic) }}
    >
      {!hasQuiz && <div className="topic-rule" />}

      <div className="card-top">
        <span className="mono">
          {hasQuiz ? `Guess first · ${topicLabel}` : topicLabel}
        </span>
        <span className="mono readtime">2 min</span>
      </div>

      {hasQuiz ? (
        <>
          <h2 className="quiz-q">{card.quiz_question}</h2>

          <div className={`answer-panel ${revealed ? 'open' : ''}`}>
            {revealed ? (
              <div className="answer-inner">
                {card.stat && (
                  <div className="stat-row">
                    <span className="stat">{card.stat}</span>
                    <span className="mono stat-label">{card.stat_label}</span>
                  </div>
                )}
                <p className="answer-text">{card.quiz_answer}</p>
              </div>
            ) : (
              <div className="answer-locked">
                <span className="mono">Commit to a guess first</span>
                <button
                  className="reveal-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    haptic.tap()
                    setRevealed(true)
                    track(EV.QUIZ_REVEALED, { card_id: card.id, topic: card.topic })
                  }}
                >
                  Reveal the answer
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 className={card.title.length > 52 ? 'long' : ''}>{card.title}</h2>
          <p className="dek">{card.body}</p>
        </>
      )}

      {footer}

      <div className="stamp keep" style={{ opacity: swipeDir === 'interested' ? 1 : 0 }}>
        Keep
      </div>
      <div className="stamp pass" style={{ opacity: swipeDir === 'pass' ? 1 : 0 }}>
        Later
      </div>
    </article>
  )
}

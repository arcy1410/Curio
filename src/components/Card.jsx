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

  function reveal() {
    if (revealed) return
    haptic.tap()
    setRevealed(true)
    track(EV.QUIZ_REVEALED, { card_id: card.id, topic: card.topic })
  }

  const footer = (
    <div className="card-foot">
      {/* Every control inside the card takes pointerdown — react-tinder-card
          swallows taps on touch devices before a click is synthesised. */}
      <a
        className="source"
        href={card.source_url}
        target="_blank"
        rel="noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
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
      {/* Two items only. Three (source · discuss · why-it's-true) overflowed
          the card at phone width and wrapped outside its rounded corner.
          Comments move into the detail sheet, which has room and is where
          someone reading closely already is. */}
      <button
        className="why-true"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onGoDeeper?.()
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {commentCount > 0 ? `${commentCount} · Why it's true →` : "Why it's true →"}
      </button>
    </div>
  )

  return (
    <article
      className={`card ${hasQuiz ? 'card-quiz' : 'card-editorial'}`}
      style={{ '--topic': topicColor(card.topic) }}
    >
      {!hasQuiz && <div className="topic-rule" />}

      <div className="card-top">
        {/* Subtopic is dropped from the quiz header — "GUESS FIRST · HISTORY ·
            MEDIEVAL INDIA" wrapped to two lines and pushed the card down. */}
        <span className="mono">
          {hasQuiz ? `Guess first · ${topicName(card.topic)}` : topicLabel}
        </span>
        <span className="mono readtime">2 min</span>
      </div>

      {hasQuiz ? (
        <>
          {/* Curio's real questions run longer than the handoff's sample
              ("Where do most of an octopus's neurons live?"). Without stepping
              the size down, a 3-line question crushes the answer panel and the
              Reveal button overflows the card. */}
          <h2
            className={`quiz-q ${
              card.quiz_question.length > 64 ? 'longer' : card.quiz_question.length > 46 ? 'long' : ''
            }`}
          >
            {card.quiz_question}
          </h2>

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
                {/* onPointerDown, not onClick.
                    react-tinder-card owns the card's pointer/touch handlers to
                    drive the drag, and on a TOUCH device it swallows the tap
                    before a click event is ever synthesised — so this button
                    worked with a mouse and did nothing on a phone, which is
                    the only device that matters here. Acting on pointerdown
                    and stopping propagation gets in before the drag logic. */}
                <button
                  className="reveal-btn"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    reveal()
                  }}
                  onClick={(e) => {
                    // Keyboard/assistive activation still routes through click;
                    // reveal() is idempotent so a double-fire is harmless.
                    e.stopPropagation()
                    reveal()
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

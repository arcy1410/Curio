import { useEffect, useState } from 'react'
import { topicName, topicColor } from '../data/topics.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

/**
 * Recall quiz — offered when the feed runs dry, while fresh cards generate.
 *
 * The mechanic is guess-first, same as the card face: question → the user
 * commits to an answer in their head → reveal → they grade THEMSELVES. Self-
 * grading is deliberate. Free-text answers would need marking (an LLM call in
 * the serving path — R2 says no) and multiple choice tests recognition, not
 * recall. An honest "did you know it?" is the cheapest honest signal, and it
 * is measured retention — the thing the North Star claims and almost nothing
 * else in the app can observe directly.
 *
 * Nothing here scores the feed or touches reviewMeta: seen ≠ kept, and a quiz
 * on a passed card saying "you remembered it" should not retroactively tune
 * the feed toward a topic the user swiped away.
 */
export default function QuizMode({ cards, onClose }) {
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [remembered, setRemembered] = useState(0)
  const done = idx >= cards.length
  const card = cards[idx]

  useEffect(() => {
    track(EV.RECALL_QUIZ_STARTED, { card_count: cards.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function grade(gotIt) {
    if (gotIt) haptic.success()
    else haptic.tap()
    track(EV.RECALL_QUIZ_GRADED, {
      card_id: card.id,
      topic: card.topic,
      remembered: gotIt,
    })
    const nextRemembered = remembered + (gotIt ? 1 : 0)
    setRemembered(nextRemembered)
    setRevealed(false)
    const next = idx + 1
    setIdx(next)
    if (next >= cards.length) {
      track(EV.RECALL_QUIZ_COMPLETED, {
        card_count: cards.length,
        remembered_count: nextRemembered,
      })
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet quiz-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />

        {done ? (
          <div className="quiz-end">
            <div className="big">{remembered >= cards.length * 0.7 ? '🧠' : '📖'}</div>
            <h2>
              {remembered} of {cards.length} stuck
            </h2>
            <p>
              {remembered >= cards.length * 0.7
                ? 'That reading is holding. This is the part no feed ever checks.'
                : 'The ones that slipped are the ones worth a re-read in your Kept pile.'}
            </p>
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="quiz-head">
              <span className="topic-chip" style={{ '--topic': topicColor(card.topic) }}>
                {topicName(card.topic)}
              </span>
              <span className="mono quiz-count">
                {idx + 1} / {cards.length}
              </span>
              <button className="x-round" onClick={onClose} aria-label="Close quiz">
                ✕
              </button>
            </div>

            <div className="quiz-body">
              <div className="mono quiz-kicker">From a card you read</div>
              <h2 className="quiz-q">{card.quiz_question}</h2>

              {revealed ? (
                <>
                  <div className="quiz-answer">{card.quiz_answer}</div>
                  <div className="mono quiz-prompt">Did you have it?</div>
                  <div className="quiz-grade">
                    <button className="btn-ghost" onClick={() => grade(false)}>
                      Not quite
                    </button>
                    <button className="btn-primary" onClick={() => grade(true)}>
                      Got it
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mono quiz-prompt">Answer in your head first — that&apos;s the rep.</div>
                  <button
                    className="btn-primary quiz-reveal"
                    onClick={() => {
                      haptic.open()
                      setRevealed(true)
                    }}
                  >
                    Reveal
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { topicName, topicColor } from '../data/topics.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'
import { guessMatches } from '../lib/answerMatch.js'

/**
 * Recall quiz — offered when the feed runs dry, while fresh cards generate.
 *
 * The mechanic is type-first: the user writes their answer, the matcher
 * judges it (client-side token match — answerMatch.js explains why it's not
 * an LLM), and only then does the real answer appear. Typing is a stronger
 * retrieval rep than answering in your head, and the verdict makes the
 * result measurable — recall_quiz_graded {remembered} is the closest thing
 * the product has to observing the North Star's "retained" directly.
 *
 * The matcher is generous but fallible, so a wrong verdict can be overruled
 * ("count it") — a fuzzy grader that quietly deflates people's scores would
 * poison both the experience and the metric.
 *
 * Nothing here scores the feed or touches reviewMeta: seen ≠ kept, and a
 * quiz on a passed card saying "you remembered it" should not retroactively
 * tune the feed toward a topic the user swiped away.
 */
export default function QuizMode({ cards, onClose }) {
  const [idx, setIdx] = useState(0)
  const [guess, setGuess] = useState('')
  const [verdict, setVerdict] = useState(null) // null | 'right' | 'wrong' | 'shown'
  const [remembered, setRemembered] = useState(0)
  const inputRef = useRef(null)
  const done = idx >= cards.length
  const card = cards[idx]

  useEffect(() => {
    track(EV.RECALL_QUIZ_STARTED, { card_count: cards.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Fresh question: clear the field and put the cursor back in it.
    setGuess('')
    setVerdict(null)
    inputRef.current?.focus()
  }, [idx])

  function submitGuess() {
    const g = guess.trim()
    if (!g || verdict) return
    const matched = guessMatches(g, card.quiz_answer, card.quiz_question)
    setVerdict(matched ? 'right' : 'wrong')
    if (matched) haptic.success()
    else haptic.error()
  }

  // Advance, recording how this card resolved. `method` distinguishes the
  // matcher's own verdict from a user override of it.
  function next(gotIt, method) {
    track(EV.RECALL_QUIZ_GRADED, {
      card_id: card.id,
      topic: card.topic,
      remembered: gotIt,
      method,
    })
    const nextRemembered = remembered + (gotIt ? 1 : 0)
    setRemembered(nextRemembered)
    const n = idx + 1
    setIdx(n)
    if (n >= cards.length) {
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

              {verdict ? (
                <>
                  {verdict !== 'shown' && (
                    <div className={`verdict-chip ${verdict === 'right' ? 'right' : 'wrong'}`}>
                      {verdict === 'right' ? '✓ You had it' : '✗ Not quite'}
                      {guess.trim() && <span className="verdict-guess">“{guess.trim()}”</span>}
                    </div>
                  )}
                  <div className="quiz-answer">{card.quiz_answer}</div>
                  {verdict === 'wrong' && (
                    <button
                      className="guess-skip mono"
                      onClick={() => {
                        haptic.success()
                        next(true, 'override')
                      }}
                    >
                      I actually had it — count it
                    </button>
                  )}
                  <div className="quiz-grade">
                    <button
                      className="btn-primary"
                      onClick={() =>
                        verdict === 'shown' ? next(false, 'skipped') : next(verdict === 'right', 'auto')
                      }
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mono quiz-prompt">Type it — writing is the rep that makes it stick.</div>
                  <div className="guess-row">
                    <input
                      ref={inputRef}
                      className="guess-input"
                      type="text"
                      enterKeyHint="go"
                      placeholder="Your answer…"
                      value={guess}
                      maxLength={80}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitGuess()
                      }}
                    />
                    <button className="btn-primary guess-check" disabled={!guess.trim()} onClick={submitGuess}>
                      Check
                    </button>
                  </div>
                  <button
                    className="guess-skip mono"
                    onClick={() => {
                      haptic.tap()
                      setVerdict('shown')
                    }}
                  >
                    just show me →
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

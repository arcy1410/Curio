import { useEffect, useRef, useState } from 'react'
import { topicName, topicColor } from '../data/topics.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'
import { guessMatches } from '../lib/answerMatch.js'

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
export default function Card({
  card,
  onOpenComments,
  commentCount = 0,
  onGoDeeper,
  onReveal,
}) {
  const hasQuiz = Boolean(card.quiz_question && card.quiz_answer)
  const [revealed, setRevealed] = useState(false)
  const [guess, setGuess] = useState('')
  const [verdict, setVerdict] = useState(null) // null | 'right' | 'wrong' — null = revealed without guessing
  const tapStart = useRef(null) // distinguishes a tap on the answer from a scroll

  // Reset per card — otherwise the next card arrives pre-revealed and the
  // reader never gets the guess, which is the entire mechanic.
  useEffect(() => {
    setRevealed(false)
    setGuess('')
    setVerdict(null)
  }, [card.id])

  const topicLabel = `${topicName(card.topic)}${card.subtopic ? ` · ${card.subtopic}` : ''}`

  function reveal(method, matched = null) {
    if (revealed) return
    setRevealed(true)
    track(EV.QUIZ_REVEALED, { card_id: card.id, topic: card.topic, method, matched })
    onReveal?.(card) // +1: the guess was attempted
  }

  // The typed path: judge the guess (client-side token match — see
  // answerMatch.js for why it's not an LLM), stamp the verdict, then show
  // the real answer so the matcher never gets the last word.
  function submitGuess() {
    const g = guess.trim()
    if (!g || revealed) return
    const matched = guessMatches(g, card.quiz_answer, card.quiz_question)
    setVerdict(matched ? 'right' : 'wrong')
    if (matched) haptic.success()
    else haptic.error()
    reveal('typed', matched)
  }

  const footer = (
    <div className="card-foot">
      {/* Provenance stays on the face — it is the trust promise — but as a
          label now, since the link beside it goes to the same place. When a
          card has discussion, that signal takes the slot instead: it is the
          thing a reader can't otherwise know is there. */}
      <span className="source">
        {commentCount > 0
          ? `${commentCount} note${commentCount === 1 ? '' : 's'} · ${hostOf(card.source_url)}`
          : hostOf(card.source_url)}
      </span>
      {/* Two items only. Three (source · discuss · why-it's-true) overflowed
          the card at phone width and wrapped outside its rounded corner.
          Comments move into the detail sheet, which has room and is where
          someone reading closely already is. */}
      {/* Straight to the source. POINTERDOWN, not click: react-tinder-card
          takes pointer events natively on the card and gets them before
          React's synthetic system, so a click handler here is swallowed by the
          drag. window.open inside a pointer gesture counts as user activation,
          so it isn't popup-blocked. */}
      <a
        className="why-true"
        href={card.source_url}
        target="_blank"
        rel="noreferrer"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          track(EV.SOURCE_LINK_CLICKED, {
            card_id: card.id,
            topic: card.topic,
            host: hostOf(card.source_url),
            surface: 'why_its_true',
          })
          window.open(card.source_url, '_blank', 'noopener,noreferrer')
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        Why it&apos;s true ↗
      </a>
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

          {/* Scrolling a revealed answer was impossible on touch: the card's
              drag handler claimed the gesture, so a vertical swipe moved the
              card instead of the text. Stopping pointerdown here keeps the
              drag from starting, and touch-action:pan-y (CSS) tells the
              browser this area scrolls vertically. */}
          {/* Once revealed, the panel itself opens the sheet — the natural
              next move after reading the answer is "tell me more", and the
              answer is the biggest target on the card.

              Tap, not pointerdown: the panel also SCROLLS, so acting on
              pointerdown would open the sheet every time someone tried to read
              past the fold. We compare the down and up positions and only
              treat it as a tap if the finger barely moved. */}
          <div
            className={`answer-panel ${revealed ? 'open' : ''}`}
            role={revealed ? 'button' : undefined}
            tabIndex={revealed ? 0 : undefined}
            onPointerDown={(e) => {
              // Record where the gesture began so pointerup can tell a tap
              // from a scroll. Also stops the card's drag handler claiming a
              // vertical gesture that belongs to this scroll area.
              if (!revealed) return
              tapStart.current = { x: e.clientX, y: e.clientY, top: e.currentTarget.scrollTop }
            }}
            onPointerUp={(e) => {
              if (!revealed) return
              const start = tapStart.current
              tapStart.current = null
              if (!start) return
              const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
              const scrolled = Math.abs(e.currentTarget.scrollTop - start.top)
              // A tap: the finger barely moved AND the panel didn't scroll.
              // Either alone is ambiguous — momentum scrolling can end close to
              // where it began.
              //
              // Deliberately NO time limit. A first attempt capped this at
              // 700ms, which rejected any slow or hesitant tap — duration says
              // nothing about intent here, only movement does.
              if (moved < 10 && scrolled < 4) {
                onGoDeeper?.()
              }
            }}
            onKeyDown={(e) => {
              if (revealed && (e.key === 'Enter' || e.key === ' ')) onGoDeeper?.()
            }}
          >
            {revealed ? (
              <div className="answer-inner">
                {verdict && (
                  <div className={`verdict-chip ${verdict}`}>
                    {verdict === 'right' ? '✓ You had it' : '✗ Not quite'}
                    {guess.trim() && <span className="verdict-guess">“{guess.trim()}”</span>}
                  </div>
                )}
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
                <span className="mono">Type your guess</span>
                {/* Every handler here stops pointerdown propagation and, for
                    the buttons, prevents default — react-tinder-card owns the
                    card's pointer/touch handlers natively, so anything less
                    and a tap starts a drag instead (the hard-won rule from the
                    original Reveal button). The INPUT is the one element that
                    must NOT preventDefault (it would block focus), so it stops
                    propagation and focuses itself explicitly inside the same
                    gesture — which is also what makes the phone keyboard open. */}
                <div className="guess-row">
                  <input
                    className="guess-input"
                    type="text"
                    inputMode="text"
                    enterKeyHint="go"
                    placeholder="Your answer…"
                    value={guess}
                    maxLength={80}
                    onChange={(e) => setGuess(e.target.value)}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.currentTarget.focus()
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') submitGuess()
                    }}
                  />
                  <button
                    className="reveal-btn guess-check"
                    disabled={!guess.trim()}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      submitGuess()
                    }}
                    onClick={(e) => {
                      // Keyboard/assistive activation still routes through
                      // click; submitGuess() is idempotent via `revealed`.
                      e.stopPropagation()
                      submitGuess()
                    }}
                  >
                    Check
                  </button>
                </div>
                <button
                  className="guess-skip mono"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    haptic.tap()
                    reveal('skip')
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    haptic.tap()
                    reveal('skip')
                  }}
                >
                  just show me →
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 className={card.title.length > 52 ? 'long' : ''}>{card.title}</h2>
          {/* No stopPropagation here. touch-action:pan-y already gives the
              browser vertical scrolling while leaving horizontal gestures to
              the swipe handler — swallowing pointerdown as well killed the
              drag for anyone who started it on the text, which is most of the
              card. */}
          <p className="dek">{card.body}</p>
        </>
      )}

      {footer}

      {/* Shown via the wrapper's data-stamp attribute (see Feed.markStamp) so
          a drag never triggers a React re-render — re-rendering mid-gesture
          was breaking the swipe itself. */}
      <div className="stamp keep">Keep</div>
      <div className="stamp pass">Later</div>
    </article>
  )
}

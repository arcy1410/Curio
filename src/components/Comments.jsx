import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_COMMENTS } from '../data/demoComments.js'
import { checkComment } from '../lib/profanity.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

function timeAgo(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// Merge read-only demo comments with user-added ones for a card, normalising
// both into { id, author, text, parentId, minsAgo } shape.
function buildThread(cardId, userComments) {
  const demo = (DEMO_COMMENTS[cardId] || []).map((c) => ({ ...c, demo: true }))
  const mine = (userComments || []).map((c) => ({
    id: c.id,
    author: 'You',
    text: c.text,
    parentId: c.parentId ?? null,
    minsAgo: Math.max(0, (Date.now() - c.ts) / 60000),
  }))
  const all = [...demo, ...mine]
  const tops = all.filter((c) => !c.parentId)
  const repliesOf = (id) => all.filter((c) => c.parentId === id)
  return { tops, repliesOf, count: all.length }
}

export default function Comments({ card, userComments, onAdd, onClose }) {
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null) // { id, author }
  const [err, setErr] = useState('')
  const areaRef = useRef(null)

  const { tops, repliesOf, count } = useMemo(
    () => buildThread(card.id, userComments),
    [card.id, userComments]
  )

  useEffect(() => {
    track(EV.COMMENTS_OPENED, { card_id: card.id, topic: card.topic, comment_count: count })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  function submit() {
    const res = checkComment(text)
    if (!res.ok) {
      haptic.error()
      setErr(res.reason)
      // Guardrail telemetry: the reason only — never the rejected text.
      track(EV.COMMENT_REJECTED, { card_id: card.id, reason: res.reason })
      return
    }
    haptic.success()
    onAdd({ text: text.trim(), parentId: replyTo?.id ?? null })
    setText('')
    setReplyTo(null)
    setErr('')
  }

  function startReply(c) {
    setReplyTo({ id: c.id, author: c.author })
    areaRef.current?.focus()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <h3>{count} comment{count === 1 ? '' : 's'}</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="comments">
          {tops.length === 0 && (
            <div className="comment-empty">
              No comments yet.<br />
              Be the first to say something.
            </div>
          )}

          {tops.map((c) => (
            <div className="comment" key={c.id}>
              <div>
                <span className="who">{c.author}</span>
                <span className="when">{timeAgo(c.minsAgo)}</span>
              </div>
              <div className="text">{c.text}</div>
              <button className="reply-btn" onClick={() => startReply(c)}>
                Reply
              </button>

              {repliesOf(c.id).length > 0 && (
                <div className="replies">
                  {repliesOf(c.id).map((r) => (
                    <div className="comment" key={r.id} style={{ marginBottom: 0 }}>
                      <div>
                        <span className="who">{r.author}</span>
                        <span className="when">{timeAgo(r.minsAgo)}</span>
                      </div>
                      <div className="text">{r.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="composer">
          {replyTo && (
            <div className="replying">
              <span>Replying to {replyTo.author}</span>
              <button onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <div className="field">
            <textarea
              ref={areaRef}
              rows={1}
              value={text}
              placeholder="Add a thought…"
              onChange={(e) => {
                setText(e.target.value)
                if (err) setErr('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
              }}
            />
            <button className="send" disabled={!text.trim()} onClick={submit}>
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

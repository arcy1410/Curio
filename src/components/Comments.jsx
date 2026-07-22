import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_COMMENTS } from '../data/demoComments.js'
import { checkComment } from '../lib/profanity.js'
import { fetchThread, postComment } from '../lib/comments.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

function timeAgo(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// Normalise a locally-stored comment into the shape the server returns, so
// the render path below never has to know where a comment came from.
function fromLocal(c) {
  return {
    id: c.id,
    author: 'You',
    text: c.text,
    parentId: c.parentId ?? null,
    minsAgo: Math.max(0, (Date.now() - c.ts) / 60000),
  }
}

function organise(all) {
  const tops = all.filter((c) => !c.parentId)
  const repliesOf = (id) => all.filter((c) => c.parentId === id)
  return { tops, repliesOf, count: all.length }
}

export default function Comments({ card, userComments, onAdd, onClose, onLockedReply }) {
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null) // { id, author }
  const [err, setErr] = useState('')
  const [thread, setThread] = useState(null) // null = still loading
  const [offline, setOffline] = useState(false)
  const areaRef = useRef(null)

  // The local pile is now a FALLBACK, not the source of truth. It renders only
  // when the store is unreachable — otherwise a user would see their own
  // comment twice, once from each place.
  const localThread = useMemo(() => {
    const demo = (DEMO_COMMENTS[card.id] || []).map((c) => ({ ...c, demo: true }))
    return [...demo, ...(userComments || []).map(fromLocal)]
  }, [card.id, userComments])

  const load = useCallback(async () => {
    const { comments, ok } = await fetchThread(card.id)
    setOffline(!ok)
    setThread(ok ? comments : localThread)
  }, [card.id, localThread])

  useEffect(() => {
    load()
  }, [load])

  const { tops, repliesOf, count } = organise(thread ?? [])

  useEffect(() => {
    if (thread === null) return // don't report a count we haven't loaded yet
    track(EV.COMMENTS_OPENED, { card_id: card.id, topic: card.topic, comment_count: count })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, thread === null])

  async function submit() {
    // Client check first, purely for instant feedback while typing. The
    // database runs the same rules and has the final say — see comments.js.
    const res = checkComment(text)
    if (!res.ok) {
      haptic.error()
      setErr(res.reason)
      // Guardrail telemetry: the reason only — never the rejected text.
      track(EV.COMMENT_REJECTED, { card_id: card.id, reason: res.reason })
      return
    }

    const body = text.trim()
    const parentId = replyTo?.id ?? null
    setText('')
    setReplyTo(null)
    setErr('')

    const { comment, error } = await postComment({ cardId: card.id, text: body, parentId })
    if (error) {
      haptic.error()
      setErr(error)
      setText(body) // give the text back rather than losing what they wrote
      track(EV.COMMENT_REJECTED, { card_id: card.id, reason: 'server' })
      // Keep it on this device so the thought isn't lost outright.
      onAdd({ text: body, parentId })
      return
    }

    haptic.success()
    setThread((t) => [...(t ?? []), comment])
    // Never send the comment text itself — only structural facts.
    track(EV.COMMENT_POSTED, {
      card_id: card.id,
      topic: card.topic,
      is_reply: Boolean(parentId),
      length_bucket: body.length < 40 ? 'short' : body.length < 140 ? 'medium' : 'long',
    })
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
          <h3>{thread === null ? 'Comments' : `${count} comment${count === 1 ? '' : 's'}`}</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="comments">
          {thread === null && <div className="comment-empty">Loading comments…</div>}

          {thread !== null && tops.length === 0 && (
            <div className="comment-empty">
              No comments yet.<br />
              Be the first to say something.
            </div>
          )}

          {offline && thread !== null && (
            <div className="comment-empty" style={{ paddingBottom: 0 }}>
              Showing comments saved on this device — we couldn&apos;t reach the others.
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
                    <div className="comment reply" key={r.id} style={{ marginBottom: 0 }}>
                      <div>
                        <span className="who">{r.author}</span>
                        <span className="when">{timeAgo(r.minsAgo)}</span>
                      </div>
                      <div className="text">{r.text}</div>
                      {/* R6: visible, tappable, never opens a composer. The
                          database rejects depth 2 as well (reject_nested_reply),
                          so this is a legible boundary rather than the only
                          thing standing between a user and a nested reply. */}
                      <button
                        className="reply-btn locked"
                        onClick={() => onLockedReply?.()}
                        aria-label="Reply to reply — Curio+"
                      >
                        🔒 Reply
                      </button>
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

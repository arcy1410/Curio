// Shared comment threads.
//
// Before this, comments lived in localStorage. The feature looked complete —
// you could post, reply, and see a count — but every thread was a mirror: no
// user could ever see another user's comment. Reading and writing both move
// to Supabase here.
//
// Reads use plain fetch, writes use the SDK. That split is deliberate:
// reading a thread is a public GET under `comments_read using (true)`, so it
// needs no session and no auth library, and keeping it on fetch means opening
// a thread doesn't wait on a 57 kB SDK download. Posting needs a real
// `auth.uid()`, so it pays for the SDK — at the moment someone actually
// writes something.
//
// Failure is never fatal, same rule as cardStore: a thread that won't load
// falls back to whatever is on the device rather than breaking the card.

import { getClient, ensureUser, isConfigured } from './session.js'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function restHeaders() {
  return { apikey: KEY, Authorization: `Bearer ${KEY}` }
}

/** One level of nesting only (R6) — enforced by trigger, mirrored here. */
function shape(row) {
  return {
    id: row.id,
    author: row.author_name || 'Reader',
    text: row.body,
    parentId: row.parent_comment_id ?? null,
    minsAgo: Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 60000),
    userId: row.user_id,
  }
}

/**
 * Load a card's thread.
 * Returns { comments, ok }. `ok: false` means the store was unreachable —
 * the caller shows the local fallback rather than an empty thread.
 */
export async function fetchThread(cardId, { timeoutMs = 8000 } = {}) {
  if (!isConfigured) return { comments: [], ok: false }
  try {
    const params = new URLSearchParams({
      select: 'id,body,parent_comment_id,author_name,user_id,created_at',
      card_id: `eq.${cardId}`,
      order: 'created_at.asc',
    })
    const res = await fetch(`${URL_BASE}/rest/v1/comments?${params}`, {
      headers: restHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`comments ${res.status}`)
    const rows = await res.json()
    return { comments: (rows ?? []).map(shape), ok: true }
  } catch {
    return { comments: [], ok: false }
  }
}

/**
 * Comment counts for the card face, as { [cardId]: n }.
 * Empty object when unavailable — the caller falls back to its local tally.
 */
export async function fetchCommentCounts({ timeoutMs = 8000 } = {}) {
  if (!isConfigured) return {}
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/comment_counts?select=card_id,n`, {
      headers: restHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`counts ${res.status}`)
    const rows = await res.json()
    return Object.fromEntries((rows ?? []).map((r) => [r.card_id, r.n]))
  } catch {
    return {}
  }
}

// The database rejects with a symbolic code so the user-facing copy lives in
// one place — here — rather than being written twice, in SQL and in JS.
const REASONS = {
  links_not_allowed: "Links aren't allowed in comments.",
  blocked_language: "Please keep it civil — that word isn't allowed.",
  comment_depth: 'Replies to replies are a Curio+ feature.',
}

function reasonFor(error) {
  const raw = `${error?.message ?? ''}`
  for (const [code, copy] of Object.entries(REASONS)) {
    if (raw.includes(code)) return copy
  }
  return 'Could not post that just now. Try again.'
}

/**
 * Post a comment. Returns { comment } on success, { error } otherwise.
 *
 * The moderation verdict comes from the database, not from the client copy of
 * the word list — the client check runs first only so typing feedback is
 * instant. If the two ever disagree, this is the one that decided.
 */
export async function postComment({ cardId, text, parentId = null }) {
  if (!isConfigured) return { error: 'Comments need a connection.' }

  const supabase = await getClient()
  const user = supabase ? await ensureUser() : null
  if (!user) return { error: 'Could not start a session — your comment stayed on this device.' }

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        card_id: cardId,
        user_id: user.id,
        parent_comment_id: parentId,
        body: text.trim(),
      })
      .select('id,body,parent_comment_id,author_name,user_id,created_at')
      .single()
    if (error) throw error
    return { comment: shape(data) }
  } catch (error) {
    return { error: reasonFor(error) }
  }
}

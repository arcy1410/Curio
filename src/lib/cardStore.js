// Card store — reads cards from Supabase, falls back to the bundled seed set.
//
// Two design points worth keeping:
//
// 1. This uses the PUBLISHABLE key, which is safe in the browser. RLS on the
//    `cards` table means this key can only ever read rows where verified is
//    true — an unverified draft is invisible to the client by database policy,
//    not by us remembering to add `.eq('verified', true)` here. (We pass the
//    filter anyway; belt and braces.)
//
// 2. Fetch failure is not fatal. Spec R2: "the feed must stay responsive if
//    the store is unreachable". If Supabase is down, misconfigured, or the
//    network drops, we serve the bundled seed cards rather than an empty feed,
//    and report which source is live so the UI can be honest about it.

import { CARDS as SEED_CARDS } from '../data/cards.js'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Map a database row onto the shape the app's components already expect. */
function toCard(row) {
  return {
    id: row.id,
    topic: row.topic_id,
    // The app renders sub-topics as labels ("World Cups"), so unwrap the join.
    subtopic: row.subtopic?.name ?? null,
    title: row.title,
    body: row.body,
    source_url: row.source_url,
    verified: row.verified,
  }
}

/**
 * Load the card library.
 * Always resolves — never throws — so the feed can always render something.
 * Returns { cards, source: 'supabase' | 'seed', error }.
 */
export async function loadCards({ timeoutMs = 8000 } = {}) {
  if (!URL_BASE || !KEY) {
    return { cards: SEED_CARDS, source: 'seed', error: 'supabase env vars not set' }
  }

  try {
    const params = new URLSearchParams({
      select: 'id,topic_id,title,body,source_url,verified,subtopic:subtopic_id(name)',
      verified: 'is.true', // redundant with RLS, kept as an explicit intent
      order: 'created_at.desc',
    })

    const res = await fetch(`${URL_BASE}/rest/v1/cards?${params}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`supabase ${res.status}`)

    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      // An empty store is a real state (pipeline hasn't run yet) — seed rather
      // than show an empty feed.
      return { cards: SEED_CARDS, source: 'seed', error: 'store empty' }
    }

    return { cards: rows.map(toCard), source: 'supabase', error: null }
  } catch (err) {
    return { cards: SEED_CARDS, source: 'seed', error: err.message }
  }
}

export { SEED_CARDS }

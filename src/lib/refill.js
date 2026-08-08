// Client side of the exhaustion refill (api/refill.js).
//
// One request = one card. The batch loop lives in App.jsx so its progress can
// drive the topbar chip from any tab; this module only knows how to ask for a
// single card and how to fail quietly.

import { getClient } from './session.js'

/**
 * Ask the server to generate one verified card for `topic`.
 *
 * Resolves to one of:
 *   { result: 'published', card }   — a fresh card, in library shape
 *   { result: 'no_source' }         — nothing new to write about (skip)
 *   { result: 'discarded' }         — failed verification (skip; fail closed)
 *   { result: 'error', error }      — auth/network/server failure (may retry)
 *
 * Never throws. Generation with a reasoning-model verifier is slow (~10–30s),
 * so the timeout is generous — the caller runs this in the background.
 */
export async function generateOneCard(topic) {
  try {
    const supabase = await getClient()
    if (!supabase) return { result: 'error', error: 'not configured' }
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return { result: 'error', error: 'no session' }

    const res = await fetch('/api/refill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ topic }),
      signal: AbortSignal.timeout(120_000),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { result: 'error', error: body.error || `http ${res.status}` }
    return body
  } catch (err) {
    return { result: 'error', error: err?.message ?? 'network' }
  }
}

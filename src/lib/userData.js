// User data — swipes, saves and topic scores, mirrored to Supabase.
//
// localStorage stays the local source of truth and the server is written
// THROUGH, never waited on. Spec R2 is explicit that a swipe must never wait
// on the network, and it is also just correct: the animation has already
// happened by the time the row lands.
//
// So every write here is fire-and-forget and every failure is swallowed. The
// user's device keeps working offline exactly as it did before; the server
// copy is what makes a second device — and the metrics dashboard — possible.
//
// Cards from the SEED fallback have slug ids ("bly-lagaan"), not UUIDs, and
// the swipes/saved_cards tables have a foreign key to cards. Writing one would
// fail on every row, so isSyncable() drops them silently rather than
// generating a stream of pointless 400s.

import { getClient, ensureUser, existingUser } from './session.js'

// Sync failures are non-fatal by design — but silent non-fatal failures are
// how a "working" feature writes nothing for a week. Loud in dev, quiet in
// production.
function warn(where, error) {
  if (import.meta.env.DEV) console.warn(`[sync:${where}]`, error?.message ?? error)
}

/**
 * supabase-js RESOLVES with { data, error } — it does not reject. A bare
 * try/catch around these calls therefore catches nothing, and a failed write
 * looks exactly like a successful one. This turns the returned error back into
 * a throw so the catch blocks below are real.
 */
function checked(where) {
  return ({ data, error }) => {
    if (error) {
      warn(where, error)
      throw error
    }
    return data
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only rows that reference a real card can be stored. */
export function isSyncable(cardId) {
  return UUID.test(String(cardId ?? ''))
}

/**
 * The identity to write as, or null.
 *
 * This is where an anonymous user is created for someone who has only ever
 * swiped: identity is what makes their history durable, and R9 deliberately
 * lets the first seven actions happen before we ask for anything.
 */
async function writer() {
  const supabase = await getClient()
  if (!supabase) return null
  const user = await ensureUser()
  return user ? { supabase, user } : null
}

/** Record one swipe. Upserts — the table is unique per (user, card). */
export async function syncSwipe({ cardId, action, surface = 'feed' }) {
  if (!isSyncable(cardId)) return
  try {
    const w = await writer()
    if (!w) return
    // A save auto-swipes right (R4), so the same card can arrive twice.
    // onConflict keeps it exactly-once instead of erroring.
    await w.supabase
      .from('swipes')
      .upsert(
        { user_id: w.user.id, card_id: cardId, action, surface },
        { onConflict: 'user_id,card_id' }
      )
      .then(checked('swipe'))
  } catch {
    // local state already updated; the server copy can lag
  }
}

/** Add or remove a card from the Kept pile. */
export async function syncSave({ cardId, saved }) {
  if (!isSyncable(cardId)) return
  try {
    const w = await writer()
    if (!w) return
    if (saved) {
      // The 20-cap trigger may reject this. The client already enforces the
      // same cap, so a rejection here means the two disagreed — the database
      // is right, and the local pile will reconcile on the next hydrate.
      await w.supabase
        .from('saved_cards')
        .upsert({ user_id: w.user.id, card_id: cardId }, { onConflict: 'user_id,card_id' })
        .then(checked('save'))
    } else {
      await w.supabase
        .from('saved_cards')
        .delete()
        .eq('user_id', w.user.id)
        .eq('card_id', cardId)
        .then(checked('unsave'))
    }
  } catch {
    // as above
  }
}

/** Persist the whole topic-score vector. Small (4 topics) — one upsert. */
export async function syncScores(scores) {
  try {
    const w = await writer()
    if (!w) return
    const rows = Object.entries(scores ?? {}).map(([topic_id, score]) => ({
      user_id: w.user.id,
      topic_id,
      score,
      updated_at: new Date().toISOString(),
    }))
    if (!rows.length) return
    await w.supabase
      .from('topic_scores')
      .upsert(rows, { onConflict: 'user_id,topic_id' })
      .then(checked('scores'))
  } catch {
    // as above
  }
}

/** Store the topics chosen at onboarding on the profile. */
export async function syncInterests(interests) {
  try {
    const w = await writer()
    if (!w) return
    await w.supabase
      .from('profiles')
      .update({ interests })
      .eq('id', w.user.id)
      .then(checked('interests'))
  } catch {
    // as above
  }
}

/**
 * Fold server history into local state.
 *
 * R9's rule: server state wins, anonymous local activity merges additively.
 * "Wins" is deliberately narrow — it means the server is authoritative where
 * the two disagree, NOT that local data is discarded. Someone who swiped on
 * this device before signing in keeps those swipes.
 *
 * Unions everywhere, so the merge is order-independent and re-running it is
 * harmless — which matters because hydrate() runs on every load, not once.
 */
export function mergeState(local, server) {
  if (!server) return local

  const seen = [...new Set([...(server.seen ?? []), ...(local.seen ?? [])])]

  // De-dup swipes by card; the server's copy of a card is the one that counts.
  const byCard = new Map()
  for (const s of local.swipes ?? []) byCard.set(s.cardId, s)
  for (const s of server.swipes ?? []) byCard.set(s.cardId, s)

  // Server saves first (they're already ordered newest-first), then anything
  // saved locally that never reached the server. The cap still applies: the
  // database would reject the overflow anyway, so trimming here keeps the two
  // in agreement instead of showing a pile the server refuses to store.
  const kept = [...new Set([...(server.kept ?? []), ...(local.kept ?? [])])].slice(0, 20)

  const interests = server.interests?.length ? server.interests : local.interests

  return {
    ...local,
    seen,
    swipes: [...byCard.values()],
    kept,
    // Server scores win per topic; topics only scored locally are kept.
    topicScores: { ...(local.topicScores ?? {}), ...(server.topicScores ?? {}) },
    interests,
    // Someone with history on the server has already onboarded. Without this a
    // second device asks them to pick topics they picked on the first, then
    // overwrites the scores it just restored.
    onboarded: local.onboarded || interests?.length > 0 || byCard.size > 0,
  }
}

/**
 * Read this account's history back from the server.
 *
 * Returns null when there is nothing to restore, so the caller can leave local
 * state untouched — an empty result must never wipe a device that has data.
 */
export async function hydrate() {
  try {
    // existingUser, not ensureUser: restoring history must never CREATE an
    // identity, or every visitor gets an account just for opening the page.
    const supabase = await getClient()
    const user = await existingUser()
    if (!supabase || !user) return null
    const w = { supabase }
    const uid = user.id

    const [swipes, saved, scores, profile] = await Promise.all([
      w.supabase.from('swipes').select('card_id,action').eq('user_id', uid),
      w.supabase.from('saved_cards').select('card_id').eq('user_id', uid).order('saved_at', { ascending: false }),
      w.supabase.from('topic_scores').select('topic_id,score').eq('user_id', uid),
      w.supabase.from('profiles').select('interests').eq('id', uid).maybeSingle(),
    ])

    const swipeRows = swipes.data ?? []
    const savedRows = saved.data ?? []
    const scoreRows = scores.data ?? []
    if (!swipeRows.length && !savedRows.length && !scoreRows.length) return null

    return {
      seen: swipeRows.map((r) => r.card_id),
      swipes: swipeRows.map((r) => ({ cardId: r.card_id, action: r.action, ts: 0 })),
      kept: savedRows.map((r) => r.card_id),
      topicScores: Object.fromEntries(scoreRows.map((r) => [r.topic_id, Number(r.score)])),
      interests: profile.data?.interests ?? null,
    }
  } catch {
    return null
  }
}

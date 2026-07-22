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

import { getClient, ensureUser } from './session.js'

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
    } else {
      await w.supabase
        .from('saved_cards')
        .delete()
        .eq('user_id', w.user.id)
        .eq('card_id', cardId)
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
    await w.supabase.from('topic_scores').upsert(rows, { onConflict: 'user_id,topic_id' })
  } catch {
    // as above
  }
}

/** Store the topics chosen at onboarding on the profile. */
export async function syncInterests(interests) {
  try {
    const w = await writer()
    if (!w) return
    await w.supabase.from('profiles').update({ interests }).eq('id', w.user.id)
  } catch {
    // as above
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
    const w = await writer()
    if (!w) return null
    const uid = w.user.id

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

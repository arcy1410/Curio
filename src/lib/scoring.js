// Additive topic-weight personalization — the "v1" the pitch describes.
// No ML: every swipe nudges a per-topic score, and the next card is drawn
// with probability weighted toward higher-scoring topics. The effect is meant
// to be *visible* after ~10–15 swipes, which the UI surfaces directly.

import { TOPICS } from '../data/topics.js'

// Tuning knobs — deliberately punchy so the shift is observable quickly.
// The score ladder (spec §4): Pass −1 · Interested +3 · feed-Save +5
// (Discover saves apply the plain +3 'interested' delta).
const KEEP_DELTA = 3
const PASS_DELTA = -1
const SAVE_DELTA = 5 // saving is the costlier, more deliberate signal
const ONBOARD_BONUS = 4 // interests chosen at onboarding start ahead
const FLOOR = 0.15 // every topic keeps a small chance so the feed never collapses

export function initialScores(interests = []) {
  const scores = {}
  for (const t of TOPICS) scores[t.id] = 0
  for (const id of interests) scores[id] = (scores[id] ?? 0) + ONBOARD_BONUS
  return scores
}

// An action nudges the topic's score along the ladder:
// 'pass' −1 · 'interested' +3 · 'save' +5 (feed save — supersedes the +3,
// never stacks with it). Discover saves pass 'interested' for their +3.
export function applySwipe(scores, topicId, action) {
  const next = { ...scores }
  const delta = action === 'pass' ? PASS_DELTA : action === 'save' ? SAVE_DELTA : KEEP_DELTA
  next[topicId] = (next[topicId] ?? 0) + delta
  return next
}

/**
 * R7 — a newly added topic jumps straight to PARITY with the user's current
 * favourite, not to a token bonus on top of its own score.
 *
 * The difference is the whole requirement. A +4 nudge is meaningless against
 * weeks of tuning: someone at cricket 40 who adds history moves history from
 * 0 to 4 and still sees cricket ~10x more often, so the edit they just made
 * appears to have done nothing. Parity means the new topic competes with the
 * strongest one immediately.
 *
 * The max is taken BEFORE any assignment, so adding two topics at once puts
 * both at parity with the existing favourite rather than the first one
 * bootstrapping the second.
 *
 * Re-adding a removed topic follows the same rule; re-selecting a topic the
 * user already has is not an "add" and grants nothing (no bonus farming).
 */
export function addInterestBonus(scores, addedIds = []) {
  const next = { ...scores }
  if (!addedIds.length) return next

  const currentMax = Math.max(0, ...TOPICS.map((t) => scores[t.id] ?? 0))
  const target = Math.max(currentMax, ONBOARD_BONUS)
  for (const id of addedIds) {
    // Never lower a score: a topic that somehow already sits above the max
    // keeps what it earned.
    next[id] = Math.max(next[id] ?? 0, target)
  }
  return next
}

// Turn raw scores into positive selection weights.
function weightFor(scores, topicId) {
  const raw = scores[topicId] ?? 0
  // shift so negatives don't vanish entirely, then floor
  return Math.max(FLOOR, raw + 1)
}

// Pick the next card from `pool` (unseen cards), weighted by topic score.
// `rng` is injectable for deterministic tests.
export function pickNextCard(pool, scores, rng = Math.random) {
  if (pool.length === 0) return null
  const weighted = pool.map((card) => ({ card, w: weightFor(scores, card.topic) }))
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = rng() * total
  for (const { card, w } of weighted) {
    r -= w
    if (r <= 0) return card
  }
  return weighted[weighted.length - 1].card
}

// Normalised distribution for the UI meter: { topicId: 0..1 } summing to 1.
export function topicDistribution(scores) {
  const weights = TOPICS.map((t) => ({ id: t.id, w: weightFor(scores, t.id) }))
  const total = weights.reduce((s, x) => s + x.w, 0) || 1
  return Object.fromEntries(weights.map((x) => [x.id, x.w / total]))
}

// The single topic the feed is currently leaning toward (highest score).
export function topTopic(scores) {
  let best = null
  let bestVal = -Infinity
  for (const t of TOPICS) {
    const v = scores[t.id] ?? 0
    if (v > bestVal) {
      bestVal = v
      best = t.id
    }
  }
  return best
}

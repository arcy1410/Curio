// Additive topic-weight personalization — the "v1" the pitch describes.
// No ML: every swipe nudges a per-topic score, and the next card is drawn
// with probability weighted toward higher-scoring topics. The effect is meant
// to be *visible* after ~10–15 swipes, which the UI surfaces directly.

import { TOPICS } from '../data/topics.js'

// Tuning knobs — deliberately punchy so the shift is observable quickly.
const KEEP_DELTA = 3
const PASS_DELTA = -1
const ONBOARD_BONUS = 4 // interests chosen at onboarding start ahead
const FLOOR = 0.15 // every topic keeps a small chance so the feed never collapses

export function initialScores(interests = []) {
  const scores = {}
  for (const t of TOPICS) scores[t.id] = 0
  for (const id of interests) scores[id] = (scores[id] ?? 0) + ONBOARD_BONUS
  return scores
}

export function applySwipe(scores, topicId, action) {
  const next = { ...scores }
  next[topicId] = (next[topicId] ?? 0) + (action === 'keep' ? KEEP_DELTA : PASS_DELTA)
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

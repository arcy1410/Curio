// Spaced repetition — the "Fading / Solid / New" states in the Kept library.
//
// Why this exists at all: Curio's North Star is cards kept AND RETAINED. A
// Kept pile that is only a list of things you once liked measures the first
// half and pretends it's the whole thing. Decay is what makes "retained"
// observable — a card you saved a month ago and never revisited is, honestly,
// not retained.
//
// Deliberately simple (Leitner-style intervals, not SM-2). The product has no
// grading UI — a reader either revisits a card or doesn't — so an algorithm
// tuned on self-graded recall quality would be modelling data we don't have.
// Intervals double on each successful review, which is the part of spaced
// repetition that actually does the work.

const DAY = 86_400_000

// Interval ladder in days. Index = how many times the card has been reviewed.
const INTERVALS = [1, 3, 7, 16, 35, 90]

export const STRENGTH = {
  NEW: 'new',
  SOLID: 'solid',
  FADING: 'fading',
}

/** Days until this card is due. Negative = overdue. */
export function daysUntilDue(card, now = Date.now()) {
  const reviews = card.reviewCount ?? 0
  const last = card.lastReviewedAt ?? card.savedAt ?? now
  const interval = INTERVALS[Math.min(reviews, INTERVALS.length - 1)]
  return (last + interval * DAY - now) / DAY
}

/**
 * How well is this card held?
 *
 * NEW    — saved, never reviewed, and not yet due. Nothing to say about it.
 * SOLID  — reviewed at least once and not yet due.
 * FADING — due or overdue. This is the only state that asks for action.
 *
 * A card is never called "mastered": we can observe revisits, not memory,
 * and labelling a guess as knowledge would be the same overclaim the verify
 * step exists to prevent elsewhere in the product.
 */
export function strengthOf(card, now = Date.now()) {
  if (daysUntilDue(card, now) <= 0) return STRENGTH.FADING
  return (card.reviewCount ?? 0) > 0 ? STRENGTH.SOLID : STRENGTH.NEW
}

/** Cards needing review, most overdue first. */
export function dueCards(cards = [], now = Date.now()) {
  return cards
    .filter((c) => strengthOf(c, now) === STRENGTH.FADING)
    .sort((a, b) => daysUntilDue(a, now) - daysUntilDue(b, now))
}

/** Record a review: advances the interval and resets the clock. */
export function markReviewed(meta = {}, now = Date.now()) {
  return {
    ...meta,
    reviewCount: (meta.reviewCount ?? 0) + 1,
    lastReviewedAt: now,
  }
}

/**
 * A human phrase for when this comes back.
 * Vague on purpose past a week — "in 2 weeks" is honest, "on the 14th" implies
 * a precision the schedule doesn't have.
 */
export function dueLabel(card, now = Date.now()) {
  const d = daysUntilDue(card, now)
  if (d <= 0) return 'Ready to review'
  if (d < 1) return 'Back tomorrow'
  if (d < 2) return 'Back in a day'
  if (d < 7) return `Back in ${Math.round(d)} days`
  if (d < 14) return 'Back next week'
  if (d < 60) return `Back in ${Math.round(d / 7)} weeks`
  return 'Back in a couple of months'
}

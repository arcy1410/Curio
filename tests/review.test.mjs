// Spaced repetition states. The rule worth testing is that intervals actually
// lengthen with each review — that's the mechanism doing the work, and an
// implementation that quietly keeps a fixed interval would still "pass" a
// naive state-label test.

import {
  strengthOf,
  daysUntilDue,
  dueCards,
  markReviewed,
  dueLabel,
  STRENGTH,
} from '../src/lib/review.js'

const DAY = 86_400_000
const NOW = 1_800_000_000_000 // fixed clock — no Date.now() in assertions

let pass = 0
let fail = 0
function check(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name} ${extra}`)
  }
}

// ── States ──
{
  const fresh = { savedAt: NOW }
  check('a just-saved card is NEW', strengthOf(fresh, NOW) === STRENGTH.NEW)

  const old = { savedAt: NOW - 5 * DAY }
  check('an unreviewed card past its interval is FADING', strengthOf(old, NOW) === STRENGTH.FADING)

  const reviewed = { savedAt: NOW - 5 * DAY, reviewCount: 1, lastReviewedAt: NOW }
  check('a just-reviewed card is SOLID', strengthOf(reviewed, NOW) === STRENGTH.SOLID)
}

// ── Intervals lengthen — the actual mechanism ──
{
  let meta = { savedAt: NOW }
  const first = daysUntilDue(meta, NOW)

  meta = markReviewed(meta, NOW)
  const second = daysUntilDue(meta, NOW)

  meta = markReviewed(meta, NOW)
  const third = daysUntilDue(meta, NOW)

  check('each review pushes the next one further out',
    second > first && third > second, `${first} → ${second} → ${third}`)
  check('the first interval is a day', Math.round(first) === 1, `${first}`)
}

// ── Reviewing clears the FADING state ──
{
  const overdue = { savedAt: NOW - 30 * DAY }
  check('overdue card is FADING', strengthOf(overdue, NOW) === STRENGTH.FADING)
  const after = markReviewed(overdue, NOW)
  check('reviewing it makes it SOLID', strengthOf(after, NOW) === STRENGTH.SOLID)
}

// ── Due list ordering ──
{
  const cards = [
    { id: 'a', savedAt: NOW - 2 * DAY },
    { id: 'b', savedAt: NOW - 40 * DAY },
    { id: 'c', savedAt: NOW }, // not due
  ]
  const due = dueCards(cards, NOW)
  check('only due cards are listed', due.length === 2, `${due.length}`)
  check('most overdue comes first', due[0].id === 'b', due[0]?.id)
}

// ── Labels stay honest ──
{
  check('a due card says so', dueLabel({ savedAt: NOW - 10 * DAY }, NOW) === 'Ready to review')
  const far = { savedAt: NOW, reviewCount: 5, lastReviewedAt: NOW }
  check('a long interval is described vaguely, not with a false date',
    /couple of months|weeks/.test(dueLabel(far, NOW)), dueLabel(far, NOW))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

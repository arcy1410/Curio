// R7 — a newly added topic must reach parity with the user's strongest
// interest, not receive a token bonus that weeks of tuning drown out.

import { initialScores, applySwipe, addInterestBonus, pickNextCard } from '../src/lib/scoring.js'

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

// A heavily-tuned user: lots of cricket interest built up over time.
let tuned = initialScores(['cricket'])
for (let i = 0; i < 12; i++) tuned = applySwipe(tuned, 'cricket', 'interested')
const maxBefore = Math.max(...Object.values(tuned))

// ── Parity, not a token bonus ──
{
  const after = addInterestBonus(tuned, ['history'])
  check('new topic reaches the current maximum', after.history === maxBefore, `${after.history} vs ${maxBefore}`)
  check('new topic is not merely +4', after.history > 4, `${after.history}`)
  check('existing scores are untouched', after.cricket === tuned.cricket, `${after.cricket}`)
}

// ── Two topics added at once both reach parity ──
{
  const after = addInterestBonus(tuned, ['history', 'bollywood'])
  check(
    'both added topics reach parity with the pre-existing max',
    after.history === maxBefore && after.bollywood === maxBefore,
    `${after.history}/${after.bollywood} vs ${maxBefore}`
  )
}

// ── A brand-new user still gets the onboarding head start ──
{
  const fresh = initialScores([])
  const after = addInterestBonus(fresh, ['markets'])
  check('with no history, parity floors at the +4 head start', after.markets === 4, `${after.markets}`)
}

// ── No bonus farming, and never a downgrade ──
{
  const after = addInterestBonus(tuned, [])
  check('adding nothing changes nothing', JSON.stringify(after) === JSON.stringify(tuned))

  const twice = addInterestBonus(addInterestBonus(tuned, ['history']), ['history'])
  const once = addInterestBonus(tuned, ['history'])
  check('re-adding the same topic grants nothing further', twice.history === once.history, `${twice.history}`)

  const leader = addInterestBonus(tuned, ['cricket'])
  check('a topic above the max is never lowered', leader.cricket === tuned.cricket, `${leader.cricket}`)
}

// ── Parity actually changes what gets served ──
{
  const pool = [
    { id: 'c1', topic: 'cricket' },
    { id: 'h1', topic: 'history' },
  ]
  // Deterministic rng sweep: count how often history is drawn, before/after.
  const share = (scores) => {
    let hits = 0
    const N = 200
    for (let i = 0; i < N; i++) {
      const r = (i + 0.5) / N
      if (pickNextCard(pool, scores, () => r).topic === 'history') hits++
    }
    return hits / N
  }
  const before = share(tuned)
  const after = share(addInterestBonus(tuned, ['history']))
  check('a token bonus would leave history rare', before < 0.15, `${before}`)
  check('parity gives the new topic a real share', after > 0.4, `${after}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

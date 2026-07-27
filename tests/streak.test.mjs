// Streak rules. The grace day and the "today isn't a miss yet" rule are the
// two places a naive implementation gets this wrong, and both are the ones
// that decide whether the mechanic feels fair or punishing.

import {
  currentStreak,
  longestStreak,
  lastSevenDays,
  recordCardDone,
  todayState,
  goalCards,
} from '../src/lib/streak.js'

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

const GOAL = 1 // "A habit" = 5 cards
const N = goalCards(GOAL)

// Helper: build progress for a list of days, each meeting the goal.
const met = (...days) => Object.fromEntries(days.map((d) => [d, N]))

// ── Consecutive days count ──
{
  const p = met('2026-07-20', '2026-07-21', '2026-07-22')
  check('three consecutive finished days = 3', currentStreak(p, GOAL, '2026-07-22') === 3,
    `${currentStreak(p, GOAL, '2026-07-22')}`)
}

// ── Today being unfinished is NOT a miss ──
{
  const p = met('2026-07-20', '2026-07-21')
  check(
    "an unfinished today doesn't break yesterday's streak",
    currentStreak(p, GOAL, '2026-07-22') === 2,
    `${currentStreak(p, GOAL, '2026-07-22')}`
  )
}

// ── A partial day does not count ──
{
  const p = { ...met('2026-07-20'), '2026-07-21': N - 1 }
  check('a partially finished day does not count', currentStreak(p, GOAL, '2026-07-21') === 1,
    `${currentStreak(p, GOAL, '2026-07-21')}`)
}

// ── One grace day is forgiven ──
{
  // 18th, 19th done; 20th MISSED; 21st done. Today = 21st.
  const p = met('2026-07-18', '2026-07-19', '2026-07-21')
  check('a single missed day is forgiven, not fatal', currentStreak(p, GOAL, '2026-07-21') === 3,
    `${currentStreak(p, GOAL, '2026-07-21')}`)
}

// ── Two missed days end it ──
{
  // 17th, 18th done; 19th and 20th MISSED; 21st done.
  const p = met('2026-07-17', '2026-07-18', '2026-07-21')
  check('two consecutive misses end the streak', currentStreak(p, GOAL, '2026-07-21') === 1,
    `${currentStreak(p, GOAL, '2026-07-21')}`)
}

// ── Grace can't resurrect from nothing ──
{
  check('no history means no streak', currentStreak({}, GOAL, '2026-07-22') === 0)
}

// ── Exceeding the goal earns nothing extra ──
{
  const modest = met('2026-07-21', '2026-07-22')
  const heavy = { '2026-07-21': N * 4, '2026-07-22': N * 4 }
  check(
    'exceeding the goal is not rewarded',
    currentStreak(modest, GOAL, '2026-07-22') === currentStreak(heavy, GOAL, '2026-07-22'),
    'over-delivery should not extend a streak'
  )
}

// ── Longest ──
{
  const p = met('2026-07-01', '2026-07-02', '2026-07-03', '2026-07-20', '2026-07-21')
  check('longest streak looks across all history', longestStreak(p, GOAL) >= 3, `${longestStreak(p, GOAL)}`)
}

// ── Seven-day strip ──
{
  const p = met('2026-07-22')
  const week = lastSevenDays(p, GOAL, '2026-07-22')
  check('strip is 7 days, oldest first', week.length === 7 && week[6].isToday)
  check('today is marked complete when the goal is met', week[6].complete === true)
  check('earlier empty days are incomplete', week[0].complete === false)
}

// ── Recording + today state ──
{
  let p = {}
  for (let i = 0; i < N; i++) p = recordCardDone(p, '2026-07-22')
  const st = todayState(p, GOAL, '2026-07-22')
  check('recording N cards completes the set', st.complete && st.remaining === 0, JSON.stringify(st))

  const partial = todayState(recordCardDone({}, '2026-07-22'), GOAL, '2026-07-22')
  check('remaining counts down correctly', partial.remaining === N - 1, `${partial.remaining}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

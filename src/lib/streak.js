// Daily set + streak (redesign).
//
// ── The ethics position, decided deliberately (NG3) ──
// A streak is a persuasive mechanic, and the course is explicit that the PM
// owns what the product does TO the user. Curio keeps one because finishing a
// small set is a real signal of the habit we claim to build — but it is built
// to reward completion, never to punish absence:
//
//   • The goal is small and user-chosen (3/5/10). "A taste" is a legitimate
//     choice, not a lesser one.
//   • ONE grace day. Missing a single day does not zero a long streak, which
//     is the loss-aversion lever most streak designs are actually built on.
//   • Finishing the set is where the set ENDS. No "one more?" prompt, no
//     bonus for exceeding the goal — exceeding it is not rewarded at all.
//   • No streak notifications. We never contact someone to protect a number.
//   • The streak is DERIVED from activity, never a stored counter that could
//     be inflated. It cannot be gamed because there is nothing to game.
//
// The guardrail that watches this is session length (already tracked): if
// streaks start producing longer sessions rather than more regular short
// ones, the mechanic is doing harm and should be revisited.

/** Local calendar day, not UTC — a streak is about the user's own days. */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function previousDay(key) {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export const GOALS = [
  { cards: 3, name: 'A taste', minutes: 2 },
  { cards: 5, name: 'A habit', minutes: 4 },
  { cards: 10, name: 'A deep dive', minutes: 9 },
]

/** Cards needed today, from the stored goal index. */
export function goalCards(goalIndex = 1) {
  return (GOALS[goalIndex] ?? GOALS[1]).cards
}

/**
 * How many cards were finished on a given day.
 * `progress` is { 'YYYY-MM-DD': count } — small, and cheap to sync.
 */
export function doneOn(progress, key) {
  return progress?.[key] ?? 0
}

/**
 * The current streak, DERIVED from daily progress.
 *
 * Counts back from today (or yesterday, if today isn't finished yet — a
 * streak shouldn't read as broken at 9am before you've opened the app).
 * One non-qualifying day is forgiven; a second ends the streak.
 */
export function currentStreak(progress = {}, goalIndex = 1, today = dayKey()) {
  const need = goalCards(goalIndex)
  const met = (key) => doneOn(progress, key) >= need

  // Start from today if it's already done, else from yesterday — today being
  // incomplete is not yet a miss.
  let cursor = met(today) ? today : previousDay(today)
  let streak = 0
  let graceUsed = false

  while (true) {
    if (met(cursor)) {
      streak++
      cursor = previousDay(cursor)
      continue
    }
    // A single missed day is forgiven, and does not itself count as a day.
    if (!graceUsed && streak > 0) {
      graceUsed = true
      cursor = previousDay(cursor)
      continue
    }
    break
  }
  return streak
}

/** The best streak ever reached — computed over the whole history. */
export function longestStreak(progress = {}, goalIndex = 1) {
  const days = Object.keys(progress ?? {}).sort()
  if (!days.length) return 0
  let best = 0
  for (const day of days) {
    const s = currentStreak(progress, goalIndex, day)
    if (s > best) best = s
  }
  return best
}

/**
 * The last 7 days for the profile strip, oldest → newest.
 * Each entry: { key, initial, done, isToday, complete }.
 */
export function lastSevenDays(progress = {}, goalIndex = 1, today = dayKey()) {
  const need = goalCards(goalIndex)
  const out = []
  let cursor = today
  for (let i = 0; i < 7; i++) {
    out.unshift(cursor)
    cursor = previousDay(cursor)
  }
  return out.map((key) => {
    const d = new Date(`${key}T00:00:00Z`)
    return {
      key,
      initial: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getUTCDay()],
      done: doneOn(progress, key),
      isToday: key === today,
      complete: doneOn(progress, key) >= need,
    }
  })
}

/** Record one finished card against today. Returns the next progress map. */
export function recordCardDone(progress = {}, today = dayKey()) {
  return { ...progress, [today]: (progress?.[today] ?? 0) + 1 }
}

/**
 * Today's set state, for the feed header.
 * `justCompleted` is true only on the transition, so the toast fires once.
 */
export function todayState(progress = {}, goalIndex = 1, today = dayKey()) {
  const need = goalCards(goalIndex)
  const done = doneOn(progress, today)
  return { done, need, complete: done >= need, remaining: Math.max(0, need - done) }
}

// Exercises the R5 dwell rules directly, with a stubbed IntersectionObserver
// and a controllable visibilityState. Threshold shortened so the test is fast;
// the rules under test are the same.

let listeners = []
let visibility = 'visible'
let ioCallback = null
const observed = new Set()

globalThis.document = {
  get visibilityState() {
    return visibility
  },
  addEventListener: (t, fn) => t === 'visibilitychange' && listeners.push(fn),
  removeEventListener: (t, fn) => {
    listeners = listeners.filter((f) => f !== fn)
  },
}
globalThis.IntersectionObserver = class {
  constructor(cb) {
    ioCallback = cb
  }
  observe(el) {
    observed.add(el)
  }
  unobserve(el) {
    observed.delete(el)
  }
  disconnect() {
    observed.clear()
  }
}

function setVisibility(v) {
  visibility = v
  listeners.forEach((fn) => fn())
}
function intersect(el, ratio) {
  ioCallback([{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio }])
}
const el = (id) => ({ dataset: { cardId: id } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { createDwellTracker } = await import('../src/lib/dwell.js')

const THRESHOLD = 600
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

// ── 1. Fully visible for the full threshold → marked once ──
{
  const reads = []
  const t = createDwellTracker((id, ms) => reads.push({ id, ms }), { thresholdMs: THRESHOLD, tickMs: 30 })
  const a = el('a')
  t.observe(a, 'a')
  intersect(a, 1)
  await sleep(THRESHOLD * 0.5)
  check('not marked before threshold', reads.length === 0, `got ${reads.length}`)
  await sleep(THRESHOLD * 0.9)
  check('marked after threshold', reads.length === 1, JSON.stringify(reads))
  check('dwell_ms is plausible', reads[0]?.ms >= THRESHOLD, `${reads[0]?.ms}`)
  await sleep(THRESHOLD)
  check('never fires twice for one card', reads.length === 1, `${reads.length}`)
  t.disconnect()
}

// ── 2. Backgrounding pauses, and banked time is NOT lost ──
{
  const reads = []
  const t = createDwellTracker((id, ms) => reads.push({ id, ms }), { thresholdMs: THRESHOLD, tickMs: 30 })
  const b = el('b')
  t.observe(b, 'b')
  intersect(b, 1)
  await sleep(THRESHOLD * 0.6) // bank ~60%
  setVisibility('hidden')
  await sleep(THRESHOLD * 1.5) // long background — must count for nothing
  check('background time does not count', reads.length === 0, `${reads.length}`)
  setVisibility('visible')
  await sleep(THRESHOLD * 0.6) // the remaining ~40%, plus slack
  check('banked time resumes rather than restarting', reads.length === 1, `${reads.length}`)
  t.disconnect()
}

// ── 3. Scrolled mostly off screen does not accumulate ──
{
  const reads = []
  const t = createDwellTracker((id, ms) => reads.push({ id, ms }), { thresholdMs: THRESHOLD, tickMs: 30 })
  const c = el('c')
  t.observe(c, 'c')
  intersect(c, 0.2) // under the 0.5 "in viewport" bar
  await sleep(THRESHOLD * 1.6)
  check('partially visible card is not marked', reads.length === 0, `${reads.length}`)
  intersect(c, 0.9)
  await sleep(THRESHOLD * 1.2)
  check('marked once genuinely in view', reads.length === 1, `${reads.length}`)
  t.disconnect()
}

// ── 4. Rapid scroll-past accumulates almost nothing ──
{
  const reads = []
  const t = createDwellTracker((id, ms) => reads.push({ id, ms }), { thresholdMs: THRESHOLD, tickMs: 30 })
  const d = el('d')
  t.observe(d, 'd')
  for (let i = 0; i < 6; i++) {
    intersect(d, 1)
    await sleep(40)
    intersect(d, 0)
    await sleep(40)
  }
  check('scroll-past never marks (bias to unmarked)', reads.length === 0, `${reads.length}`)
  t.disconnect()
}

// ── 5. Cards already read never re-fire ──
{
  const reads = []
  const t = createDwellTracker((id, ms) => reads.push({ id, ms }), { thresholdMs: THRESHOLD, tickMs: 30 })
  t.markDone(['e'])
  const e = el('e')
  t.observe(e, 'e')
  intersect(e, 1)
  await sleep(THRESHOLD * 1.6)
  check('already-read card does not re-fire', reads.length === 0, `${reads.length}`)
  t.disconnect()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

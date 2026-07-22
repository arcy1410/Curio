// R5 — "seen" in Discover means 30 continuous seconds of ACTIVE FOREGROUND
// time, not 30 seconds of wall clock.
//
// The distinction is the whole rule. A card left on screen while the user
// answers a phone call has not been read, and counting that time would retire
// a card from their feed that they never actually saw. So the timer stops when
// the tab is hidden and resumes when it comes back, and time already banked is
// kept rather than restarted — someone who reads for 20s, takes a call, and
// comes back for 10s has genuinely read the card.
//
// The bias, per R5 and E4, is toward NOT marking: an occasional duplicate
// re-serve is much cheaper than silently burning a card from a small pool. So
// the timer only runs while a majority of the card is on screen, and anything
// ambiguous simply fails to reach the threshold.

const THRESHOLD_MS = 30_000
const VISIBLE_RATIO = 0.5 // "in viewport" means at least half of it
const TICK_MS = 1000

/**
 * Track dwell across a set of elements.
 *
 * onRead(cardId, dwellMs) fires once per card, the moment it crosses the
 * threshold. Returns { observe, disconnect }.
 */
export function createDwellTracker(onRead, { thresholdMs = THRESHOLD_MS, tickMs = TICK_MS } = {}) {
  // cardId -> { el, visible, banked, since }
  const entries = new Map()
  const done = new Set()
  let timer = null

  const foreground = () => document.visibilityState === 'visible'

  /** Bank the time accumulated so far and stop the clock for this entry. */
  function pause(e, now) {
    if (e.since != null) {
      e.banked += now - e.since
      e.since = null
    }
  }

  function resume(e, now) {
    if (e.since == null && e.visible && foreground()) e.since = now
  }

  function tick() {
    const now = Date.now()
    for (const [id, e] of entries) {
      if (done.has(id)) continue
      const total = e.banked + (e.since != null ? now - e.since : 0)
      if (total >= thresholdMs) {
        done.add(id)
        pause(e, now)
        observer?.unobserve(e.el)
        onRead(id, Math.round(total))
      }
    }
  }

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (records) => {
            const now = Date.now()
            for (const r of records) {
              const id = r.target.dataset.cardId
              const e = entries.get(id)
              if (!e || done.has(id)) continue
              e.visible = r.isIntersecting && r.intersectionRatio >= VISIBLE_RATIO
              if (e.visible) resume(e, now)
              else pause(e, now)
            }
          },
          { threshold: [0, VISIBLE_RATIO, 1] }
        )

  function onVisibilityChange() {
    const now = Date.now()
    for (const [id, e] of entries) {
      if (done.has(id)) continue
      if (foreground()) resume(e, now)
      else pause(e, now) // backgrounded: bank what's earned, count nothing more
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  timer = setInterval(tick, tickMs)

  return {
    /** Attach an element for a card. Safe to call repeatedly. */
    observe(el, cardId) {
      if (!el || !observer || done.has(cardId)) return
      el.dataset.cardId = cardId
      if (!entries.has(cardId)) entries.set(cardId, { el, visible: false, banked: 0, since: null })
      else entries.get(cardId).el = el
      observer.observe(el)
    },
    /** Pre-seed cards already read, so they never re-fire. */
    markDone(ids) {
      for (const id of ids ?? []) done.add(id)
    },
    disconnect() {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      observer?.disconnect()
      entries.clear()
    },
  }
}

export { THRESHOLD_MS }

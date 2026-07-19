// Haptic feedback helpers. Uses the Web Vibration API, which fires on Android
// Chrome and other supporting browsers; it's a harmless no-op where unsupported
// (notably iOS Safari, which doesn't expose navigator.vibrate). Every UI tap
// routes through one of these so the app feels physical where the hardware allows.

function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    // ignore — vibration is a progressive enhancement
  }
}

export const haptic = {
  tap: () => buzz(8), // generic light tap
  select: () => buzz(16), // toggling a choice
  nav: () => buzz(6), // switching tabs
  keep: () => buzz([14, 40, 26]), // happy "saved!" double pulse
  pass: () => buzz(12), // dismissive single tick
  success: () => buzz([10, 30, 10]), // posted a comment, etc.
  error: () => buzz([30, 45, 30]), // rejected input
  open: () => buzz(10), // sheet / modal open
}

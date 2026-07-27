// Theme (redesign): light is the default, dark mirrors it.
//
// The token sets live in index.css under :root[data-theme='...'], so switching
// is a single attribute flip — no component re-render, no flash of the wrong
// palette on a re-mount.
//
// Applied before React paints (see main.jsx) because the alternative is a
// visible cream→green flash on every load for dark-mode users.

const KEY = 'curio.theme'

/**
 * The stored preference, or light.
 *
 * Light is the DEFAULT, deliberately — not the OS preference. Curio's design
 * is a light, editorial, cream-paper thing; the dark palette is a mirror of it
 * rather than an equal twin. Following prefers-color-scheme meant every user
 * on a dark-mode phone met the product in its secondary skin and never saw
 * what it actually looks like. Dark is one tap away in You for anyone who
 * wants it, and that choice then persists.
 */
export function storedTheme() {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    // private mode / storage disabled — light is still the right answer
  }
  return 'light'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Keep the mobile browser chrome in step with the app background.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#07231A' : '#F7F4D5')
}

export function setTheme(theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // preference just won't persist; the app still works
  }
}

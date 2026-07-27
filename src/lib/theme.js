// Theme (redesign): light is the default, dark mirrors it.
//
// The token sets live in index.css under :root[data-theme='...'], so switching
// is a single attribute flip — no component re-render, no flash of the wrong
// palette on a re-mount.
//
// Applied before React paints (see main.jsx) because the alternative is a
// visible cream→green flash on every load for dark-mode users.

const KEY = 'curio.theme'

export function storedTheme() {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    // private mode / storage disabled — fall through to the system preference
  }
  // Respect the OS setting the first time; after that the user's choice wins.
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
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

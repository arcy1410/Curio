// A few seeded comments so threads don't feel empty in the prototype demo.
// User-added comments live in app state; these are merged in read-only.
// Times are relative offsets (minutes ago) resolved at render, kept small so
// they read as "recent" without needing a real timestamp at build time.

export const DEMO_COMMENTS = {
  'ckt-1983-final': [
    {
      id: 'd1',
      author: 'Rohan',
      text: 'My dad still talks about watching this on a borrowed TV. Goosebumps.',
      minsAgo: 42,
      parentId: null,
    },
    {
      id: 'd2',
      author: 'Ananya',
      text: 'That Kapil catch to get Richards is the whole match in one moment.',
      minsAgo: 30,
      parentId: 'd1',
    },
  ],
  'mkt-rule72': [
    {
      id: 'd3',
      author: 'Vikram',
      text: 'Wish someone taught me this at 18 instead of at 30 😅',
      minsAgo: 120,
      parentId: null,
    },
  ],
  'his-zero': [
    {
      id: 'd4',
      author: 'Meera',
      text: 'Brahmagupta doesn\'t get nearly enough credit for this.',
      minsAgo: 88,
      parentId: null,
    },
  ],
}

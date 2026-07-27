// Fixed topic list for onboarding. Each top-level topic has sub-topics.
// For the prototype, personalization scores are tracked at the top-level `id`.

export const TOPICS = [
  {
    id: 'cricket',
    name: 'Cricket',
    emoji: '🏏',
    color: '#105666', // midnight green
    onColor: '#F7F4D5',
    blurb: 'The game that stops the country.',
    subtopics: ['Indian Cricket', 'World Cups', 'IPL', 'Records'],
  },
  {
    id: 'markets',
    name: 'Markets',
    emoji: '📈',
    color: '#839958', // moss
    onColor: '#14281B', // beige on moss is ~2:1 — too low to read
    blurb: 'Money, mania, and how it all moves.',
    subtopics: ['Stock Market', 'Personal Finance', 'Scandals'],
  },
  {
    id: 'bollywood',
    name: 'Bollywood',
    emoji: '🎬',
    color: '#D3968C', // rosy brown
    onColor: '#3A1B15', // the handoff's own rule: never white on rose
    blurb: 'A century of song, spectacle and stars.',
    subtopics: ['Classics', 'Awards', 'Behind the Scenes'],
  },
  {
    id: 'history',
    name: 'History',
    emoji: '🏛️',
    color: '#0A3323', // dark green
    onColor: '#F7F4D5',
    blurb: 'Where the subcontinent came from.',
    subtopics: ['Ancient India', 'Medieval India', 'Science & Math'],
  },
]

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]))

export function topicName(id) {
  return TOPIC_BY_ID[id]?.name ?? id
}

export function topicEmoji(id) {
  return TOPIC_BY_ID[id]?.emoji ?? '•'
}

export function topicColor(id) {
  return TOPIC_BY_ID[id]?.color ?? '#105666'
}

/** Legible text colour for a filled tile of this topic's colour. */
export function topicOnColor(id) {
  return TOPIC_BY_ID[id]?.onColor ?? '#F7F4D5'
}

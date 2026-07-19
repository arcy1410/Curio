// Fixed topic list for onboarding. Each top-level topic has sub-topics.
// For the prototype, personalization scores are tracked at the top-level `id`.

export const TOPICS = [
  {
    id: 'cricket',
    name: 'Cricket',
    emoji: '🏏',
    color: '#3ddc84', // neon green
    blurb: 'The game that stops the country.',
    subtopics: ['Indian Cricket', 'World Cups', 'IPL', 'Records'],
  },
  {
    id: 'markets',
    name: 'Markets',
    emoji: '📈',
    color: '#ffb020', // amber
    blurb: 'Money, mania, and how it all moves.',
    subtopics: ['Stock Market', 'Personal Finance', 'Scandals'],
  },
  {
    id: 'bollywood',
    name: 'Bollywood',
    emoji: '🎬',
    color: '#ff4d8d', // hot pink
    blurb: 'A century of song, spectacle and stars.',
    subtopics: ['Classics', 'Awards', 'Behind the Scenes'],
  },
  {
    id: 'history',
    name: 'History',
    emoji: '🏛️',
    color: '#43b7ff', // electric blue
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
  return TOPIC_BY_ID[id]?.color ?? '#ff6a3d'
}

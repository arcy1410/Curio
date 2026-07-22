// Thin localStorage persistence layer for the prototype.
// Separate key so it survives resets.
const USER_ID_KEY = 'curio.userId'

export function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = `curio_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}
// In production this state lives in Supabase (users, swipes, topic_scores,
// comments). Keeping the shape close to those tables makes the swap easy.

const KEY = 'curio.state.v1'

const DEFAULT_STATE = {
  onboarded: false,
  interests: [], // topic ids chosen at onboarding
  topicScores: {}, // { topicId: number }
  swipes: [], // { cardId, action: 'keep' | 'pass', ts }
  kept: [], // cardIds swiped right, most-recent first
  seen: [], // cardIds already shown (keep or pass)
  comments: {}, // { cardId: [{ id, text, ts, parentId }] }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore quota / private-mode errors in the prototype
  }
}

export function resetState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

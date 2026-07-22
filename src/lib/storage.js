// Thin localStorage persistence layer for the prototype.
// In production this state lives in Supabase (users, swipes, topic_scores,
// comments). Keeping the shape close to those tables makes the swap easy.

const KEY = 'curio.state.v1'

// Interaction-semantics version (spec R8). Bump whenever a release changes
// what an existing gesture DOES, and ship a one-time migration notice.
//   v1 (implicit): right swipe = Keep (saved to pile)
//   v2: right swipe = Interested (no save); 🔖 Save saves and auto-advances
export const STATE_VERSION = 2

const DEFAULT_STATE = {
  stateVersion: STATE_VERSION,
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
    // Legacy detection BEFORE the default-spread: an onboarded state with no
    // stateVersion predates versioning (v1, "right swipe = Keep"). Without
    // this, the spread would stamp it v2 and the migration notice (R8)
    // could never fire.
    const version = parsed.stateVersion ?? (parsed.onboarded ? 1 : STATE_VERSION)
    return { ...DEFAULT_STATE, ...parsed, stateVersion: version }
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

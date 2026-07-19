// Basic profanity / spam filter for comments — a simple word-list, which the
// pitch scopes as "fine for MVP." Production would swap in a proper service.

const BLOCKLIST = [
  'damn',
  'hell',
  'crap',
  'idiot',
  'stupid',
  'moron',
  'shit',
  'fuck',
  'bastard',
  'ass',
  'bitch',
]

// crude spam heuristics
const URL_RE = /https?:\/\/|www\./i

export function checkComment(text) {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, reason: 'Comment is empty.' }
  if (trimmed.length > 500) return { ok: false, reason: 'Comment is too long (500 char max).' }
  if (URL_RE.test(trimmed)) return { ok: false, reason: 'Links aren\'t allowed in comments.' }

  const words = trimmed.toLowerCase().split(/[^a-z]+/)
  const hit = words.find((w) => BLOCKLIST.includes(w))
  if (hit) return { ok: false, reason: 'Please keep it civil — that word isn\'t allowed.' }

  return { ok: true }
}

// Soft-mask any blocked words, used as a fallback when displaying older content.
export function maskProfanity(text) {
  let out = text
  for (const w of BLOCKLIST) {
    const re = new RegExp(`\\b${w}\\b`, 'gi')
    out = out.replace(re, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)))
  }
  return out
}

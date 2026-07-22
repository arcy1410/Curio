// One-off (but idempotent) migration: hand-written seed cards → Supabase.
//
//   node scripts/migrate-seed-cards.mjs          # dry run, shows what would change
//   node scripts/migrate-seed-cards.mjs --apply  # writes to the database
//
// The 21 cards in src/data/cards.js were written and source-checked by hand.
// They're marked verified because a human did the verification the pipeline
// will later do with Haiku — so they satisfy G3 legitimately, and the
// verified_at timestamp records when that was recorded.
//
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local. The service
// role is required: only it can write cards (RLS grants clients read-only
// access to verified rows).

import { readFileSync } from 'node:fs'
import { CARDS } from '../src/data/cards.js'

const APPLY = process.argv.includes('--apply')

// ── env ──────────────────────────────────────────────────────
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

async function api(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`)
  return data
}

// ── resolve sub-topic labels to topic ids ────────────────────
// cards.js carries a human label ("World Cups"); the DB wants a slug
// ("cricket.worldcups"). Build the mapping from the topics table so the
// script can never drift from whatever is actually seeded there.
const topics = await api('/rest/v1/topics?select=id,name,parent_topic_id')
const subtopicId = new Map() // "cricket|World Cups" → "cricket.worldcups"
for (const t of topics) {
  if (t.parent_topic_id) subtopicId.set(`${t.parent_topic_id}|${t.name}`, t.id)
}

const existing = new Set(
  (await api('/rest/v1/cards?select=source_url')).map((c) => c.source_url)
)

const rows = []
const problems = []

for (const card of CARDS) {
  const subId = card.subtopic ? subtopicId.get(`${card.topic}|${card.subtopic}`) : null
  if (card.subtopic && !subId) {
    problems.push(`no sub-topic row for "${card.topic} › ${card.subtopic}" (card ${card.id})`)
    continue
  }
  if (existing.has(card.source_url)) continue // already migrated

  rows.push({
    topic_id: card.topic,
    subtopic_id: subId,
    title: card.title,
    body: card.body,
    source_url: card.source_url,
    source_type: 'wikipedia',
    verified: card.verified === true,
    // The CHECK constraint requires this whenever verified is true.
    verified_at: card.verified === true ? new Date().toISOString() : null,
    generator_model: 'hand-written',
    verifier_model: 'hand-checked',
    cost_usd: 0,
  })
}

console.log(`seed cards in src/data/cards.js : ${CARDS.length}`)
console.log(`already in database             : ${CARDS.length - rows.length - problems.length}`)
console.log(`to insert                       : ${rows.length}`)
if (problems.length) {
  console.log(`\nunmapped (skipped):`)
  for (const p of problems) console.log(`  ! ${p}`)
}

if (!rows.length) {
  console.log('\nNothing to do.')
  process.exit(problems.length ? 1 : 0)
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.')
  const byTopic = rows.reduce((a, r) => ((a[r.topic_id] = (a[r.topic_id] || 0) + 1), a), {})
  console.log('by topic:', byTopic)
  process.exit(0)
}

const inserted = await api('/rest/v1/cards', {
  method: 'POST',
  body: rows,
  prefer: 'return=representation',
})
console.log(`\ninserted ${inserted.length} cards.`)

const total = await api('/rest/v1/cards?select=id&verified=is.true')
console.log(`verified cards now in database  : ${total.length}`)

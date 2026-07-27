// Backfill the redesign's quiz layer onto cards that predate it.
//
// Grounded on each card's ORIGINAL source_url, re-fetched, not on the card
// body. That is what makes these equivalent to natively-generated quizzes
// rather than a summary of a summary: the quiz sees the same evidence the card
// was written from, so its answer can surface a detail the card compressed
// away — and the verifier can check it against that source like any other
// claim.
//
// Non-destructive by construction: it only ever UPDATEs quiz columns on
// existing rows. Card ids, titles, bodies and source urls are untouched, so
// nothing a user has kept or commented on breaks. This matters more than
// usual — the database is shared with the live site.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-quiz.mjs           # dry run
//   node --env-file=.env.local scripts/backfill-quiz.mjs --apply   # write
//   ... --limit 5     # do a few first

import { createClient } from '@supabase/supabase-js'
import { fetchWikipedia } from '../api/_lib/sources.js'
import { openaiGenerateQuiz, openaiVerifyCard } from '../api/_lib/openai.js'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** Re-fetch the prose a card was written from. */
async function sourceFor(card) {
  const url = card.source_url || ''
  const wiki = url.match(/en\.wikipedia\.org\/wiki\/([^#?]+)/)
  if (wiki) {
    const title = decodeURIComponent(wiki[1]).replace(/_/g, ' ')
    return fetchWikipedia(title)
  }
  // Guardian bodies aren't re-fetchable without replaying the search, and a
  // news URL goes stale anyway. Fall back to the card's own text: weaker
  // grounding, so it's reported honestly in the summary rather than hidden.
  return { title: card.title, text: card.body, url, type: 'card-body', degraded: true }
}

const { data: cards, error } = await db
  .from('cards')
  .select('id,title,body,source_url,topic_id,quiz_question')
  .is('quiz_question', null)
  .eq('verified', true)
  .order('created_at')
if (error) throw error

const todo = cards.slice(0, LIMIT)
console.log(`${cards.length} card(s) without a quiz; processing ${todo.length}`)
console.log(APPLY ? 'APPLY — writing to the database\n' : 'DRY RUN — nothing will be written\n')

let ok = 0
let failed = 0
let degraded = 0
let cost = 0

for (const card of todo) {
  const label = `[${card.topic_id}] ${card.title.slice(0, 44)}`
  try {
    const source = await sourceFor(card)
    if (!source || source.text.length < 200) {
      console.log(`SKIP  ${label} — no usable source`)
      failed++
      continue
    }
    if (source.degraded) degraded++

    const quiz = await openaiGenerateQuiz({ source, card })
    cost += quiz.cost

    // The quiz answer is shown to readers as fact, so it passes the same gate
    // as the card body — a quiz that invents a number is exactly the failure
    // the whole verify step exists to prevent.
    const check = await openaiVerifyCard({
      source,
      card: { title: quiz.quizQuestion, body: quiz.quizAnswer },
    })
    cost += check.cost

    if (!check.verified) {
      console.log(`FAIL  ${label}\n      unsupported: ${check.unsupportedClaims[0]?.slice(0, 70)}`)
      failed++
      continue
    }

    console.log(`OK    ${label}${source.degraded ? '  (card-body grounding)' : ''}`)
    console.log(`      Q: ${quiz.quizQuestion}`)
    console.log(`      ${quiz.stat} — ${quiz.statLabel}`)

    if (APPLY) {
      const { error: upErr } = await db
        .from('cards')
        .update({
          quiz_question: quiz.quizQuestion,
          quiz_answer: quiz.quizAnswer,
          stat: quiz.stat,
          stat_label: quiz.statLabel,
        })
        .eq('id', card.id)
      if (upErr) {
        console.log(`      write failed: ${upErr.message}`)
        failed++
        continue
      }
    }
    ok++
  } catch (e) {
    console.log(`ERROR ${label} — ${e.message.slice(0, 90)}`)
    failed++
  }
}

console.log(
  `\n${ok} ready, ${failed} failed, ${degraded} grounded on card body only. ` +
    `Cost $${cost.toFixed(4)}.` +
    (APPLY ? '' : '\nRe-run with --apply to write.')
)

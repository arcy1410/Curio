// POST /api/pipeline — the R10 content pipeline run.
//
// Guardian (what's trending) → Wikipedia/TMDB (full text to ground on) →
// Sonnet (generate) → Haiku (verify) → Supabase (store, verified only).
//
// This runs on a schedule or by manual trigger — NEVER in response to a user
// action. Per R2, generation is never in the serving path: a swipe must never
// wait on an LLM. The feed reads the store; this fills it.
//
// Every credential used here is server-side only. The service_role key
// bypasses RLS (it's the one identity allowed to write unverified drafts);
// it must never reach the client bundle.

import { createClient } from '@supabase/supabase-js'
import {
  fetchWikipedia,
  searchWikipedia,
  fetchGuardianTrending,
  SENSITIVE_TOPIC,
} from './_lib/sources.js'
import { generateVerifiedCard } from './_lib/cardgen.js'
import { TOPIC_SOURCES } from './_lib/topicSources.js'

// TOPIC_SOURCES — how each Curio topic maps onto trending input — moved to
// _lib/topicSources.js so api/refill.js (user-triggered top-up) applies the
// exact same editorial filters as this batch run. The commentary moved with
// it; the rules did not change.

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Pick candidate source documents for a topic.
 *
 * Guardian is an *enhancer, not a dependency* (R10 exceptions): if it fails or
 * has no key, we fall back to the topic's Wikipedia seeds and the run
 * continues. A trending outage degrades freshness, never availability.
 */
async function findSources(topic, limit) {
  const config = TOPIC_SOURCES[topic]
  const sources = []
  const seedErrors = []
  let guardianError = null

  if (config.guardianQuery) {
    try {
      const trending = await fetchGuardianTrending(config.guardianSection, {
        limit,
        query: config.guardianQuery,
        titleMustMatch: config.titleMustMatch,
      })
      // Resolve each trending headline to a Wikipedia article where we can —
      // Wikipedia gives durable, checkable prose; a news article goes stale.
      // Title + opening prose, never the bare title: "Shiva" is a perfectly
      // good history source but its title alone carries no topic signal.
      const onTopic = (doc) =>
        !config.topicMustMatch ||
        config.topicMustMatch.test(`${doc.title} ${doc.text.slice(0, 600)}`)

      for (const item of trending.slice(0, limit)) {
        const title = await searchWikipedia(item.title)
        const wiki = title ? await fetchWikipedia(title) : null

        // The headline passed the editorial filter, but the article it
        // resolves to may not: a film-censorship headline can resolve to the
        // Wikipedia article on the war the film is about.
        const usable = wiki && !SENSITIVE_TOPIC.test(wiki.title) && onTopic(wiki) ? wiki : null

        // Prefer Wikipedia (durable, checkable); fall back to the Guardian
        // piece only if it is itself on topic. If neither is, take neither —
        // the seed articles below will fill the slot with something that is.
        const chosen = usable || (onTopic(item) ? item : null)
        if (!chosen) continue

        sources.push(chosen)
        if (sources.length >= limit) break
      }
    } catch (e) {
      guardianError = e.message // non-fatal, recorded on the run
    }
  }

  // Top up from the topic's Wikipedia seeds.
  //
  // Each seed is individually guarded. A single transient Wikipedia failure
  // used to throw out of here and abort the WHOLE run — including topics that
  // had already produced verified cards. R10 is explicit that a source outage
  // degrades freshness, never availability, and that has to hold for the
  // backbone source too, not just for Guardian.
  for (const seed of config.seeds) {
    if (sources.length >= limit) break
    try {
      const wiki = await fetchWikipedia(seed)
      if (wiki) sources.push(wiki)
    } catch (e) {
      seedErrors.push(`${seed}: ${e.message}`)
    }
  }

  return { sources: sources.slice(0, limit), guardianError, seedErrors }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  // Shared-secret guard: this endpoint spends money, so it must not be
  // publicly triggerable. Vercel Cron sends this header automatically.
  const secret = process.env.PIPELINE_SECRET
  if (secret) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
  }

  const {
    topics = Object.keys(TOPIC_SOURCES),
    perTopic = 2, // per-run volume cap (R10: cost control + topic diversity)
    trigger = 'manual',
  } = req.body ?? {}

  const db = supabase()

  const { data: run, error: runError } = await db
    .from('pipeline_runs')
    .insert({ trigger })
    .select()
    .single()
  if (runError) return res.status(500).json({ error: runError.message })

  const stats = { generated: 0, passed: 0, retried: 0, discarded: 0, cost: 0 }
  const details = []

  try {
    for (const topic of topics) {
      if (!TOPIC_SOURCES[topic]) continue

      const { sources, guardianError, seedErrors } = await findSources(topic, perTopic)
      if (guardianError) details.push({ topic, note: `guardian unavailable: ${guardianError}` })
      // Reported, not swallowed: a seed that keeps failing is a content gap.
      if (seedErrors?.length) details.push({ topic, note: `seeds skipped: ${seedErrors.join(' | ')}` })

      for (const source of sources) {
        // Skip anything already in the store — source_url is unique.
        const { data: existing } = await db
          .from('cards')
          .select('id')
          .eq('source_url', source.url)
          .maybeSingle()
        if (existing) {
          details.push({ topic, source: source.url, result: 'skipped (already exists)' })
          continue
        }

        stats.generated++
        const result = await generateVerifiedCard({
          source,
          topicName: topic,
        })
        stats.cost += result.cost
        if (result.attempts > 1) stats.retried++

        if (!result.verified) {
          // Fail closed. Nothing unverified is stored "to fix later".
          stats.discarded++
          details.push({
            topic,
            source: source.url,
            result: 'discarded (failed verification)',
            flags: result.flags,
          })
          continue
        }

        const { error: insertError } = await db.from('cards').insert({
          topic_id: topic,
          title: result.card.title,
          body: result.card.body,
          source_url: source.url,
          source_type: source.type,
          verified: true,
          verified_at: new Date().toISOString(),
          generator_model: result.generatorModel,
          verifier_model: result.verifierModel,
          cost_usd: result.cost,
          // Redesign quiz layer. Null when the quiz step failed its own
          // verification — the card still ships, it just renders as editorial.
          quiz_question: result.quiz?.quizQuestion ?? null,
          quiz_answer: result.quiz?.quizAnswer ?? null,
          stat: result.quiz?.stat ?? null,
          stat_label: result.quiz?.statLabel ?? null,
        })

        if (insertError) {
          stats.discarded++
          details.push({ topic, source: source.url, result: `insert failed: ${insertError.message}` })
        } else {
          stats.passed++
          details.push({ topic, source: source.url, result: 'published', title: result.card.title })
        }
      }
    }

    await db
      .from('pipeline_runs')
      .update({
        finished_at: new Date().toISOString(),
        generated_count: stats.generated,
        passed_count: stats.passed,
        retried_count: stats.retried,
        discarded_count: stats.discarded,
        total_cost_usd: stats.cost,
      })
      .eq('id', run.id)

    return res.status(200).json({ run_id: run.id, ...stats, details })
  } catch (err) {
    await db
      .from('pipeline_runs')
      .update({ finished_at: new Date().toISOString(), error: err.message })
      .eq('id', run.id)
    return res.status(500).json({ run_id: run.id, error: err.message, ...stats })
  }
}

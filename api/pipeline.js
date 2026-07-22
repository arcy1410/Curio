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
import { fetchWikipedia, searchWikipedia, fetchGuardianTrending } from './_lib/sources.js'
import { generateVerifiedCard } from './_lib/cardgen.js'

// How each Curio topic maps onto trending input.
//
// `guardianQuery` is doing the real work here, not `guardianSection`. Guardian
// sections are global: `sport` is dominated by rugby, football and AFL, and a
// section-only pull produced trending items with nothing to do with Indian
// cricket. The query keeps the India-first wedge intact; the section just
// narrows the corpus.
//
// `seeds` are durable Wikipedia articles used to top up a topic when trending
// yields nothing groundable — they keep a run productive on a quiet news day.
// `titleMustMatch` is the India-first guarantee. A body-level query alone let
// a 4,000-word piece on Australian scheduling through because it mentioned the
// IPL once; requiring the signal in the HEADLINE is what actually keeps the
// wedge intact.
const TOPIC_SOURCES = {
  cricket: {
    guardianSection: 'sport',
    guardianQuery: 'cricket AND (India OR Indian OR IPL)',
    titleMustMatch: /\b(india|indian|ipl|kohli|rohit|bumrah|bcci|ranji|mumbai|chennai|kolkata)\b/i,
    seeds: ['Indian Premier League', 'India national cricket team', 'Cricket World Cup'],
  },
  markets: {
    guardianSection: 'business',
    guardianQuery: '(India OR Indian OR rupee OR Sensex OR Mumbai) AND (economy OR markets OR stocks)',
    titleMustMatch: /\b(india|indian|rupee|sensex|nifty|mumbai|adani|ambani|reliance|rbi)\b/i,
    seeds: ['BSE SENSEX', 'NIFTY 50', 'Reserve Bank of India'],
  },
  bollywood: {
    guardianSection: 'film',
    guardianQuery: 'Bollywood OR "Hindi cinema" OR "Indian film"',
    titleMustMatch: /\b(bollywood|hindi|india|indian|khan|bachchan|kapoor|mumbai)\b/i,
    seeds: ['Bollywood', 'Cinema of India', 'Filmfare Awards'],
  },
  history: {
    // No section: Guardian files Indian history across culture, world and
    // books. The query and headline filter do the work here.
    guardianSection: null,
    guardianQuery: '"Indian history" OR "ancient India" OR Mughal OR Maurya',
    titleMustMatch: /\b(india|indian|mughal|maurya|ancient|empire|partition|delhi)\b/i,
    seeds: ['History of India', 'Maurya Empire', 'Indus Valley Civilisation'],
  },
}

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
      for (const item of trending.slice(0, limit)) {
        const title = await searchWikipedia(item.title)
        const wiki = title ? await fetchWikipedia(title) : null
        sources.push(wiki || item) // fall back to the Guardian body text itself
        if (sources.length >= limit) break
      }
    } catch (e) {
      guardianError = e.message // non-fatal, recorded on the run
    }
  }

  // Top up from the topic's Wikipedia seeds.
  for (const seed of config.seeds) {
    if (sources.length >= limit) break
    const wiki = await fetchWikipedia(seed)
    if (wiki) sources.push(wiki)
  }

  return { sources: sources.slice(0, limit), guardianError }
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

      const { sources, guardianError } = await findSources(topic, perTopic)
      if (guardianError) details.push({ topic, note: `guardian unavailable: ${guardianError}` })

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

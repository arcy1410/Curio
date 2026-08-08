// POST /api/refill — generate ONE verified card for a topic, on user demand.
//
// This is the exhaustion path: a user who has swiped through the whole library
// hits "You're all caught up", and the app quietly writes them ten fresh cards
// while they take a recall quiz or wander Discover. The client calls this
// endpoint once per card, so its own request count IS the progress bar —
// no polling, no run table to watch, and closing the tab stops the spend.
//
// R2 still holds: generation is not in the SERVING path. A swipe never waits
// on this — the feed keeps rendering its empty state (or the quiz) while the
// batch runs, and new cards only enter the deck when they are verified rows.
//
// Guardrails, in order of importance:
//   1. Verification is identical to the batch pipeline — same generator, same
//      verifier, fail closed. A user asking for cards does not lower the bar.
//   2. A Supabase JWT is required. Every real client has one (anonymous
//      sign-in mints it on first action); a drive-by curl does not, so the
//      endpoint cannot be used to drain the OpenAI budget anonymously.
//   3. A global hourly cap on generated cards bounds worst-case spend even if
//      many users exhaust at once (or one scripts their token).
//   4. Per-user hourly cap via pipeline_runs.requested_by (migration 006).
//      Best-effort: if the migration isn't applied yet the endpoint still
//      works, protected by the global cap alone.

import { createClient } from '@supabase/supabase-js'
import {
  fetchWikipedia,
  searchWikipedia,
  fetchGuardianTrending,
  SENSITIVE_TOPIC,
} from './_lib/sources.js'
import { generateVerifiedCard } from './_lib/cardgen.js'
import { TOPIC_SOURCES } from './_lib/topicSources.js'

const GLOBAL_CARDS_PER_HOUR = 30 // all generated cards, any trigger
const USER_CARDS_PER_HOUR = 15 // one batch of 10 + retry headroom

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Find one source for `topic` that is NOT already a card.
 *
 * Different from the batch pipeline's findSources on purpose: that one fills
 * its quota first and lets the handler discover duplicates afterwards, which
 * on a quiet news day yields a run full of skips. Here the existence check
 * runs per candidate, so the first thing returned is guaranteed fresh — and a
 * refill for a user who has read everything is exactly the situation where
 * most candidates are already in the store.
 */
async function findFreshSource(db, topic) {
  const config = TOPIC_SOURCES[topic]
  const onTopic = (doc) =>
    !config.topicMustMatch ||
    config.topicMustMatch.test(`${doc.title} ${doc.text.slice(0, 600)}`)

  const isFresh = async (url) => {
    const { data } = await db.from('cards').select('id').eq('source_url', url).maybeSingle()
    return !data
  }

  // Trending first — freshest, and least likely to already exist.
  if (config.guardianQuery) {
    try {
      const trending = await fetchGuardianTrending(config.guardianSection, {
        limit: 8,
        query: config.guardianQuery,
        titleMustMatch: config.titleMustMatch,
      })
      for (const item of trending) {
        const title = await searchWikipedia(item.title)
        const wiki = title ? await fetchWikipedia(title) : null
        const usable = wiki && !SENSITIVE_TOPIC.test(wiki.title) && onTopic(wiki) ? wiki : null
        const chosen = usable || (onTopic(item) ? item : null)
        if (chosen && (await isFresh(chosen.url))) return chosen
      }
    } catch {
      // Guardian is an enhancer, not a dependency (R10) — fall through.
    }
  }

  // Seeds as fallback. After the library filled to 60 most seeds exist
  // already, which is fine — the per-candidate check just walks past them.
  for (const seed of config.seeds) {
    try {
      const wiki = await fetchWikipedia(seed)
      if (wiki && (await isFresh(wiki.url))) return wiki
    } catch {
      // one bad seed never ends the search
    }
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const db = supabase()

  // ── Who is asking? A JWT from OUR Supabase project, or nothing. ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'sign-in required' })
  const { data: userData, error: authError } = await db.auth.getUser(token)
  const uid = userData?.user?.id
  if (authError || !uid) return res.status(401).json({ error: 'invalid session' })

  const { topic } = req.body ?? {}
  if (!TOPIC_SOURCES[topic]) return res.status(400).json({ error: 'unknown topic' })

  // ── Cost caps ──
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCards } = await db
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', hourAgo)
  if ((recentCards ?? 0) >= GLOBAL_CARDS_PER_HOUR) {
    return res.status(429).json({ error: 'generation budget exhausted — try later' })
  }

  // Per-user cap. Requires migration 006 (requested_by column); before it,
  // this query errors and we fall back to the global cap alone.
  try {
    const { count: userRuns, error } = await db
      .from('pipeline_runs')
      .select('id', { count: 'exact', head: true })
      .eq('requested_by', uid)
      .gte('started_at', hourAgo)
    if (!error && (userRuns ?? 0) >= USER_CARDS_PER_HOUR) {
      return res.status(429).json({ error: 'your refill budget is used up — try later' })
    }
  } catch {
    // pre-migration: skip
  }

  // ── Log the run. 'user' needs migration 006; fall back to 'manual'. ──
  let runId = null
  {
    const attempt = await db
      .from('pipeline_runs')
      .insert({ trigger: 'user', requested_by: uid })
      .select('id')
      .single()
    if (attempt.error) {
      const retry = await db.from('pipeline_runs').insert({ trigger: 'manual' }).select('id').single()
      runId = retry.data?.id ?? null
    } else {
      runId = attempt.data.id
    }
  }
  const finishRun = (fields) =>
    runId
      ? db
          .from('pipeline_runs')
          .update({ finished_at: new Date().toISOString(), ...fields })
          .eq('id', runId)
      : Promise.resolve()

  try {
    const source = await findFreshSource(db, topic)
    if (!source) {
      await finishRun({ error: `no fresh source for ${topic}` })
      // 200, not an error: "nothing new to write about" is a normal outcome
      // the client should skip past, not retry.
      return res.status(200).json({ result: 'no_source', topic })
    }

    const result = await generateVerifiedCard({ source, topicName: topic })

    if (!result.verified) {
      // Fail closed — same rule as the batch pipeline, no exceptions for
      // "but the user is waiting". An unverified card is not a card.
      await finishRun({
        generated_count: 1,
        discarded_count: 1,
        total_cost_usd: result.cost,
      })
      return res.status(200).json({ result: 'discarded', topic, flags: result.flags })
    }

    const { data: row, error: insertError } = await db
      .from('cards')
      .insert({
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
        quiz_question: result.quiz?.quizQuestion ?? null,
        quiz_answer: result.quiz?.quizAnswer ?? null,
        stat: result.quiz?.stat ?? null,
        stat_label: result.quiz?.statLabel ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      await finishRun({ generated_count: 1, discarded_count: 1, total_cost_usd: result.cost })
      return res.status(500).json({ error: `insert failed: ${insertError.message}` })
    }

    await finishRun({ generated_count: 1, passed_count: 1, total_cost_usd: result.cost })

    // The card, in the exact shape cardStore.toCard() produces, so the client
    // can append it to the live library without a refetch.
    return res.status(200).json({
      result: 'published',
      card: {
        id: row.id,
        topic,
        subtopic: null,
        title: result.card.title,
        body: result.card.body,
        source_url: source.url,
        verified: true,
        quiz_question: result.quiz?.quizQuestion ?? null,
        quiz_answer: result.quiz?.quizAnswer ?? null,
        stat: result.quiz?.stat ?? null,
        stat_label: result.quiz?.statLabel ?? null,
      },
    })
  } catch (err) {
    await finishRun({ error: err.message })
    return res.status(500).json({ error: err.message.slice(0, 200) })
  }
}

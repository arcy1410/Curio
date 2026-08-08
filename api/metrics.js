// GET /api/metrics — aggregated product metrics for the live dashboard page.
//
// This exists because the dashboard page (public/metrics.html) cannot hold a
// PostHog credential: it ships to anyone with the URL. The personal API key
// stays here, server-side, like every other secret in this repo (CLAUDE.md:
// nothing key-bearing reaches the client).
//
// Everything returned is an AGGREGATE — counts, medians, rates. No person ids,
// no emails, no event-level rows, so the endpoint being public exposes nothing
// a Demo Day slide wouldn't. If that ever changes, add a viewing key here.
//
// Cached two ways: module scope (warm lambda) and CDN s-maxage, so PostHog is
// queried at most once per 10 minutes no matter how many people load the page.

const HOST = 'https://us.posthog.com'

let cache = null // { at, body }
const TTL_MS = 10 * 60 * 1000

async function hogql(projectId, key, query) {
  const r = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`posthog ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j.results ?? []
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const key = process.env.POSTHOG_PERSONAL_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID || '523396'
  if (!key) return res.status(500).json({ error: 'POSTHOG_PERSONAL_KEY not set' })

  if (cache && Date.now() - cache.at < TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    return res.status(200).json(cache.body)
  }

  try {
    const [funnel, weekly, sessions, mix, ret, totals, ttfc, ns] = await Promise.all([
      hogql(projectId, key, `
        select
          uniqIf(person_id, event='onboarding_started'),
          uniqIf(person_id, event='onboarding_topic_toggled'),
          uniqIf(person_id, event='onboarding_completed'),
          uniqIf(person_id, event='card_viewed'),
          uniqIf(person_id, event='card_swiped'),
          uniqIf(person_id, event='card_saved'),
          uniqIf(person_id, event='signup_gate_shown'),
          uniqIf(person_id, event in ('signin_completed','signup_completed'))
        from events`),
      hogql(projectId, key, `
        select toStartOfWeek(timestamp) as w,
          uniqIf(person_id, event='app_opened'),
          countIf(event='card_saved'),
          countIf(event='card_viewed')
        from events group by w order by w`),
      hogql(projectId, key, `
        select toStartOfWeek(timestamp) as w,
          median(if(toFloat(properties.duration_s)>=30, toFloat(properties.duration_s), null))
        from events where event='session_ended' group by w order by w`),
      hogql(projectId, key, `
        select countIf(properties.action='interested'), countIf(properties.action='pass')
        from events where event='card_swiped'`),
      hogql(projectId, key, `
        select countIf(days>=2), count() from
          (select person_id, uniq(toDate(timestamp)) as days from events group by person_id)`),
      hogql(projectId, key, `
        select uniq(person_id), count(), min(toDate(timestamp)), max(toDate(timestamp)) from events`),
      hogql(projectId, key, `
        select median(dateDiff('second', s, v)) from
          (select person_id, min(timestamp) as s from events where event='onboarding_started' group by person_id) a
          join (select person_id, min(timestamp) as v from events where event='card_viewed' group by person_id) b
          on a.person_id=b.person_id where v>=s`),
      hogql(projectId, key, `
        select uniqIf(person_id, event='card_saved'),
               uniqIf(person_id, event in ('review_completed','kept_card_opened'))
        from events`),
    ])

    const [started, toggled, completed, viewed, swiped, saved, gateShown, signedIn] = funnel[0]
    const [interested, pass] = mix[0]
    const [returned, people] = ret[0]
    const [uniqPeople, events, from, to] = totals[0]
    const [savers, returnedToCard] = ns[0]

    const body = {
      updatedAt: new Date().toISOString(),
      window: { from, to },
      totals: { people: uniqPeople, events },
      funnel: {
        started, toggled, completed, viewed, swiped, saved, gateShown, signedIn,
      },
      weekly: weekly.map(([w, wau, saves, views], i) => ({
        week: w,
        wau,
        saves,
        views,
        medianSessionS: sessions[i]?.[1] ?? null,
      })),
      swipeMix: { interested, pass },
      secondDay: { returned, people },
      ns: { savers, returnedToCard },
      ttfcMedianS: ttfc[0]?.[0] ?? null,
    }

    cache = { at: Date.now(), body }
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    return res.status(200).json(body)
  } catch (err) {
    // Serve the stale cache over an error — a metrics page that flickers
    // between data and failure is worse than one ten minutes behind.
    if (cache) {
      res.setHeader('Cache-Control', 's-maxage=60')
      return res.status(200).json({ ...cache.body, stale: true })
    }
    return res.status(502).json({ error: `metrics unavailable: ${err.message.slice(0, 160)}` })
  }
}

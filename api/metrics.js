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

  // Rolling three-week window, anchored on TODAY as the last day of the
  // current week (decision 2026-08-11). "Week" here is not a calendar week:
  //   week 3 = today-6 … today · week 2 = today-13 … today-7 ·
  //   week 1 = today-20 … today-14.
  // Everything on the page — funnel, totals, mix, retention, North Star —
  // counts ONLY these 21 days; older events are out of every number.
  const IN_WINDOW = `toDate(timestamp) >= today() - 20`
  // 0 = the week ending today, 1 = the one before, 2 = the oldest kept.
  const WEEK_AGO = `intDiv(dateDiff('day', toDate(timestamp), today()), 7)`

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
        from events where ${IN_WINDOW}`),
      hogql(projectId, key, `
        select ${WEEK_AGO} as ago,
          uniqIf(person_id, event='app_opened'),
          countIf(event='card_saved'),
          countIf(event='card_viewed')
        from events where ${IN_WINDOW} group by ago order by ago`),
      hogql(projectId, key, `
        select ${WEEK_AGO} as ago,
          median(if(toFloat(properties.duration_s)>=30, toFloat(properties.duration_s), null))
        from events where event='session_ended' and ${IN_WINDOW} group by ago order by ago`),
      hogql(projectId, key, `
        select countIf(properties.action='interested'), countIf(properties.action='pass')
        from events where event='card_swiped' and ${IN_WINDOW}`),
      hogql(projectId, key, `
        select countIf(days>=2), count() from
          (select person_id, uniq(toDate(timestamp)) as days from events
           where ${IN_WINDOW} group by person_id)`),
      hogql(projectId, key, `
        select uniq(person_id), count(), min(toDate(timestamp)), max(toDate(timestamp))
        from events where ${IN_WINDOW}`),
      hogql(projectId, key, `
        select median(dateDiff('second', s, v)) from
          (select person_id, min(timestamp) as s from events
           where event='onboarding_started' and ${IN_WINDOW} group by person_id) a
          join (select person_id, min(timestamp) as v from events
           where event='card_viewed' and ${IN_WINDOW} group by person_id) b
          on a.person_id=b.person_id where v>=s`),
      hogql(projectId, key, `
        select uniqIf(person_id, event='card_saved'),
               uniqIf(person_id, event in ('review_completed','kept_card_opened'))
        from events where ${IN_WINDOW}`),
    ])

    const [started, toggled, completed, viewed, swiped, saved, gateShown, signedIn] = funnel[0]
    const [interested, pass] = mix[0]
    const [returned, people] = ret[0]
    const [uniqPeople, events, from, to] = totals[0]
    const [savers, returnedToCard] = ns[0]

    // Rebuild the rolling weeks chronologically (oldest → the week ending
    // today), joining sessions by their `ago` key — positional joins break
    // the moment one bucket has no session_ended rows.
    const byAgo = new Map(weekly.map(([ago, wau, saves, views]) => [ago, { wau, saves, views }]))
    const sessByAgo = new Map(sessions.map(([ago, med]) => [ago, med]))
    const dayMs = 86_400_000
    const isoDaysAgo = (n) => new Date(Date.now() - n * dayMs).toISOString().slice(0, 10)
    const weeks = [2, 1, 0].map((ago) => ({
      // week runs (today − ago·7 − 6) … (today − ago·7); today closes week 3
      week: isoDaysAgo(ago * 7 + 6),
      weekEnd: isoDaysAgo(ago * 7),
      wau: byAgo.get(ago)?.wau ?? 0,
      saves: byAgo.get(ago)?.saves ?? 0,
      views: byAgo.get(ago)?.views ?? 0,
      medianSessionS: sessByAgo.get(ago) ?? null,
    }))

    const body = {
      updatedAt: new Date().toISOString(),
      window: { from, to },
      totals: { people: uniqPeople, events },
      funnel: {
        started, toggled, completed, viewed, swiped, saved, gateShown, signedIn,
      },
      weekly: weeks,
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

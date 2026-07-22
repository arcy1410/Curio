// Source fetchers for the R10 content pipeline.
//
// The rule from the spec: we only ground cards on FULL-TEXT sources. The
// verification step (Haiku) has to check every generated claim against actual
// source prose — a headline, a snippet, or a stats blob gives it nothing to
// check against, so a "verified" card built on one would be verified against
// nothing. Wikipedia is the backbone; Guardian supplies currency; TMDB supplies
// film metadata that Wikipedia covers thinly.
//
// Files under api/_lib/ are ignored by Vercel's router (leading underscore),
// so nothing here is reachable as an HTTP endpoint.

const UA = 'Curio/0.1 (ISB SWPM student project; contact via github.com/arcy1410/Curio)'

/** Minimum characters of source prose we'll accept as groundable. */
const MIN_SOURCE_CHARS = 600

/**
 * fetch() with bounded retry on transport-level failures.
 *
 * Upstream source APIs drop connections intermittently — observed repeatedly
 * against api.themoviedb.org (ECONNRESET mid-TLS, unrelated to the request
 * itself; some networks reset it sporadically). A single dropped socket must
 * not fail a whole pipeline run, so transport errors and 5xx/429 responses are
 * retried with exponential backoff.
 *
 * 4xx responses are NOT retried — a bad key or malformed query fails the same
 * way every time, and retrying only delays a real error.
 */
async function fetchWithRetry(url, options = {}, { attempts = 3, baseDelayMs = 400 } = {}) {
  let lastError

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      // 400ms, 800ms, 1600ms … plus jitter so parallel calls don't sync up
      const delay = baseDelayMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5)
      await new Promise((r) => setTimeout(r, delay))
    }

    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20_000), // don't hang a run on a stalled socket
      })
      // Retry transient server-side conditions; surface everything else.
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`upstream ${res.status}`)
        continue
      }
      return res
    } catch (err) {
      lastError = err // ECONNRESET, timeout, DNS — all worth another try
    }
  }

  const cause = lastError?.cause?.code || lastError?.name || lastError?.message
  throw new Error(`fetch failed after ${attempts} attempts (${cause}): ${url.split('?')[0]}`)
}

// ─────────────────────────────────────────────────────────────
// Wikipedia — no API key required.
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the plain-text extract of a Wikipedia article.
 * Returns { title, text, url } or null if the article is missing/too thin.
 */
export async function fetchWikipedia(title) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1', // plain text, not HTML — this is what Haiku checks against
    exsectionformat: 'plain',
    redirects: '1', // follow "Sholay (film)" → "Sholay"
    titles: title,
    format: 'json',
    origin: '*',
  })

  const res = await fetchWithRetry(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`wikipedia ${res.status}`)

  const data = await res.json()
  const pages = data?.query?.pages ?? {}
  const page = Object.values(pages)[0]

  if (!page || page.missing !== undefined) return null
  const text = (page.extract || '').trim()
  if (text.length < MIN_SOURCE_CHARS) return null // too thin to verify against

  return {
    title: page.title,
    text,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    type: 'wikipedia',
  }
}

/** Search Wikipedia and return the best-matching article title, or null. */
export async function searchWikipedia(query) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '1',
    format: 'json',
    origin: '*',
  })
  const res = await fetchWithRetry(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`wikipedia search ${res.status}`)
  const data = await res.json()
  return data?.query?.search?.[0]?.title ?? null
}

// ─────────────────────────────────────────────────────────────
// Guardian — trending input. Requires GUARDIAN_API_KEY.
// ─────────────────────────────────────────────────────────────

/**
 * Pull recent Guardian articles for a section, with full body text.
 * Used as the *trending signal* (what's current) and, for news-anchored
 * cards, as the grounding source itself.
 *
 * Guardian is an enhancer, not a dependency (spec R10 exceptions): if it's
 * unavailable the pipeline still runs on Wikipedia/TMDB. Callers should treat
 * a throw here as non-fatal.
 */
export async function fetchGuardianTrending(section, { limit = 5, query } = {}) {
  const key = process.env.GUARDIAN_API_KEY
  if (!key) throw new Error('GUARDIAN_API_KEY not set')

  const params = new URLSearchParams({
    'api-key': key,
    'page-size': String(limit),
    'show-fields': 'bodyText,headline',
  })

  // Two things matter here, and the second is easy to miss.
  //
  // 1. Section alone is too blunt for an India-first product: Guardian's
  //    `sport` section is mostly rugby, football and AFL.
  // 2. Ordering matters MORE than the query. With `order-by=newest`, Guardian
  //    returns the newest article mentioning the term *anywhere in the body* —
  //    measured against `q=cricket AND India`, that surfaced a piece about
  //    biryani above actual match coverage. Relevance ordering returns
  //    "England v India ODI" and "Bollywood classics: Asha Bhosle" instead.
  //
  // So: query present → rank by relevance. No query (plain section browse) →
  // newest is the sensible ordering.
  if (query) {
    params.set('q', query)
    params.set('order-by', 'relevance')
  } else {
    params.set('order-by', 'newest')
  }
  if (section) params.set('section', section)

  const res = await fetchWithRetry(`https://content.guardianapis.com/search?${params}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`guardian ${res.status}`)

  const data = await res.json()
  return (data?.response?.results ?? [])
    .map((r) => ({
      title: r.fields?.headline || r.webTitle,
      text: (r.fields?.bodyText || '').trim(),
      url: r.webUrl,
      type: 'guardian',
    }))
    .filter((r) => r.text.length >= MIN_SOURCE_CHARS)
}

// ─────────────────────────────────────────────────────────────
// TMDB — film metadata. Requires TMDB_READ_TOKEN.
// ─────────────────────────────────────────────────────────────

/**
 * Look up a film and return its overview text.
 *
 * Caveat worth knowing: a TMDB overview is a short synopsis, often under our
 * grounding threshold. TMDB is best used to *identify* a film (title, year,
 * cast), then ground the actual card on that film's Wikipedia article. This
 * function returns null when the overview is too thin to verify against,
 * rather than pretending a two-line synopsis is a source.
 */
export async function fetchTmdbFilm(query) {
  const token = process.env.TMDB_READ_TOKEN
  if (!token) throw new Error('TMDB_READ_TOKEN not set')

  const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US' })
  const res = await fetchWithRetry(`https://api.themoviedb.org/3/search/movie?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`tmdb ${res.status}`)

  const data = await res.json()
  const film = data?.results?.[0]
  if (!film) return null

  const text = (film.overview || '').trim()
  return {
    title: film.title,
    year: (film.release_date || '').slice(0, 4),
    text,
    url: `https://www.themoviedb.org/movie/${film.id}`,
    type: 'tmdb',
    // Signals to the caller that this needs a Wikipedia article to ground on.
    groundable: text.length >= MIN_SOURCE_CHARS,
  }
}

export { MIN_SOURCE_CHARS }

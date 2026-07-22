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

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
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
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
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
export async function fetchGuardianTrending(section, { limit = 5 } = {}) {
  const key = process.env.GUARDIAN_API_KEY
  if (!key) throw new Error('GUARDIAN_API_KEY not set')

  const params = new URLSearchParams({
    'api-key': key,
    section,
    'order-by': 'newest',
    'page-size': String(limit),
    'show-fields': 'bodyText,headline',
  })

  const res = await fetch(`https://content.guardianapis.com/search?${params}`, {
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
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
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

// Identity for the app.
//
// Every row a user writes needs a `user_id` — RLS on swipes, saved_cards,
// topic_scores and comments is all `auth.uid() = user_id`, so without a
// session those tables are unwritable by design.
//
// The obvious way to get one is a signup wall, and then a merge: collect
// everything in localStorage, ask for an email later, reconcile the two.
// That merge is the expensive part — deciding what wins when the same card
// was swiped in both places, handling a second device, handling a user who
// signs in as someone else.
//
// Anonymous sign-in removes the merge entirely. The user gets a real
// auth.users row on first launch (their profile is created by the
// handle_new_user trigger), so writes go to the database from action one
// under an id that never changes. When they later give an email, R9's gate
// attaches it to the SAME row via updateUser — nothing moves, nothing merges.
//
// Requires Authentication → Providers → Anonymous sign-ins to be enabled in
// the Supabase dashboard. If it isn't, every call here fails soft and the app
// runs exactly as it did before, on localStorage.
//
// ── Why the client is loaded lazily ──
// @supabase/supabase-js costs ~57 kB gzipped, and the feed does not need it:
// cardStore.js reads cards over plain fetch precisely so the first card can
// render without an SDK. Importing it at module scope put that 57 kB in front
// of first paint for every user, including the ones who never open a comment
// thread. A dynamic import keeps it off the critical path — it downloads when
// someone actually comments.

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isConfigured = Boolean(URL_BASE && KEY)

let clientPromise = null

/** The Supabase client, loaded on first use. Null if not configured. */
export function getClient() {
  if (!isConfigured) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(URL_BASE, KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        })
      )
      .catch(() => null) // chunk failed to load — callers fall back to local
  }
  return clientPromise
}

/**
 * The current user, or null — WITHOUT creating one.
 *
 * The difference from ensureUser() matters: reads must never mint an identity.
 * If restoring history created an anonymous account, every visitor would get
 * an auth.users row just for opening the page, before doing anything at all.
 */
export async function existingUser() {
  const supabase = await getClient()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.user ?? null
  } catch {
    return null
  }
}

/**
 * Read an OAuth failure out of the URL, if the callback returned one.
 *
 * Supabase reports callback failures in the hash (#error=…&error_description=…)
 * and, for some cases, the query string. Nothing was reading either, so a real
 * rejection — an expired link, a blocked identity, storage the browser refused
 * to write — arrived as a silent page reload that looked identical to "nothing
 * happened". That is why this took several rounds to pin down.
 *
 * Called once on load; clears the hash so the message doesn't survive a manual
 * refresh.
 */
export function consumeAuthError() {
  try {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const fromQuery = new URLSearchParams(window.location.search)
    const err = fromHash.get('error') || fromQuery.get('error')
    if (!err) return null

    const desc =
      fromHash.get('error_description') || fromQuery.get('error_description') || err
    // Strip the params so a refresh doesn't replay the error.
    window.history.replaceState({}, '', window.location.pathname)
    return decodeURIComponent(desc.replace(/\+/g, ' '))
  } catch {
    return null
  }
}

/** A user who has actually signed in, as opposed to an anonymous shell. */
export function isPermanent(user) {
  return Boolean(user && user.is_anonymous === false)
}

let sessionPromise = null

/**
 * Resolve to the current user, signing in anonymously if needed.
 * Never throws and never blocks a render — returns null when identity isn't
 * available, which every caller treats as "fall back to local".
 */
export function ensureUser() {
  // Memoised: React StrictMode double-invokes effects in development, and two
  // concurrent signInAnonymously calls would create two throwaway users.
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const supabase = await getClient()
        if (!supabase) return null

        const { data } = await supabase.auth.getSession()
        if (data?.session?.user) return data.session.user

        const { data: created, error } = await supabase.auth.signInAnonymously()
        if (error) throw error
        return created?.user ?? null
      } catch {
        return null // anonymous sign-ins disabled, offline, or blocked
      }
    })()
  }
  return sessionPromise
}

/**
 * Sign in with Google, keeping the user's history.
 *
 * The distinction that matters: signInWithOAuth on an anonymous session
 * creates a NEW user and orphans everything the old one did — swipes, saves
 * and comments stay in the database but owned by an id nobody holds any more.
 * linkIdentity attaches Google to the EXISTING row, so the id survives and
 * there is nothing to migrate.
 *
 * That is the whole reason this design has no merge step, and it depends on
 * "Manual Linking" being enabled in the Supabase dashboard.
 *
 * REVISED: linking only works for a Google account Curio has never seen. A
 * RETURNING user — second device, new browser, cleared storage — is trying to
 * attach an identity that already belongs to their real account, and linking
 * correctly refuses. The original code treated that as fatal, which locked
 * every returning user out of their own history. It now falls back to a plain
 * sign-in, which is the right answer precisely because they already have an
 * account: they get all of it back, and the throwaway anonymous session is
 * what's abandoned.
 */
export async function signInWithGoogle() {
  const supabase = await getClient()
  if (!supabase) return { error: 'Sign-in is unavailable right now.' }

  // skipBrowserRedirect: we navigate ourselves.
  //
  // Letting Supabase perform the redirect worked on desktop and failed on
  // phones. By the time it fires we are several awaits from the tap — a
  // dynamic import, a session check, then the link attempt — and mobile
  // browsers refuse navigation that is no longer attached to a user gesture.
  // Taking the URL and assigning location ourselves is a plain top-level
  // navigation, which is always allowed, and it lets us report the real error
  // instead of guessing.
  const options = {
    provider: 'google',
    options: { redirectTo: window.location.origin, skipBrowserRedirect: true },
  }

  const go = (url) => {
    if (!url) return false
    window.location.assign(url)
    return true
  }

  try {
    const user = await ensureUser()

    // Anonymous: try to ATTACH Google so this account's history survives.
    if (user?.is_anonymous) {
      const { data, error } = await supabase.auth.linkIdentity(options)
      if (!error && go(data?.url)) return {}

      const raw = `${error?.message ?? ''}`
      if (/manual linking|not enabled/i.test(raw)) {
        return { error: 'Sign-in is misconfigured — please tell us.' }
      }
      // Linking is refused when that Google account already belongs to another
      // Curio account — i.e. a returning user on a second device or after
      // clearing storage. Signing them into their real account is correct;
      // App merges this session's activity into it afterwards.
    }

    const { data, error } = await supabase.auth.signInWithOAuth(options)
    if (error) throw error
    if (go(data?.url)) return {}
    return { error: 'Sign-in did not return a URL. Try again.' }
  } catch (error) {
    // Surfaced, not swallowed: a generic message here cost two rounds of
    // guessing at a bug the error text would have named.
    const raw = `${error?.message ?? error}`
    if (import.meta.env.DEV) console.error('[signin]', error)
    return { error: `Sign-in failed: ${raw.slice(0, 120)}` }
  }
}

/**
 * Give a freshly signed-in user a display name from their Google profile.
 *
 * Without this every commenter is "Reader" — set_comment_author()'s fallback —
 * which on a shared thread is worse than anonymous: readers can't tell two
 * people apart and it looks broken. Google returns a name; we just weren't
 * using it.
 *
 * FIRST NAME ONLY, deliberately. Comment threads are public, so a full name is
 * more identification than someone agreed to when they pressed "sign in with
 * Google" to keep their Kept pile. A first name is enough to hold a
 * conversation.
 *
 * Runs once per account: if display_name is already set — including a name the
 * user chose themselves — we never overwrite it.
 */
export async function ensureDisplayName(user) {
  if (!isPermanent(user)) return
  const supabase = await getClient()
  if (!supabase) return

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.display_name) return

    // Where the name lives depends on HOW they signed in, and the difference
    // is easy to miss because both flows produce a valid signed-in user:
    //
    //   signInWithOAuth — Supabase merges the Google profile into
    //                     user_metadata, so the name is there.
    //   linkIdentity    — attaches the identity and leaves the existing user's
    //                     metadata untouched. For someone who started
    //                     anonymous that metadata is empty ({email_verified}),
    //                     and the name is only on the identity.
    //
    // Since linking is our primary path, identity_data is where to look first.
    const identity = (user.identities ?? []).find((i) => i.identity_data)?.identity_data ?? {}
    const meta = user.user_metadata ?? {}
    const full = (
      identity.full_name ||
      identity.name ||
      meta.full_name ||
      meta.name ||
      meta.given_name ||
      ''
    ).trim()
    const first = full.split(/\s+/)[0]
    if (!first) return

    await supabase.from('profiles').update({ display_name: first }).eq('id', user.id)
  } catch {
    // A missing name is cosmetic — never block sign-in over it.
  }
}

/** Sign out, then drop the memoised session so the next write starts clean. */
export async function signOut() {
  const supabase = await getClient()
  if (!supabase) return
  await supabase.auth.signOut()
  sessionPromise = null
}

/**
 * Subscribe to sign-in / sign-out. Returns an unsubscribe function.
 * Fires on load too, which is how the app picks up the session Supabase
 * restores from the OAuth redirect.
 */
export function onAuthChange(handler) {
  let unsub = () => {}
  getClient().then((supabase) => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      if (user) sessionPromise = Promise.resolve(user)
      handler(user)
    })
    unsub = () => data?.subscription?.unsubscribe()
  })
  return () => unsub()
}

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

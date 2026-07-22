// Product analytics (PostHog).
//
// Instrumentation is part of the product's behaviour, not an afterthought —
// every core action emits an explicit, named event so we can answer: do people
// use it, do they succeed, where do they drop off, and is it doing harm?
//
// Privacy stance (deliberate, and defensible in the ethics review):
//   • autocapture OFF — we only send events we have explicitly declared below,
//     so no stray clicks/text get hoovered up.
//   • session recording OFF — we never record a user's screen.
//   • respect_dnt ON — browsers asking not to be tracked are honoured.
//   • We never send comment text, card body text, or any free-form user input.
//     Only ids, topics, counts and enums.
//
// The key is a write-only "project API key" — safe to ship in a frontend
// bundle. It is read from an env var so it is never hard-coded in the repo.

import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let enabled = false

export function initAnalytics() {
  if (!KEY) {
    // No key configured (e.g. a local clone) — every track() call becomes a
    // no-op rather than throwing, so the app runs fine without analytics.
    if (import.meta.env.DEV) {
      console.info('[analytics] VITE_POSTHOG_KEY not set — analytics disabled (no-op mode)')
    }
    return
  }
  try {
    posthog.init(KEY, {
      api_host: HOST,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      respect_dnt: true,
      persistence: 'localStorage',
    })
    enabled = true
    // Dev-only handle for debugging that events are actually being sent.
    if (import.meta.env.DEV) window.__curio = { posthog, enabled: true }
  } catch (e) {
    console.warn('[analytics] init failed', e)
  }
}

export function track(event, props = {}) {
  if (!enabled) {
    if (import.meta.env.DEV) console.debug('[analytics:noop]', event, props)
    return
  }
  try {
    posthog.capture(event, props)
  } catch {
    // analytics must never break the product
  }
}

// Durable traits about the person (not per-event).
export function setPersonProps(props = {}) {
  if (!enabled) return
  try {
    if (typeof posthog.setPersonProperties === 'function') posthog.setPersonProperties(props)
  } catch {
    // ignore
  }
}

/**
 * Bind the anonymous visitor to their account (R9).
 *
 * This is what makes the signup funnel one funnel: PostHog aliases everything
 * the person did BEFORE signing in — onboarding, their first seven swipes,
 * the gate itself — onto the account, so "how many people who hit the wall
 * signed in" is answerable. Without it, every user appears twice and the
 * conversion rate is unmeasurable.
 */
export function identifyUser(id, props = {}) {
  if (!enabled || !id) return
  try {
    posthog.identify(id, props)
  } catch {
    // ignore
  }
}

// Clear identity + stored props (used by the prototype reset).
export function resetAnalytics() {
  if (!enabled) return
  try {
    posthog.reset()
  } catch {
    // ignore
  }
}

// ── Event taxonomy ───────────────────────────────────────────
// Named constants so event names stay consistent across the app. Grouped by
// the telemetry categories: outcome, behavioural, quality, diagnostic, guardrail.
export const EV = {
  // lifecycle
  APP_OPENED: 'app_opened',
  SESSION_ENDED: 'session_ended', // {duration_s} per foreground stint — guardrail + DAU/MAU basis

  // onboarding (funnel entry)
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_TOPIC_TOGGLED: 'onboarding_topic_toggled',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // interests
  INTERESTS_EDIT_STARTED: 'interests_edit_started',
  INTERESTS_UPDATED: 'interests_updated',

  // core loop
  CARD_VIEWED: 'card_viewed',
  CARD_SWIPED: 'card_swiped', // { action: 'interested' | 'pass' }
  CARD_SAVED: 'card_saved',
  CARD_UNSAVED: 'card_unsaved',
  SAVE_LIMIT_REACHED: 'save_limit_reached', // {kept_count: 20} — highest-intent paywall moment

  // pile
  KEPT_CARD_OPENED: 'kept_card_opened', // full-card reopen from Kept — the "retained" signal (G4)

  // migration (R8)
  MIGRATION_NOTICE_SHOWN: 'migration_notice_shown',
  MIGRATION_NOTICE_DISMISSED: 'migration_notice_dismissed',
  SOURCE_LINK_CLICKED: 'source_link_clicked', // trust signal engagement
  FEED_EXHAUSTED: 'feed_exhausted',
  FEED_REPLAYED: 'feed_replayed',

  // personalization transparency
  TUNING_METER_TOGGLED: 'tuning_meter_toggled',

  // discovery
  DISCOVERY_OPENED: 'discovery_opened',
  DISCOVERY_TOPIC_SELECTED: 'discovery_topic_selected',
  DISCOVERY_SUBTOPIC_FILTERED: 'discovery_subtopic_filtered',

  // comments (quality / guardrail)
  COMMENTS_OPENED: 'comments_opened',
  COMMENT_POSTED: 'comment_posted',
  COMMENT_REJECTED: 'comment_rejected', // reason only — never the text

  // pile + navigation
  KEPT_PILE_VIEWED: 'kept_pile_viewed',
  TAB_CHANGED: 'tab_changed',

  // auth gate (R9) — the funnel PostHog stitches across the identify() call
  SIGNUP_GATE_SHOWN: 'signup_gate_shown', // {swipe_count} — first block
  SIGNUP_COMPLETED: 'signup_completed', // first sign-in for this account
  SIGNIN_COMPLETED: 'signin_completed', // returning account
  SIGNUP_ABANDONED: 'signup_abandoned', // wall dismissed → read-only
  SIGNUP_FAILED: 'signup_failed', // reason only, never credentials

  // monetization
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_CLICKED: 'paywall_clicked',

  // maintenance
  PROTOTYPE_RESET: 'prototype_reset',
}

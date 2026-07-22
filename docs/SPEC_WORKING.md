# Curio — Working Spec (Session 3 format)

*Team build artifact, drafted section-by-section following the SWPM Session 3
spec structure (Goals/Non-Goals → Narratives → Requirements → Error Scenarios →
Telemetry → Acceptance Criteria → NFRs → Prioritization). This working doc
guides the build; the graded individual Product Specification (4N) is written
separately, in the student's own words.*

**Status:** Goals + Non-Goals complete · Narratives onward: in progress

---

## 1. Goals

Format: *who* achieves *what outcome*, under *what conditions*, judged by
*what measure*. Measures reference PostHog events that are live in the app
today; where no real-user data exists yet, the first live cohort sets the
baseline rather than inventing a target.

### G1 — Activation

A first-time visitor, with no account and no prior history, can go from
landing on Curio to reading their first fact-checked card in under 60 seconds
*(estimated from the flow's simplicity — one screen, no signup, no photo
upload, unlike comparable swipe apps such as Tinder)*, choosing as few as 2
interests to start.

**Judged by:** ≥75% of users who reach onboarding go on to view their first
card — the benchmark floor for simple content-consumption apps (Business of
Apps, 2026 app onboarding rates) — and median time from `onboarding_started`
→ first `card_viewed` under 60 seconds.

### G2 — Visible personalization

A user's feed visibly shifts toward the topics they show interest in, and
away from ones they pass on — observable via the tuning meter, not something
they have to take on faith.

**Judged by:** comparing a user's top-scoring topic's share of `card_viewed`
events in swipes 1–9 against the random baseline (23.8% with today's
4-topic, 21-card library) — simulation of the shipped scoring code shows this
reaches ~2× baseline (46–51%) within that window. Live user data replaces
the simulated number once real cohorts exist. `tuning_meter_toggled` firing
at least once per session is the secondary signal that the transparency
mechanism is actually being used, not just present.

**Known constraint, not a defect:** with only 5–6 cards per topic, a user who
strongly favors one topic exhausts its supply by swipe ~9–10, after which
the visible shift can't be sustained regardless of preference — a
content-volume ceiling, not a scoring bug, and the strongest evidence yet for
prioritizing the Phase-2 content pipeline.

### G3 — Trust (hard invariant)

Every card served to a user carries a cited source and has passed the
fact-check step before it ships — with no exceptions, ever.

**Judged by:** 100% of served cards have `verified: true` and a non-empty
`source_url` — a hard structural invariant, not a target to approach.
(Currently true for all 21 hand-written cards; becomes the Haiku fact-check
gate's job once the Phase-2 pipeline replaces hand-writing.) Additionally,
`source_link_clicked` is tracked from day one as a trust-engagement signal —
no target set yet, since no real-user baseline exists; the first cohort's
data becomes the baseline.

### G4 — Save & return

A user who saves at least one card returns in a later session (same browser)
and revisits their Kept pile.

**Judged by:** D1/D7 return rate among users with `kept_count ≥ 1`, measured
via `kept_pile_viewed` tied to PostHog's persisted `distinct_id`. No target
percentage yet — zero real users exist today; the first live cohort sets the
baseline.

**Known gap, flagged not hidden:** the Kept pile currently offers no way to
re-open a card's full text — only a truncated preview, a source link, and
comments. If "retained" means *re-engaging with the content*, not just
*checking the list*, this is a real fix candidate before Demo Day.

**Scope caveat:** cross-device return can't be measured until real sign-in
ships (deferred).

### G5 — Discovery

A user can browse and read cards in any topic — including ones they didn't
pick at onboarding — without re-doing onboarding or losing their existing
feed personalization.

**Judged by:** the share of `discovery_topic_selected` events where the
selected topic is **not** in that user's `onboarding_completed.interests` —
the genuine "exploring outside your own filter bubble" signal, and direct
evidence for the ethics answer the course requires (personalization ≠ a
closed bubble). No target % set — tracked from day one; the first cohort
sets the baseline.

**Known constraint, flagged not hidden:** several subtopic filters currently
narrow to exactly 1 card, so "filter and browse" doesn't yet feel deep at
today's library size — a content-volume problem the Phase-2 pipeline
addresses, not a Discovery-UI problem.

---

## 2. Non-Goals

Format: what we are deliberately not building, plus the predictable
misunderstanding each one prevents.

### NG1 — Payments

We are not building real payment processing. The Curio+ "Buy" button shows a
visible locked state and a toast — it never contacts a payment processor,
stores a card, or creates a subscription.

**Prevents:** the assumption that clicking "Go Curio+" is a live commerce
flow — which would wrongly imply this release needs PCI compliance, refund
handling, subscription-cancellation flows, or app-store billing integration.
It is a deliberate conversion-nudge mock, not a stub of a real feature.

### NG2 — AI Tutor "ask why"

We are not building AI-powered follow-up questions on cards. It appears only
as a bullet in the Curio+ upsell copy, describing a future paid perk — no
LLM call, no chat interface, and no backend for it exists in this release.

**Prevents:** reading the Curio+ upsell list as a feature roadmap for *this*
release — which would wrongly suggest a card-level LLM Q&A interface is
expected to work now, and would reopen the "when does AI get it wrong"
fact-check risk this build explicitly isn't taking on yet.

### NG3 — Engagement-maximizing dark patterns

We will never optimize for session length, swipe count, or time-on-app as a
growth lever — even if it would improve vanity engagement numbers.
Concretely, we will not build: streak mechanics or "don't break your streak"
guilt notifications, infinite-scroll with no natural stopping point,
variable-reward randomization beyond the swipe itself (e.g., randomized rare
"special" cards to induce compulsive checking), or push notifications
designed to create anxiety/FOMO rather than deliver a genuine fact.

**Prevents:** the assumption that "more engagement" is automatically good.
Curio's own North Star (cards kept & retained per weekly active user) and
guardrail metric (session length, watched for doom-scroll ballooning)
already say the opposite — a design that maximizes time-on-app would
actively **fail** this product's own success definition. This is the
concrete answer to "what could Curio do badly to a user, and how does the
design prevent it?"

### NG4 — PDF export

We are not building PDF export of the Kept pile. It's listed only as a
future Curio+ perk in the upsell copy — there's no document-generation code,
no download button, no file-format conversion anywhere in this release.

**Prevents:** the assumption that a user's Kept pile can leave the app in
any exportable form today — someone testing "can I save my kept cards
externally" would find nothing behind that promise; it's aspirational
marketing copy, not a built feature.

### NG5 — Curio will not play you a video (this release)

We are not adding video, autoplay, sound, or moving media of any kind in
this release. A card is text you read: topic tag, title, ~150 words, a
source. No video cards, no auto-playing clips, no GIF loops, no background
music. The data model has no media field.

**Prevents:** the assumption that competing for Reels/Shorts users means
becoming Reels/Shorts. Curio's bet is that we steal the **gesture** (the
swipe), not the **format** (the video). The moment a card moves or makes
noise, we're competing on sensory dopamine — a game TikTok has already won.
For this release, text *is* the product; if richer media ever enters, it's a
deliberate future decision, not scope creep.

---

## 3. Narratives — *in progress*

Day 0 / Day N × Greenfield / Brownfield, per the Session 3 structure.

## 4. Requirements & Features — *pending*

## 5. Error Scenarios — *pending*

## 6. Telemetry — *pending*

(The event taxonomy is already implemented in `src/lib/analytics.js`; this
section will formalize it as outcome / behavioural / quality / diagnostic /
guardrail telemetry.)

## 7. Acceptance Criteria — *pending*

## 8. Non-Functional Requirements — *pending*

## 9. Prioritization — *pending*

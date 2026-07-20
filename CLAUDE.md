# Curio — CLAUDE.md

Project guidance for Claude Code working in this repo. Read this first.

## What Curio is

A swipeable, source-grounded reading feed — "Tinder meets Wikipedia." Users swipe
through AI-generated, fact-checked 2-minute knowledge cards. Swipe right = **Keep**,
left = **Pass**. The bet: reuse the Reels/Shorts swipe habit, but the payoff is
retained knowledge instead of nothing.

**Target user:** Indian users, 18–30, who spend 2+ hrs/day on Reels/Shorts, want
to feel like they're learning, but find news apps boring and long articles too much.

## Course context — this is a graded ISB SWPM build (read before scoping)

Curio is the term project for **Software Product Management (SWPM)**, Indian School
of Business, AY 2025-27 Term 6 (instructor Vishal Karungulam). It is a **field-based,
learning-by-doing** course: teams of 5 take one real product through the full PM
lifecycle — customer discovery → problem/solution validation → MVP → ship → measure
— and present at **Demo Day** with *real users and real metrics, not plans*. Claude
Code is named in the syllabus as the sanctioned build toolkit, so building Curio with
Claude is exactly what's intended.

**Hard requirements that shape the build:**

- **Live with real users by Session 7.** Not a prototype — a deployed product real
  people can use. (We're deployed on Vercel already; the gap is real users + a real
  content backend.)
- **Instrumentation from day one — REQUIRED, not optional.** Set up **PostHog or
  Mixpanel** so every core action (onboard, swipe keep/pass, card open, comment,
  paywall view/click) is tracked. This is currently NOT in the app and is the most
  important near-term addition. The product must be *measurement-ready*.
- **Metrics framework + dashboard.** Define a **North Star metric** (candidate:
  cards *kept & retained* per weekly active user — retention of knowledge, not just
  swipes), plus **input metrics** (swipes/session, keep-rate, D1/D7 return) and
  **guardrail metrics** (session length not ballooning into doom-scroll; comment
  toxicity). Build a **Product Metrics Dashboard**. At Demo Day, present funnel,
  cohort/retention, and one root-cause analysis on live data.
- **Ethics is in scope, and Curio is squarely a target.** The course covers
  persuasive technology, dark patterns, variable rewards, and the PM's accountability
  for what the product does *to* users. Curio deliberately reuses the Reels/Shorts
  habit loop — so we must be able to defend the line between *healthy learning habit*
  and *attention capture*: the greyed-out paywall is a conversion nudge (own it as
  one), personalization must not become a filter-bubble/surveillance story, and a
  guardrail metric should watch for compulsive use. Have a clear answer for "what
  could Curio do badly to a user, and how does the design prevent it?"
- **GTM & monetization thinking.** Curio+ (mocked paywall) is the monetization story;
  distribution is India-first (cricket/markets/Bollywood/history as wedge content).
  These need a reasoned strategy for Demo Day, even though payment stays mocked.

**Graded deliverables (map work to these):**

| Deliverable | Type | Weight | Coding scheme |
|---|---|---|---|
| Personas, Problem & Solution Hypothesis | Individual | 15% | 3N-a |
| MVP Feature & Prioritization Rationale | Group | 10% | 2N-b |
| Product Specification Document | Individual | 15% | 4N |
| Product Metrics Dashboard | Group | 10% | 0N |
| Reflection Essay | Individual | 10% | 4N |
| Class Participation | Individual | 10% | — |
| Final Demo | Group | 30% | 2N-c |

**Academic-integrity guardrail (important):** Claude should help **build the product**
and can brainstorm/discuss freely (that's what the course sanctions). But the graded
**individual written documents** — Product Spec and Reflection Essay (**4N**) and the
Personas/Problem-Solution doc (**3N-a**) — must be the student's own original work; do
**not** ghost-write these. 4N forbids external material and collaboration; 3N-a allows
discussing general concepts only. When asked to produce one of these, help the student
think, structure, and critique — but they write it. If unsure how AI assistance maps
onto a coding scheme, the student should confirm with the instructor.

## Current status (2026-07-19)

The React prototype is **built, verified, and shipped live** — pushed to GitHub
([github.com/arcy1410/Curio](https://github.com/arcy1410/Curio)) and deployed on
Vercel (**https://curio-three-iota.vercel.app/**, auto-deploys on push to `main`).
It is still **frontend-only** — seed content + `localStorage`, no backend or LLM yet.
This prototype IS the scaffold the real product grows from.

Working: onboarding topic picker · swipe feed (`react-tinder-card` + Keep/Pass
buttons) · additive topic-weight personalization with a visible "tuning" meter ·
kept pile · per-card comments (one reply level) with a profanity filter · mocked
Curio+ paywall (locked state, no payment) · 22 hand-written source-cited cards ·
dark high-contrast theme with per-topic neon colors, haptics, and micro-interactions.

**Gaps to a course-graded product (in build order):** (1) a **real content backend +
LLM pipeline** (Supabase + Sonnet-generates / Haiku-verifies, Phase 2 below) so cards
aren't a fixed seed set — this is the foundational piece; (2) **analytics
instrumentation** (PostHog/Mixpanel) added *alongside* the Session-4 MVP build — it's
frontend-only so it never blocks on the backend, but only produces signal once real
users are on it, so instrument at build/launch time, not before; (3) **real users** on
the live link by Session 7; (4) a **Product Metrics Dashboard** on live data for Demo
Day. (Course ideal is "instrument from day one," but the syllabus bundles PostHog setup
into the Session-4 build workshop — so backend-then-instrument is the right sequence.)

## Environment gotchas

- **Node** (v24 LTS) is at `/usr/local/bin` and NOT on the default shell PATH.
  Prefix shell commands with `export PATH="/usr/local/bin:$PATH";`.
- `react-tinder-card` needs `@react-spring/web` as a separate peer dependency
  (already installed). Don't remove it.
- After adding a dependency, restart the dev server / clear `node_modules/.vite`
  — Vite pre-bundles deps at startup.

## Commands

```bash
npm install       # install deps
npm run dev       # dev server on http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build
```

## Tech stack

- **Frontend:** React 18 + Vite (web app, not native — skip app-store friction)
- **Swipe UI:** `react-tinder-card` (+ Keep/Pass buttons for click/tap)
- **State (prototype):** `localStorage`. **Production target:** Supabase
  (Postgres + auth + realtime) for users, cards, swipes, comments.
- **Card generation (Phase 2):** LLM API **server-side only** — never expose API
  keys to the frontend.
- **Hosting:** Vercel (auto-detects Vite; build `npm run build`, output `dist`).

## Data model (production target)

```
users:        { id, name, interests: [topic_ids], created_at }
topics:       { id, name, parent_topic_id (nullable) }
cards:        { id, topic_id, title, body, source_url, created_at, verified }
swipes:       { id, user_id, card_id, action: 'keep'|'pass', timestamp }
topic_scores: { user_id, topic_id, score }   // additive, updated per swipe
comments:     { id, card_id, user_id, parent_comment_id (nullable, one level), text, timestamp }
```

The prototype mirrors this shape in `src/data/` and `src/lib/storage.js` so the
Supabase swap is mechanical.

## Content pipeline (Phase 2 — the core trust mechanism, DO NOT SKIP the verify step)

1. Given a topic, pull source material from a **full-text** source (Wikipedia is
   the backbone; Guardian for news; TMDB for film metadata). Prefer full-text
   sources over stats/snippet APIs — the verify step needs a source paragraph to
   check claims against.
2. Prompt the LLM: summarise the source into a ~150-word, 2-minute card. Add no
   fact not present in the source. Cite the source.
3. **Second pass:** "Does this card contain any claim not directly supported by
   the source text below? List unsupported claims." Only set `verified: true` if
   this returns no flags. Never generate a card without a `source_url`.

**Model split (keeps per-card runtime cost low, verify step uncompromised):**
Opus builds the app · **Sonnet generates** cards · **Haiku fact-checks** them.

## MVP scope — BUILD these

Onboarding picker · swipe feed with real fact-checked cards (India-first: cricket,
markets, Bollywood, history) · kept pile · additive topic-weight personalization
(visible shift after ~10–15 swipes) · per-card comment threads (one reply level) ·
basic word-list profanity/spam filter.

## Explicitly OUT of scope (don't build unless asked)

Real payment/subscription (mock the Curio+ paywall as a locked state) · AI Tutor
"ask why" · audio narration · PDF export of kept pile · native mobile (React
Native) · real ML recommendations (additive scoring IS v1) · multi-language content.

**The out-of-scope list is load-bearing** — it prevents over-building. Work
file-by-file; don't try to hold the whole app in one prompt.

## Design direction

Editorial and calm, NOT a dating-app knockoff — readable serif titles, generous
whitespace, favour readability over gamified visual noise. Locked/paywalled
elements should be visible but greyed out (a deliberate conversion nudge). Keep
card design consistent: topic tag · title · ~150-word body · source link ·
Keep/Pass controls.

## Success criteria

A deployed link where a real user can: pick interests → swipe through real,
fact-checked cards → see the feed visibly shift toward kept topics after ~10–15
swipes → view their kept pile → comment on a card.

## Project structure

```
src/
  data/       topics.js, cards.js (seed content), demoComments.js
  lib/        storage.js, scoring.js (personalization), profanity.js
  components/ Onboarding, Feed, Card, TuningMeter, KeptPile, Comments, Profile
  App.jsx     state + routing
```

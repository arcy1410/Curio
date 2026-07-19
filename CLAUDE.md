# Curio — CLAUDE.md

Project guidance for Claude Code working in this repo. Read this first.

## What Curio is

A swipeable, source-grounded reading feed — "Tinder meets Wikipedia." Users swipe
through AI-generated, fact-checked 2-minute knowledge cards. Swipe right = **Keep**,
left = **Pass**. The bet: reuse the Reels/Shorts swipe habit, but the payoff is
retained knowledge instead of nothing.

**Target user:** Indian users, 18–30, who spend 2+ hrs/day on Reels/Shorts, want
to feel like they're learning, but find news apps boring and long articles too much.

## Current status (2026-07-19)

The **clickable React prototype is built, verified working, and committed** (branch
`main`). It is **frontend-only** — seed content + `localStorage`, no backend or LLM
yet. This prototype IS the scaffold the real product grows from.

Working: onboarding topic picker · swipe feed (`react-tinder-card` + Keep/Pass
buttons) · additive topic-weight personalization with a visible "tuning" meter ·
kept pile · per-card comments (one reply level) with a profanity filter · mocked
Curio+ paywall (locked state, no payment) · 22 hand-written source-cited cards.

Not done yet: push to GitHub, deploy to Vercel, and all of Phase 2 below.

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

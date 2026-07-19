# Curio — prototype

A swipeable, source-grounded knowledge feed. Swipe through 2-minute fact cards;
keep what you like, and watch the feed tune toward your interests.

This is the **clickable React prototype** — the scaffold the full product grows
from. It runs entirely in the browser with seed content and `localStorage`; there
is no backend or LLM wired up yet (that's phase 2).

## What works

- **Onboarding** — pick your interests to seed the feed
- **Swipe feed** — drag or use the Keep / Pass buttons (`react-tinder-card`)
- **Visible personalization** — additive topic-weight scoring; the "Your feed
  right now" meter shifts as you swipe (most obvious after ~10–15 swipes)
- **Kept pile** — everything you swiped right on
- **Comments** — one level of replies, per card, with a word-list profanity filter
- **Curio+ paywall** — a mocked locked state (no real payment)

All content is hand-written and source-cited (see `src/data/cards.js`) — in the
real product these cards are LLM-generated from a source document and fact-checked
against it before `verified: true` is set.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build
```

## Stack

- React 18 + Vite
- `react-tinder-card` for swipe gestures
- `localStorage` for state (production: Supabase)

## Deploy (Vercel)

Vercel auto-detects Vite. Framework preset **Vite**, build command
`npm run build`, output dir `dist`. No env vars needed for the prototype.

## Project structure

```
src/
  data/       topics, seed cards, demo comments
  lib/        storage, scoring (personalization), profanity filter
  components/ Onboarding, Feed, Card, TuningMeter, KeptPile, Comments, Profile
  App.jsx     state + routing
```

## Roadmap (out of scope for this prototype)

- Supabase (users, cards, swipes, topic_scores, comments)
- LLM content pipeline: Sonnet generates a card from source → Haiku verifies
  every claim against that source → only then `verified: true`
- Real auth, AI Tutor "ask why", audio narration, PDF export, payments

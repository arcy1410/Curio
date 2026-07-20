# Curio — Constraint Manifesto

*Session 3 artifact (SWPM). The foundational instructions and guardrails our live
build (Session 4) runs against — the core data flow plus the rules any AI agent or
teammate building Curio must obey.*

This is a **team build artifact**. It defines *how* the product is built and what it
must never do. It does **not** contain the individual graded work (the Personas /
Problem-Solution hypothesis `3N-a` and the Product Specification `4N` are each
student's own doc); it's the shared guardrail those build against.

---

## 1. Product, in one line

A swipeable, **source-grounded** knowledge feed — swipe through AI-generated,
fact-checked 2-minute cards; **Keep** (right) / **Pass** (left) tunes the feed toward
what you're curious about. The payoff is retained knowledge, not another dopamine hit.

**User:** Indian, 18–30, 2+ hrs/day on Reels/Shorts, wants to feel like they're
learning but finds news apps boring and long articles too much.

---

## 2. Core data model

```
users:        { id, name, interests: [topic_ids], created_at }
topics:       { id, name, parent_topic_id (nullable) }
cards:        { id, topic_id, title, body, source_url, verified, created_at }
swipes:       { id, user_id, card_id, action: 'keep' | 'pass', ts }
topic_scores: { user_id, topic_id, score }         // additive, updated per swipe
comments:     { id, card_id, user_id, parent_comment_id (nullable, ONE level), text, ts }
```

**Relationships:** a `topic` has many `cards`; a `user` has many `swipes`, `comments`,
and one `topic_score` row per topic; a `card` has many `swipes` and `comments`; a
`comment` may have one parent (replies are one level deep — no deeper threads).

**Invariant:** a `card` **never** exists without a `source_url`, and `verified` is only
`true` after the fact-check pass (§4).

---

## 3. Core data flow

```mermaid
flowchart TD
  subgraph Content pipeline (server-side, Phase 2)
    A[Topic] --> B[Fetch FULL-TEXT source\nWikipedia / Guardian / TMDB]
    B --> C[Sonnet: summarise to ~150-word card\nadd NO fact not in source, cite source]
    C --> D[Haiku: does any claim lack support\nin the source text?]
    D -->|flags found| C
    D -->|no flags| E[(cards\nverified: true, source_url)]
  end

  subgraph User loop (client)
    F[Onboard: pick interests] --> G[Seed topic_scores]
    G --> H[Feed serves next card\nweighted by topic_scores]
    E --> H
    H --> I{Swipe}
    I -->|Keep| J[+score, add to Kept]
    I -->|Pass| K[-score]
    J --> L[record swipe + analytics event]
    K --> L
    L --> H
    H --> M[Comment thread per card\none reply level, profanity filter]
  end
```

Prototype today mirrors this in `src/data/` + `src/lib/` with `localStorage`; Phase 2
swaps the store for Supabase and turns on the content pipeline. The swap is mechanical
because the shapes already match.

---

## 4. The load-bearing rule — content integrity (DO NOT SKIP)

This is the single constraint that makes Curio *Curio* and not "an AI content app":

1. Pull source material from a **full-text** source (Wikipedia backbone; Guardian for
   news; TMDB for film). Prefer full text over stats/snippet APIs — the verify step
   needs a source paragraph to check claims against.
2. **Sonnet** summarises the source into a ~150-word card. Adds **no** fact not present
   in the source. Cites the source.
3. **Haiku** second pass: *"Does this card contain any claim not directly supported by
   the source text below? List unsupported claims."* Set `verified: true` **only** if
   this returns no flags.
4. **Never** generate or store a card without a `source_url`.

**Model split** (low per-card runtime cost, verify step uncompromised):
**Opus builds the app · Sonnet generates cards · Haiku fact-checks them.**

---

## 5. Build guardrails

**Security**
- LLM API calls are **server-side only**. Never expose an API key to the frontend.
- PostHog project key in the frontend is fine (it's a write-only ingest key); nothing
  else secret goes client-side.

**Scope — BUILD these (MVP):**
onboarding picker · swipe feed with real fact-checked cards (India-first: cricket,
markets, Bollywood, history) · kept pile · additive topic-weight personalization
(visible shift after ~10–15 swipes) · per-card comments (one reply level) · basic
word-list profanity/spam filter · analytics instrumentation.

**Scope — do NOT build (out of scope unless explicitly asked):**
real payment/subscription (Curio+ paywall stays a mocked locked state) · AI Tutor
"ask why" · audio narration · PDF export · native mobile app · real ML recommendations
(additive scoring **is** v1) · multi-language content.
*The out-of-scope list is load-bearing — it prevents over-building, the main way these
projects blow past their budget.*

**Personalization**
- Additive scoring only (no ML). Keep the shift **visible** to the user (the tuning
  meter) — transparency is a feature, not a leak.
- **Guardrail:** every topic keeps a small floor weight so the feed never collapses
  into a single-topic filter bubble.

**Tech**
- React 18 + Vite · `react-tinder-card` (needs `@react-spring/web` peer dep) · Supabase
  (Phase 2) · Vercel (auto-detects Vite; build `npm run build`, output `dist`).
- Node v24 at `/usr/local/bin` — prefix shell cmds with `export PATH="/usr/local/bin:$PATH";`.
- After adding a dep, clear `node_modules/.vite` / restart dev server.

---

## 6. Ethics guardrails (persuasive-tech accountability)

Curio deliberately borrows the Reels/Shorts habit loop, so we own the responsibility
that comes with it:

- **Healthy habit, not attention capture.** The win condition is *knowledge retained*,
  not *time on app*. A **guardrail metric** watches for session lengths ballooning into
  doom-scroll behaviour.
- **Honest nudges.** The greyed-out Curio+ paywall is a deliberate conversion nudge —
  we label it as a prototype ("no payment is processed"), never a dark pattern that
  tricks a user into paying.
- **Personalization ≠ surveillance.** Topic scores are transparent and user-visible;
  we don't build a hidden profile or a filter bubble (see the floor-weight guardrail).
- **Consent & data.** Collect the minimum needed; be explicit about what's tracked.

We must have a clear answer to: *"What could Curio do badly to a user, and how does the
design prevent it?"*

---

## 7. Success metrics (measurement-ready from the Session-4 build)

- **North Star (candidate):** cards **kept & retained** per weekly active user —
  retention of *knowledge*, not raw swipes.
- **Input metrics:** swipes/session · keep-rate · D1 / D7 return · cards read to end.
- **Guardrail metrics:** session length (watch for compulsive use) · comment toxicity
  rate · share of feed from the single top topic (filter-bubble check).
- Instrument every core action (onboard, swipe keep/pass, card open, comment,
  paywall view/click) via PostHog **at the Session-4 build**, so Demo Day (S10) can
  show funnel, cohort/retention, and one root-cause analysis on live data.

---

## 8. Riskiest assumptions the MVP must test

*(what the live build is actually a test of — refine with your own discovery)*

1. People will **swipe on text** the way they swipe on video (the core habit transfer).
2. "**Fact-checked / source-cited**" is a trust signal users actually value and notice.
3. The **visible personalization** shift makes the feed feel worth returning to (D7).
4. Enough users find **cricket / markets / Bollywood / history** a compelling wedge to
   come back — before we broaden topics.

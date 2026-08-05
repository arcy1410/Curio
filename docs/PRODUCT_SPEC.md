# Curio — Product Specification Document

**Product:** Curio — a swipeable, source-grounded knowledge feed
**Live:** https://curio-three-iota.vercel.app/ · **Source:** github.com/arcy1410/Curio
**Course:** ISB SWPM, AY 2025-27 Term 6 · **Date:** 2026-07-28

> **How to read the section tags.**
> **[EVIDENCE-BACKED]** rests on primary customer-discovery interviews (n=3),
> quoted directly and cited to the respondent.
> **[FACT]** documents what is built and running today — every number traceable
> to the code or the live database.
> **[JUDGMENT]** is argument or a proposed target, not a finding.
> Open questions are collected at the end.

---

## Vision

**[EVIDENCE-BACKED]**

For curious, time-poor Indians who are a mile deep in one subject and an inch
deep everywhere else, Curio closes the gap between baby-food summaries and
forty-minute lectures: two-minute, source-linked knowledge cards, swiped like the
feed they already use, that treat them as **intelligent beginners** rather than
as novices or experts.

---

## Reason

**[EVIDENCE-BACKED — see Problem Hypotheses for the interview basis]**

Three interviews with people across the target range converged on one gap, and
it is not the gap the product was originally pitched against.

1. **The intelligent-beginner gap is the real problem.** Every respondent
   independently described it without being prompted: content is *"either
   baby-food or a lecture."* Rio tried to learn crypto and found *"either a
   thirty-second Reel that told me nothing or a forty-minute video that assumed I
   knew everything."* Raghav gave up on macroeconomics because *"the material is
   either dumbed-down or a textbook, nothing in between."* Ashish avoids news
   apps because they don't go deep. Three very different people, one shape of
   complaint.
2. **Trust is a hard gate, not a nice-to-have.** *"I don't have an attention
   problem, I have a trust problem… catch one wrong claim and I'm out."* Against
   AI-generated content this is not scepticism to be overcome; it is a pass/fail
   test applied at first contact.
3. **The habit is already built.** *"A ten-second gap and my thumb just did it."*
   Nobody has to be taught to swipe. The gesture is free distribution.

**The correction the evidence forced.** This document previously argued that the
driver was *guilt* — that users feel bad after scrolling and want redemption.
The interviews only partly support that and one respondent flatly rejected it:
*"I don't get the guilt thing. If I decided to switch my brain off, then I
achieved the goal."* Another described his guilt as **professional** — that he
should have been scrolling more *usefully* — which is a different emotion doing
different work. Guilt is therefore demoted to a secondary motivator. The
durable, evidenced driver is the **stated desire to be interesting outside one
domain**: *"I want a few more inches everywhere."*

Curio's bet is that the barrier is **format and trust, not appetite**. The
appetite is demonstrated — these people already seek out 3Blue1Brown videos,
gazette notifications, and football essays. What does not exist is a trustworthy
two-minute version.

**Why now:** LLM generation makes a continuously refreshed, topic-diverse library
economically possible at team scale. The same capability creates the product's
central risk — confident fabrication — which is exactly the risk Raghav names,
and why the fact-check gate (G3) is a structural invariant rather than a quality
target.

---

## Personas

**[EVIDENCE-BACKED]**

Built from three primary customer-discovery interviews, purposively sampled
against the target profile (~1.5+ hrs/day short-form video plus some appetite for
staying informed), each coded for Jobs to Be Done, Pains and Gains. Full
transcripts and the interview guide are in the companion Personas & Problem
Hypotheses document.

| Interviewee | Age | Role | Persona |
|---|---|---|---|
| Ashish | 25 | Student, ISB | Curious Scroller |
| Rio | 24 | Digital Content Editor, Sportskeeda | Curious Scroller *(industry insider)* |
| Raj | 28 | HR Business Partner, D. E. Shaw | Skeptical Reader |

**Stated sample limitation, carried forward rather than hidden:** n=3 against a
recommended 5–7, and all three are male, urban, knowledge-workers aged 24–28.
The personas lean that way, and the product's stated target is 18–30 — **the
sample does not currently reach the younger half of it.** Referrals are collected
for a Reels-heavy contrast, a digital-detox non-user, and a serious
finance/consulting reader.

### P1 — Aditya Menon, "The Curious Scroller" *(primary — from Ashish + Rio)*

> *"I'm a mile deep in one thing and an inch deep in everything else — and
> everything out there is either baby-food or a lecture."*

- **Who:** 24–26, urban India, tech / content / knowledge work. 2+ hrs/day on
  short-form, much of it habitual — *"my thumb just did it."*
- **Job to be done:** feel he gained something from screen time.
- **Goal:** become *"interesting outside my one thing"* — a few inches of real
  knowledge across more topics, so he isn't only "the sports guy" or "the code
  guy."
- **Attitude:** sceptical of news and summary apps — *"the illusion of being
  informed."* Believes short content *can* be good, having seen it work; the
  format isn't the enemy, the **quality and tone** are.
- **Pains:** the baby-food-vs-lecture gap · shallow summaries · **generic,
  voiceless AI content** · anything that wastes his time.
- **What works:** a hook, one clear point, a payoff — in two minutes — plus a
  link to go deeper.
- **Currently uses:** Reels, Shorts, YouTube long-form, Gemini/ChatGPT to find
  sources and books. **Abandoned Inshorts.**
- **Would churn if:** the writing is flat. *"If it reads like an encyclopedia
  I'll swipe away instantly — it needs a voice or it's just Inshorts again."*

### P2 — Raghav Iyer, "The Skeptical Reader" *(secondary / edge case — from Raj)*

> *"I don't have an attention problem, I have a trust problem. The moment I catch
> one wrong claim, I'm out — I won't trust any of it."*

- **Who:** 27–29, urban India, a professional whose credibility depends on
  accuracy (HR / finance / consulting / law-adjacent). **Barely uses Reels** —
  only opens what is forwarded. Reads deliberately; long-form is a protected
  weekend ritual.
- **Job to be done:** learn one solid thing a day he could correctly explain to a
  colleague. Depth and accuracy over volume.
- **Attitude:** distrusts anonymous forwards and unsourced content by default.
  Wants raw facts, not interpretation — *"give me the what, I'll do the so-what."*
- **Pains:** bias and conflicting framings · unsourced content · nothing pitched
  between dumbed-down and textbook.
- **What works:** content that shows its source and points to the full piece.
  *"Two minutes is fine as an appetiser as long as it's honest that it's an
  appetiser and points me to the full meal."*
- **Why an edge case is worth carrying:** he has no scroll habit at all, so he
  will never be the volume user. He earns his place by **defining the trust bar
  the product must clear** — and that bar is the product's whole reason to exist.

**How the personas map onto the build.** P1 is who the feed, the streak and the
daily set are for. P2 is why *"Why it's true ↗"* has the shortest path in the
product and why G3 is a database policy rather than a promise. Where they
conflict — P1 wants voice and personality, P2 wants unembellished fact — the
conflict is real and is recorded as a risk, not resolved by assertion.

---

## Problem Hypotheses

**[EVIDENCE-BACKED]**

Two distinct problems and one cross-cutting problem emerged from coding the
interviews for Jobs to Be Done, Pains and Gains.

### PH1 — Primary

> The **habitual short-form scrollers (18–30)** who want to feel they're learning
> are most frustrated about **turning daily scroll time into something they
> actually retain**, because the content available is either too shallow to be
> substantive or too long and effortful to consume — with nothing that respects a
> smart beginner in a two-minute, source-backed format.

**Evidence:** Rio (*"empty, slightly guilty"*; *"only 'the sports guy'"*), Ashish
(avoids news apps for lacking depth; uses Gemini to find books instead).

### PH2 — Secondary

> The **credibility-driven serious readers** are most frustrated about **quickly
> learning something accurately enough to use professionally**, because
> short-form content is unsourced and untrustworthy, while trustworthy long-form
> demands time they can only give at weekends — leaving no fast, verifiable
> option they will actually believe.

**Evidence:** Raj (bluffed on labour codes at a team lunch, then read the gazette
notification that night; filters WhatsApp forwards by whether the source is
named).

### PH3 — Cross-cutting *(the strongest converging insight)*

> The **curious-but-time-poor knowledge workers across both segments** are most
> frustrated about **finding content pitched to an intelligent beginner in a
> specific topic**, because everything defaults to either oversimplified
> baby-food or expert-level lectures, with no trusted middle that meets them
> where they are.

**Why this is the one to build against:** all three interviewees described it
independently, unprompted, despite having almost nothing else in common — one
scrolls for a living, one barely scrolls at all. Convergence across a
deliberately spread sample is the strongest signal three interviews can produce.

### Solution hypotheses — what the build still has to prove

PH1–PH3 are the customer problems, established by discovery. These are the
product's *bets about the remedy*, and none of them is validated yet — each is
instrumented and waiting on a live cohort.

| # | Solution hypothesis | How it would be falsified | Status |
|---|---|---|---|
| SH1 | The swipe gesture transfers to knowledge cards without instruction | First-time users stall on the deck, or use only buttons | **Partially supported** — *"I like the swipe, that's my native language"* (Rio). Needs live `card_swiped {method}` data |
| SH2 | A visible, checkable source resolves the trust objection | `source_link_clicked` near-zero, or source-clickers don't return at a higher rate | **Verbally supported, unmeasured** — *"If every card showed exactly where it came from… I'd try it"* (Raj) |
| SH3 | Two minutes is enough **if** it is honest about being an appetiser and points to the full meal | Users read the card and never go deeper; `card_detail_opened` and `source_link_clicked` both near-zero | **Verbally supported, unmeasured** — this is the design rationale for the two destinations on a card |
| SH4 | Visible personalization beats invisible personalization | Tuning meter never opened; no difference in return rate | **Untested** — `tuning_meter_toggled` |
| SH5 | A guess-first quiz format produces better recall than a read-only card | High reveal rate but low return/review completion | **Untested** — the retention mechanic rests entirely on this |
| SH6 | Users will trade an account for their history once they can see something worth keeping | High gate abandonment at 3 swipes | **Untested** — `signup_gate_shown` vs `signup_completed` |
| **SH7** | **Generated cards can carry enough voice to escape the "just Inshorts again" verdict** | Users describe the writing as flat, generic, or obviously AI; keep-rate and return-rate stay low despite correct facts | **Untested, and the least defended** — see below |

**SH7 is the hypothesis this spec was missing, and discovery put it there.**
Rio is a professional content editor and named the failure mode precisely:
*"if it's AI I'll smell the genericness a mile off"* and *"flat and correct is
worse than short and characterful."* Curio's generation prompt optimizes for
groundedness — *add no fact not present in the source* — which is the right
constraint for G3 and a direct pressure toward exactly the voicelessness that
killed Inshorts for both Curious Scrollers. **The product currently has no
measure of tone quality at all.** Every other hypothesis has an event behind it;
this one has nothing.

**Concept-check reactions, reported without inflation:** Ashish — *"I would
definitely try this out. At least once."* Raj — *"If every card showed exactly
where it came from, a real link I could verify, I'd try it."* Rio — *"Genuinely
I'd use it… let me stress-test the writing quality, I'll be brutal."* These are
**stated intent from a warm sample who knew it was the interviewer's project**,
not demand. They justify building; they do not evidence retention.

---

## Solution Summary

**[FACT]**

A mobile-first web app (no install, no app store) with four surfaces:

- **Feed** — a daily set of guess-first quiz cards drawn from a personalized,
  weighted pool. Four labelled controls: *Later · Go deeper · Like · Keep*.
- **Discover** — every topic browsable, including ones the user never picked.
  The deliberate anti-filter-bubble surface.
- **Kept** — saved cards, capped at 20 on the free tier, with spaced-repetition
  review scheduling.
- **You** — streak, daily goal, interests, tuning meter, account.

Behind it: a Supabase Postgres store of **50 cards across 6 topics, every one
`verified: true` with a cited `source_url`**, filled by a server-side pipeline
that pulls trending headlines, grounds on full-text sources, generates, and then
**independently fact-checks before storing**. A card that fails verification
never exists as far as any user is concerned — enforced by a row-level security
policy, not by application code.

---

## Goals

**[FACT — the goals; JUDGMENT — the targets]**

### P0 — must be met at MVP1

| ID | Goal | Measure |
|---|---|---|
| **G1** | **Activation.** A first-time visitor reaches their first card in under 60 seconds, with no account, choosing as few as 2 interests. | ≥75% of `onboarding_started` reach `card_viewed`; median time under 60s |
| **G2** | **Visible personalization.** The feed shifts toward topics the user engages with, and says so out loud. | Top topic's share of `card_viewed` in the first 9 swipes vs. the **16.7%** uniform baseline (6 topics × 10 cards). Simulation of the shipped scoring code reaches **56.2% — 3.37× baseline** |
| **G3** | **Trust — a hard invariant.** Every served card carries a cited source and has passed the fact-check step. No exceptions, ever. | 100% of served cards have `verified: true` and a non-empty `source_url`. Enforced by RLS: an unverified draft is *unreadable* by any client key |
| **G4** | **Save & return.** A user who keeps a card comes back and re-reads it. | D1/D7 return among users with `kept_count ≥ 1`; `kept_card_opened` |
| **G5** | **Discovery beyond the bubble.** Any topic is readable without redoing onboarding. | Share of `discovery_topic_selected` where the topic is *not* in the user's onboarding interests |

### P1 — desirable, cuttable

| ID | Goal | Measure |
|---|---|---|
| **G6** | **Retention of knowledge, not just of users.** A kept card is resurfaced for review on a spaced schedule and the user completes it. | `review_completed {card_count}` |
| **G7** | **A regular habit, not a long one.** Users return on more days, not for longer sessions. | `daily_set_completed` frequency ↑ while `session_ended.duration_s` stays flat |

**G2, re-derived — and the re-run changed the argument, not just the number.**
The earlier claim (23.8% baseline, ~2×) was measured against a 4-topic, 21-card
library. Re-simulating the shipped scoring code across three library sizes:

| Library | Baseline | Simulated share | Favourite topic exhausted inside 9 swipes |
|---|---|---|---|
| 4 topics, 21 cards *(old)* | 23.8% | 52.2% — 2.19× | **73.8% of users** |
| 6 topics, 50 cards *(today)* | 18.0% | 58.0% — 3.22× | 0.2% |
| **6 × 10 = 60 *(MVP target)*** | **16.7%** | **56.2% — 3.37×** | **0.0%** |

The model is stated so it can be argued with: a user picks 2 interests, reveals
and Likes every card in their favourite topic (+4), passes everything else (−1),
no card is re-served.

**The exhaustion column is the finding, not the ratio.** The old ~2× was not
wrong, but it was measured on a feed that was already failing — three quarters
of simulated users ran their favourite topic dry *inside the measurement
window*, so the personalization claim collapsed at precisely the point it needed
to hold. Ten cards per topic removes that ceiling entirely, and the ratio
*improves* as topics are added, because more topics lower the baseline while the
scoring still concentrates on the favourite.

---

## Non-Goals

**[FACT]**

| ID | Not building | The misunderstanding it prevents |
|---|---|---|
| **NG1** | Real payments. Curio+ is a visible locked state and a toast — no processor, no stored card, no subscription. | That "Go Curio+" is live commerce needing PCI scope, refunds, or app-store billing. |
| **NG2** | AI Tutor / "ask why" chat. Appears only as upsell copy. | That the Curio+ bullet list is this release's roadmap. |
| **NG3** | **Engagement-maximizing dark patterns.** No infinite scroll without a stopping point, no variable-reward randomization beyond the swipe, no FOMO notifications. | That "more engagement" is automatically good. Curio's own North Star says the opposite — a design that maximizes time-on-app **fails** this product's success definition. |
| **NG4** | PDF export of the Kept pile. | That kept cards can leave the app today. |
| **NG5** | Video, autoplay, sound, or moving media of any kind **in this release**. A card is text you read; the data model has no media field. | That competing for Reels users means becoming Reels. Curio steals the **gesture**, not the **format**. The moment a card moves, we compete on sensory dopamine — a game TikTok has won. *Scope note: user-initiated **audio narration** is planned as the V3 Curio+ feature. It is out of scope here, not ruled out forever — see Roadmap for the autoplay line that must hold when it lands.* |
| **NG6** | Multi-language content, native apps, real ML recommendations. | That additive topic-weight scoring is a placeholder. It *is* v1. |

**NG3, amended — the honest version.** NG3 originally ruled out streak mechanics
outright. A streak now exists, so the rule was narrowed rather than quietly
dropped: what NG3 forbids is **loss aversion**, not the counter.

- No "don't lose your streak" prompts and no streak notifications.
- **One grace day** — a single miss costs nothing.
- **No reward for exceeding the daily goal** — asserted in `tests/streak.test.mjs`,
  so the rule is enforced by a test, not by intent.
- The streak is *derived* from daily progress, never stored, so it cannot be
  manipulated as a currency.

**The falsifier is written down:** if `session_ended.duration_s` shows streaks
producing *longer* sessions rather than *more regular short ones*, the mechanic
comes out. That is the concrete answer to "what could Curio do badly to a user."

---

## MVP

### a. MVP 1 Features

**[FACT]**

**What constitutes the MVP:**

1. Onboarding — pick ≥2 of 6 topics, set a daily goal (3 / 5 / 10 cards)
2. Feed — daily set of guess-first quiz cards, four labelled controls
3. Personalization — additive topic weights with a visible tuning meter
4. Trust — cited source on every card, `verified: true` enforced at the database
5. Discover — browse any topic, filter by subtopic
6. Kept — save cards, 20-card free cap, spaced-repetition review
7. Comments — shared per-card threads, one reply level, server-side profanity filter
8. Identity — anonymous by default, Google sign-in at the 4th swipe-action
9. Streak + daily goal
10. Curio+ — mocked paywall on three locked features
11. Content pipeline — server-side generate-and-verify, refills the library
12. Instrumentation — PostHog, explicit event taxonomy, no autocapture

**Why it is minimal:** every item above is required by the one-sentence success
claim — *pick interests → swipe real fact-checked cards → see the feed shift →
view your kept pile → comment*. Remove any one and the claim breaks. The
verify step is the only item that looks optional and is not: without it Curio is
an AI content feed with the same trust problem as every other AI content feed,
and the product has no reason to exist.

**Why it is viable:** it is deployed, it is usable by a stranger on a phone with
no install and no signup, and the content library refills itself. A user can
complete the entire loop today.

**What user need it solves:** the two-minute gap between "I want to feel like I
learned something" and "I am not going to read a 2,000-word article on my phone
at 11:40pm."

### b. User Narrative

**[FACT — this describes the shipped interface]**

**Platform:** responsive mobile-first web app (React 18 + Vite, deployed on
Vercel). Not native — deliberately, to skip app-store friction for a course
timeline. Minimum viewport 375px (iPhone SE class). Every swipe action has both
a gesture *and* a labelled button.

**The core interaction, card by card:**

A card opens as a **question**, not an answer — "Which outlaw group adopted
cricket in 1700s India?" The user guesses in their head and taps **Reveal**. The
answer opens as a scrollable panel with the ~150-word body.

From the revealed answer there are exactly **two destinations, and they do not
overlap**:

- **"Why it's true ↗"** → the **source**, immediately, leaving the app. This is
  the trust promise, so it gets the shortest path. The ↗ marks that it leaves.
- **Tapping the answer panel itself** → the **detail sheet** (same as *Go
  deeper*). After reading an answer the natural next move is "tell me more," and
  the panel is the largest target on the card.

Because the panel also scrolls, a tap is distinguished from a scroll by
**movement, not duration** — under 10px of finger travel and under 4px of
scroll. There is deliberately **no time limit**: an earlier 700ms cap silently
rejected slow taps, and duration says nothing about intent.

**The four controls, and why Like and Keep are separate:**

| Control | Effect | Score |
|---|---|---|
| **Later** | Pass — card leaves the deck | −1 |
| **Go deeper** | Opens the full detail sheet | +5 if held 15s (`card_deep_read`) |
| **Like** | Tunes the feed, costs nothing | +3 |
| **Keep** | Commits the card to the Kept pile (capped at 20) | +5 |
| *(Reveal)* | Opening the answer is itself a signal | +1 |

Merging Like into Keep — as an earlier design draft did — means every merely
interesting card spends one of the user's 20 free save slots. The separation is
the product: **Like is free and unlimited, Keep is scarce and deliberate.**

**One card contributes at most +5, once.** A user who goes deep *and* keeps the
same card does not score +10 — enforced in `applyTopSignal()` and asserted in
`tests/scoring.test.mjs`.

**The daily set and the streak:** the user picked a goal at onboarding — *A
taste* (3 cards, 2 min), *A habit* (5 cards, 4 min), or *A deep dive* (10 cards,
9 min). Finishing the set completes the day. The streak is derived from the
per-day progress record; one grace day; exceeding the goal earns nothing.

**Review:** kept cards return on a Leitner schedule — 1, 3, 7, 16, 35, 90 days —
labelled *New · Fading · Solid*. **No card is ever marked "mastered"**, because
claiming permanent retention is a claim the product cannot support.

---

## First Day Experience — Day 0

### Customer Experience Narrative — New (Greenfield)

**[FACT — describes the shipped flow]**

**Aditya (P1)** taps a link a friend shared in a group chat at 11:40pm — the
ten-second gap where his thumb usually opens Reels. No app store, no signup. A
screen shows a **sample card** — the thing itself, not a description of it — with
"Two minutes a day. Facts that stick."

He taps Continue. *"What are you curious about?"* — six colour tiles. He is
unsure how many to pick; the button reads **"Pick 2 more,"** which resolves it
without a paragraph of instruction. He taps **Cricket** and **Markets** —
markets being the "second thing" he has been meaning to have an opinion about.

*"How big is your appetite?"* — three goals. He picks *A habit*, 5 cards, 4
minutes. The goal is chosen, not assigned: a goal the product picks for you is a
demand; one you pick is a commitment.

The first card is a **question** about the 1983 World Cup final. He guesses, taps
**Reveal**, and reads the answer. His first real judgement is on the *writing* —
this is the moment SH7 is won or lost, and it happens before any feature does.
Then he notices **"Why it's true ↗"** and taps it. The real Wikipedia article
opens. That lands: the card was not making it up.

He works through his set of 5. On card 3 he taps **Keep** — a toast confirms
"Saved ♥". On his **4th swipe-action** the deck stops and the **auth wall**
appears: *keep what you have built.* The card underneath stays readable. He signs
in with Google; nothing resets, because linking Google to his existing anonymous
account preserves the same account id — **there is no merge step**.

He finishes the set. The streak reads 1. Nothing nags him to continue. He closes
the tab at 11:55.

**Success:** 5 cards read, 1 kept, 1 fact he could repeat at a party, and no dark
pattern holding him there.

**Known friction, not hidden:** the auth wall interrupts a first session. It sits
at 3 swipes rather than 7 because the daily set defaults to 5 — a gate at 7 could
never fire on day one, so the account needed to keep his history would never be
offered. Three is also where the claim becomes honest: by the third card the feed
has visibly begun tuning.

**The variation this narrative does not cover — P2's first session.** Raghav
arrives via a forward, not a habit. He will not swipe five cards to evaluate the
product; he will read **one** card and go straight to its source. If the source
supports the claim he may return at the weekend; if it does not, he is gone
permanently and will not be won back. **His entire first-run experience is the
source link**, which is why it is a top-level control rather than a footnote.

#### Requirements

| Feature name | Requirement | Priority |
|---|---|---|
| Topic picker | Show all 6 topics with name, blurb and subtopics before choosing; select/deselect freely; confirm only at ≥2, with the CTA stating how many more are needed | **P0** |
| No-account start | Onboarding completes with no email, account or personal data | **P0** |
| Seeded scores | Chosen interests seed +4 each; unchosen topics start at 0 but stay servable via a floor weight — no topic is ever fully excluded | **P0** |
| Daily goal | Offer 3 / 5 / 10-card goals with honest minute estimates; store the user's choice | **P0** |
| Sample card | Step 0 shows a real card shape before asking for anything | **P1** |
| Quiz card render | Card opens as a question; Reveal opens a scrollable answer panel | **P0** |
| Source link | Every card shows "Why it's true ↗" linking to `source_url`; opens on `pointerdown` so it works on touch | **P0** |
| Verified-only serving | Only `verified: true` cards with a non-empty `source_url` are ever drawn — enforced by RLS, not application code | **P0** |
| Four labelled controls | Later / Go deeper / Like / Keep, each working by gesture *and* button with identical results | **P0** |
| Anonymous identity | Mint an anonymous Supabase user on first write so every row has an owner | **P0** |
| Sign-in gate | Block the 4th swipe-action; show the auth wall with the current card visible beneath; reading, Kept and Discover stay open | **P0** |
| Google sign-in via linking | Use `linkIdentity` on an anonymous session so the account id survives; fall back to plain sign-in when the identity already belongs to an account | **P0** |
| Storage-failure tolerance | Private mode / quota exhaustion must degrade, never crash or block | **P0** |
| Telemetry | `onboarding_started`, `onboarding_topic_toggled`, `onboarding_completed`, `card_viewed`, `quiz_revealed`, `card_swiped`, `card_saved`, `source_link_clicked`, `signup_gate_shown`, `signup_completed`, `signup_abandoned`, `signup_failed` | **P0** |

### Customer Experience Narrative — Existing (Brownfield)

**[FACT]**

Aditya has used Curio for a week under the previous build, where the feed was a
plain card deck and a right swipe meant *Keep*. He opens his usual tab after the
redesign ships.

**Nothing asks him to re-onboard.** His Kept pile still holds all 5 cards; the
tuning meter still reads *Leaning History*. His stored state loads into the new
schema with new fields defaulting safely.

The deck now shows **labelled buttons** — *Later · Go deeper · Like · Keep* — so
he reads what each control does rather than discovering it by losing a card. This
is why the planned migration-notice modal (R8) was **retired**: a modal
explaining labelled buttons is friction with nothing left to justify it, and it
would have greeted every existing user on open.

The `stateVersion` field remains and still migrates silently, emitting
`migration_notice_shown {surface: 'silent'}` so a semantics change stays
countable. **The standing rule:** if a future release changes what a gesture
*means* without changing what it *says*, the visible cue comes back.

He tries **Discover** — all six topics, including Technology and Hollywood, which
did not exist last week. He reads two cards and keeps one. Back on his feed,
History still dominates; exploring reset nothing.

**Exposed by this narrative and not yet solved:** his history lives in
`localStorage`. If he opens Curio on his laptop, he starts from zero. Identity
now exists, so the fix is mechanical — but until it ships, cross-device return is
broken and none of that behaviour is queryable for the metrics dashboard.

#### Requirements

| Feature name | Requirement | Priority |
|---|---|---|
| Lossless schema migration | Existing stored state loads into the new schema with new fields defaulting safely; never a reset feed | **P0** |
| `stateVersion` | Written on every save; any release changing gesture *meaning* must bump it and ship a cue | **P0** |
| Labelled controls | Controls state their action in words, removing the need for a migration modal | **P0** |
| New topics appear without re-onboarding | Hollywood and Technology are browsable in Discover and servable in the feed without re-running onboarding | **P0** |
| Edit interests | Reopen the picker pre-filled; add/remove subject to the same ≥2 minimum; cancel without consequence; **editing never resets learning** | **P0** |
| New-topic parity boost (R7) | A newly added topic is set to the user's current **maximum** topic score, not a token bonus weeks of tuning would drown out; ≥1 card from it served within the next 3 draws | **P1** — *not yet built* |
| Cross-device continuity | Swipes, saves and topic scores must live server-side so a second device restores them | **P0** — *largest open gap; still `localStorage` only* |
| Anonymous-session merge | If a user built history anonymously and then signs into a pre-existing account, push the local activity up rather than discarding it (`pushLocalToServer`) | **P0** |
| Telemetry | `migration_notice_shown {surface}`, `interests_edit_started`, `interests_updated {added, removed}`, `discovery_opened`, `discovery_topic_selected` | **P0** |

---

## Day N Experience

### Customer Experience Narrative

**[FACT]**

Day 4. Aditya opens Curio during his commute. The feed leans **Markets** — the
meter says so, and he has stopped being surprised by it. His set is 5 cards and
takes four minutes.

Two of today's cards are **review cards** — things he kept on day 1, resurfaced
on the Leitner schedule and labelled *Fading*. He gets one right and one wrong.
The wrong one drops back to a shorter interval. Neither card is ever marked
"mastered."

Card 3 is about a market scandal. He taps **Go deeper**, reads the full sheet for
half a minute, and taps **Keep**. His Kept pile reads **17/20** — the counter
appears from 15 onward, so the cap arrives as information rather than as a wall.

He opens **comments** on a card and finds someone else's thread — comments are
genuinely shared, not a per-browser mirror. He replies once; a second-level reply
shows a 🔒 and the Curio+ nudge.

He finishes his set. The streak reads 4. He misses day 5 entirely — and on day 6
the streak still reads 5, because of the grace day. **Nothing told him he almost
lost it.**

Around day 8 he hits the **20-card cap** on a save. The card is not added, no
score changes, the deck does not advance, and the Curio+ nudge appears. This is
the product's highest-intent monetization moment and it is instrumented as one
(`save_limit_reached`).

**What the discovery evidence says Day N actually turns on.** The mechanics above
are built and testable; the thing that decides whether Aditya reaches day 4 at
all is whether cards 1–15 read as *written* rather than *assembled*. Both Curious
Scroller interviewees abandoned Inshorts, and neither cited accuracy — Rio called
it *"content with the soul removed — facts stapled together, no voice."* Day N
retention is a **tone** problem before it is a feature problem, and the product
has no instrument pointed at it (SH7).

#### Requirements

| Feature name | Requirement | Priority |
|---|---|---|
| Weighted draw | Draw each next card from unseen `verified: true` cards, weighted by current topic scores. **Generation never runs in the serving path** — a swipe never waits on an LLM | **P0** |
| Score ladder | Pass −1 · Reveal +1 · Like +3 · Deep read +5 · Keep +5; **one card contributes at most +5, once**, whichever order | **P0** |
| Tuning meter | Show current topic weights on demand; reflect a swipe before the next card is drawn | **P0** |
| Daily set + streak | Set sized by the user's goal; streak **derived** from daily progress, one grace day, **no reward for exceeding the goal** | **P0** |
| Spaced review | Kept cards resurface on 1/3/7/16/35/90-day intervals, labelled New · Fading · Solid; **no "mastered" state** | **P1** |
| Kept pile + cap | 20-card free cap. The 21st save is blocked — not added, not scored, no advance — with the Curio+ nudge. **Blocks new saves only; never deletes.** Counter shown from 15/20 | **P0** |
| Kept full-card reopen | A kept card must be re-openable in full — "cards kept *and retained*" is unmeasurable if a kept card cannot be re-read | **P0** |
| Shared comments | Every user sees every other user's thread; one reply level free | **P0** |
| Server-side comment rules | Profanity and one-level-reply limits enforced as **database triggers**, so they hold against a direct PostgREST call that bypasses the app | **P0** |
| Comment author names | `author_name` denormalized onto the comment row via a `security definer` trigger — a join to `profiles` returns NULL for other users under RLS, silently | **P0** |
| Locked nested reply | Depth-1 replies show a 🔒 control — visible, tappable, never opens a composer; fires `paywall_clicked {feature: nested_reply}` | **P1** |
| Swipe undo | Visible-but-locked Curio+ control. **Deferred from this release** | **P2** |
| Feed exhaustion | Caught-up state distinguishes "you have read everything" from "the store has not grown in N hours" — these must not share a message | **P1** |
| Content pipeline | Scheduled server-side runs: trending headlines → full-text grounding → generate → **independent verify** → store. Bounded retries, capped per-run volume, spread across topics | **P0** |
| **Editorial voice** | Cards must read as written, not assembled — a hook, one clear point, a payoff, no padding and no "you won't believe." The generation prompt must carry an explicit voice constraint alongside the groundedness constraint, because groundedness alone optimizes toward flatness | **P0** — *the constraint exists in the design direction; it is not enforced or measured* |
| **Tone quality measurement** | Some instrument that would catch "this reads like Inshorts" before churn does — e.g. a per-card thumbs signal, keep-rate by card, or periodic human editorial review sampled from live cards | **P0** — *not built; the only unmeasured hypothesis in the product (SH7)* |
| Telemetry | `card_deep_read {dwell_ms}`, `card_detail_opened`, `quiz_revealed`, `card_unsaved`, `save_limit_reached`, `daily_set_completed {goal_cards, streak_days}`, `review_completed {card_count}`, `daily_goal_changed`, `kept_card_opened`, `kept_pile_viewed`, `comments_opened`, `comment_posted`, `comment_rejected {reason}`, `paywall_viewed`, `paywall_clicked {feature}`, `feed_exhausted`, `feed_replayed`, `tuning_meter_toggled`, `tab_changed` | **P0** |

---

## Monitoring & Troubleshooting

### Customer Experience Narrative

**[FACT for what exists; JUDGMENT for the operator view, which does not]**

There are two audiences here, and conflating them is a mistake the spec makes
explicit.

**The user's experience of failure.** Curio's failures are mostly invisible by
design, and the ones that are visible must be honest rather than reassuring:

- **Auth unreachable at the gate.** The wall says *"Can't reach sign-in right
  now. Your progress is saved — try again in a moment."* No spinner implying
  self-resolution; no silent fallback that would defeat the gate and mask the
  failure. **Fail closed on the gate, open on reading.**
- **Sign-in refused because the Google account already belongs to a Curio
  account.** This is a *returning user*, not an error. The app reads the failure
  out of the OAuth callback hash and automatically retries as a plain sign-in,
  then pushes the throwaway session's activity into the real account.
- **Sign-in that goes nowhere.** A 4-second watchdog clears the busy state and
  says so. A stuck control is worse than a failed one: it gives the user no way
  to retry and no reason why.
- **Sync failure after sign-in.** **Local state is never deleted until the server
  confirms the write.** The user never sees a reset feed; a background retry runs
  and, if it exhausts, says *"We couldn't sync your earlier swipes. Keep going —
  nothing local was lost."*
- **Pipeline stalled.** The caught-up screen says *"You're caught up — new
  fact-checked cards land daily"* rather than dressing a stalled pipeline as "you
  are just very well-read."

**The operator's experience.** The PM needs to answer, before a user reports it:
is the pipeline producing? are cards passing verification? is the funnel
converting? Today the pipeline run returns generated / passed / flagged /
discarded counts per run, but **there is no dashboard** — this is the largest
gap between the built product and the course deliverable.

#### Requirements

| Feature name | Requirement | Priority |
|---|---|---|
| Honest failure copy | Every user-visible failure states what happened and what to do; never a spinner implying self-resolution | **P0** |
| Fail closed on gate, open on reading | Auth failure blocks swiping but never blocks reading, Kept or Discover | **P0** |
| Already-linked recovery | Read the OAuth callback error and auto-retry as plain sign-in; the returning user gets their real account back | **P0** |
| Sign-in watchdog | Clear the busy state after 4s with an actionable message | **P0** |
| Never-lose-local rule | Local state survives until the server confirms the write; a failed sync is "slower sync," never "silent data loss" | **P0** |
| Error surfacing over swallowing | `supabase-js` resolves with `{error}` rather than rejecting — every write is explicitly checked and converted to a throw, or `try/catch` is dead code and divergence is silent | **P0** |
| Pipeline per-seed isolation | A single source timeout must not abort a whole run and discard topics that already succeeded | **P0** |
| Pipeline run telemetry | Per run: generated / passed / flagged-retried / discarded counts, discard reasons, per-card cost | **P0** |
| **Product metrics dashboard** | Funnel, cohort/retention, and one root-cause view on live data | **P0** — *not built* |
| Operator view for pipeline health | Pipeline telemetry is **operational**, not product analytics — it needs its own surface, not folding into PostHog | **P1** |
| Diagnostic events | `signup_failed {reason}`, `comment_rejected {reason}`, `feed_exhausted {cards_seen, hours_since_last_new_card}` | **P0** |

---

## Non-functional Requirements

**[FACT]** Each number is tagged **[measured]**, **[derived]** (follows from a
spec rule) or **[estimate]** (judgment — revisit).

#### Requirements

| Feature name | Requirement | Priority |
|---|---|---|
| **Interaction latency** | Swipe-to-next-card never waits on the network; next card renders within ~100ms **[estimate]** from the prefetched deck. No LLM, no fetch in the interaction path **[derived]** | **P0** |
| **Gesture integrity** | State changes must not re-render mid-drag — doing so tears down the gesture library's handlers. The drag stamp is applied via a DOM attribute, not React state **[measured — this was a real bug]** | **P0** |
| **Touch event model** | The gesture library attaches **native** pointer listeners; native events reach them before React's synthetic system. **Any control inside a card must act on `pointerdown`, not `click`** **[measured — four separate bugs were invisible to desktop testing]** | **P0** |
| **Scroll containment** | `touch-action: pan-y` on the card — `none` propagates to descendants and kills scrolling inside the answer panel **[measured]** | **P0** |
| **Initial load** | Interactive under 3s on a mid-range Android over 4G **[estimate]**. Bundle ~165 kB gzipped **[measured]**; budget 200 kB **[estimate]**. The Supabase client (~57 kB) is **lazy-loaded** so it is not in front of first paint **[measured]** | **P0** |
| **Score correctness** | Budget accounting lives in refs, not inside a `setState` updater — React may invoke an updater twice **[measured — a deep read scored +10]** | **P0** |
| **Idempotent writes** | Each card recorded at most once; repeated merges produce exactly one account state | **P0** |
| **Corrupt state** | Corrupt local storage → fresh onboarding, never a crash **[measured]** | **P0** |
| **Row-Level Security** | A user reads/writes only their own swipes, saves and comments. **Unverified cards are unreadable by any client key** — G3 is a database policy, not a promise **[measured]** | **P0** |
| **Server-side rules** | Profanity and reply-depth limits are database triggers, holding against a direct PostgREST call **[measured]** | **P0** |
| **No secrets in the bundle** | `dist/` contains no `sk-` or service-role token; the only key shipped is PostHog's write-only `phc_` **[measured — must stay true]** | **P0** |
| **Server-side generation** | All LLM / Guardian / TMDB calls run in serverless functions; the client never holds those credentials **[derived]** | **P0** |
| **Telemetry privacy** | Autocapture **off**, session recording **off**, DNT honoured. **No comment text, card body or free-form input is ever sent** — only ids, topics, counts and enums **[measured]** | **P0** |
| **Personal data minimization** | Comment display names are **first name only** — a public thread is more exposure than someone agreed to when they signed in to keep their Kept pile **[measured]** | **P0** |
| **Profile privacy** | `profiles` RLS stays own-row-only. Loosening it to fix a comment-name join was rejected: the table holds `interests`, and world-readable interests is a surveillance story | **P0** |
| **Compatibility** | Android Chrome and iOS Safari, current + previous 2 majors **[estimate]**; minimum viewport 375px **[measured]**; every action available by both gesture and button **[measured]** | **P0** |
| **No install** | Works as a plain URL | **P0** |
| **Cost control** | Bounded regeneration retries; capped per-run volume; cheap verifier model. Analytics within PostHog free tier **[estimate]**; Supabase free tier sufficient at course scale **[estimate]** | **P1** |
| **Scale** | Hundreds of concurrent users, not thousands **[derived from course context]**. Content scales by schedule, not user count — user growth costs ~zero marginal generation **[derived]** | **P1** |

---

## Release Metrics

**[JUDGMENT — the targets below are proposals, not commitments. See open questions.]**

Gating for Go-Live.

| Metric | Target | Delight | Rationale |
|---|---|---|---|
| Cards with `verified: true` **and** a non-empty `source_url` | **100%** | 100% | G3 is a hard invariant, not a target to approach. Below 100% the product has no reason to exist. Enforced by RLS |
| Cards available per topic | **10** (60 total) | ≥ 20 | Simulation: at 5–6 per topic, **73.8%** of users exhaust their favourite topic inside the first 9 swipes — the personalization claim collapses exactly where it must hold. At 10 per topic that falls to **0.0%**. This is the gating number for G2, not a comfort target. **Currently 7–9 per topic, 50 total** |
| Onboarding → first card viewed | ≥ 75% | ≥ 90% | Benchmark floor for simple content-consumption apps. If the funnel leaks before the first card, nothing downstream matters |
| Median time to first card | < 60s | < 30s | The whole activation claim |
| Crash-free sessions | ≥ 99% | 100% | Web app; no install to blame |
| Gate → sign-in conversion | ≥ 30% | ≥ 50% | Tests SH6. Below this the gate is costing more users than the account is worth and should move later |
| Comments passing the filter | ≥ 90% | ≥ 95% | A filter rejecting one in five submissions is mis-tuned, not protective |
| Instrumentation coverage | 100% of §Telemetry events firing in production | — | The course requires the product to be measurement-ready. An untracked action is an unanswerable question |
| **Editorial voice review** *(not yet run)* | A sample of ≥10 live cards reviewed by a content professional; **no card judged "reads like Inshorts"** | Reviewer volunteers to share a card | The one gating check with no automated proxy. Both Curious Scroller interviewees abandoned Inshorts over *how it read*, not accuracy — so verified, sourced, factually perfect cards can still fail. Rio said during his interview that he would be willing (*"let me stress-test the writing quality, I'll be brutal"*), but **no review has been requested or run**, and nothing here rests on his having seen a card |

---

## Roadmap

**[JUDGMENT]**

### MVP2 / V1 — *the next version*

- **Server-side swipes, saves and topic scores.** The single largest gap: today
  these are `localStorage` only, so a second device starts from zero and none of
  the behaviour is queryable for the dashboard. Identity already exists, so the
  work is mechanical.
- **Product metrics dashboard** — funnel, cohort retention, root-cause view.
- Remaining spec items: **R7** new-topic parity boost, **R6** locked nested
  reply, **R5** 30s dwell marking.
- **Fill every topic to 10 cards (60 total)** — the level at which simulated
  topic exhaustion inside the first 9 swipes falls to zero — then keep growing
  on a schedule.
- Session-length instrumentation as a first-class event — **the NG3 guardrail is
  not fully measurable without it, and the data cannot be backfilled.**

### MVP3 / V2

- Cross-vendor verification split (generator and verifier from different
  vendors). Today both are OpenAI — one vendor, so a weaker independent check
  than the Sonnet-generates / Haiku-verifies target design.
- Review depth: per-card recall tracking, not just interval scheduling.
- Comment quality beyond a word list — the named toxicity guardrail is currently
  measured by a proxy (`comment_rejected` rate), and toxicity that passes the
  filter is invisible to it.
- Real Curio+ billing, if and only if the free tier has demonstrated it is worth
  paying for.

### MVP4 / V3 — the premium version

- **Audio narration — the flagship Curio+ feature.** Cards read aloud, so a card
  can be consumed on a commute or a walk rather than only on a screen. It is
  deliberately held for the paid tier: it is the first genuinely additive perk
  Curio+ would offer, as opposed to the current tier's *removal* of limits
  (unlimited saves, nested replies, undo). A subscription that only lifts caps
  is a weaker proposition than one that adds a capability, and it invites the
  dark-pattern reading NG3 exists to refuse.
- **The NG5 line, and where it moves.** NG5 rules out video, autoplay and moving
  media because Curio steals the *gesture*, not the *format*. Audio does not
  breach that — a narrated card is still one idea with a cited source, and the
  user chooses to start it. **The rule that must survive:** no autoplay, no
  background audio, no audio that continues into the next card. The moment
  narration plays without being asked for, it is a passive media feed and NG5
  applies again.
- Notifications (deferred: iOS Safari requires home-screen install for web push,
  so most of the target audience could not receive them — revisit alongside any
  PWA decision).
- More topics and subtopic depth.
- Social: shared kept piles, friend streaks — **only if it survives NG3.** A
  friend streak is a loss-aversion mechanic wearing a social costume.

> **Terminology, because the word collides.** "Voice" in this document means two
> unrelated things. **Editorial voice** is how a card *reads* — a baseline quality
> attribute, required in the MVP, and the subject of SH7 / R4b. **Audio
> narration** is the V3 premium feature above. Deferring the second does not defer
> the first: a flatly-written card fails whether or not anyone reads it aloud, and
> narrating flat prose only makes the flatness more audible.

---

## Success Metrics

**[JUDGMENT — targets need your decision; see open questions]**

**North Star: cards kept *and retained* per weekly active user.**
Retention of knowledge, not of attention. Chosen deliberately over "swipes per
session," which Curio could trivially inflate and which NG3 forbids optimizing.

| Metric | 3 Months | 6 Months |
|---|---|---|
| **North Star** — cards kept & reviewed per WAU | 3 | 6 |
| Weekly active users | 150 | 500 |
| D1 return | 30% | 40% |
| D7 return | 15% | 25% |
| Daily set completion rate | 50% | 65% |
| Review completion rate (`review_completed` / due) | 40% | 60% |
| Keep rate (kept / cards viewed) | 10% | 12% |
| Source link click rate | *baseline from first cohort* | +20% vs. baseline |
| Off-interest topic share in Discover (G5, anti-bubble) | ≥ 25% | ≥ 30% |
| **Guardrail** — median session length | ≤ 6 min, flat | ≤ 6 min, flat |
| **Guardrail** — comment rejection rate | ≤ 10% | ≤ 8% |
| Gate → sign-in conversion | 30% | 40% |
| Cards in library | 100 | 300 |

**Read the guardrails as ceilings, not floors.** Session length going *up* is a
failure signal even if every other number improves — that is the NG3 commitment
made measurable. If streaks are producing longer sessions rather than more
regular short ones, the streak comes out.

---

## Risks and Dependencies

**[FACT for the risk, JUDGMENT for the mitigation adequacy]**

| # | Risk / Dependency | Impact | Mitigation |
|---|---|---|---|
| **R1** | **No real users yet.** The hard course requirement is a live product with real users by Session 7. Every solution hypothesis (SH1–SH7) is instrumented or unmeasured | **Critical** — the deliverable nothing else substitutes for | Nothing technical blocks it. This is a distribution task, not a build task, and it is the top priority |
| **R2** | **Behaviour is not queryable.** Swipes, saves and topic scores are device-local, so the metrics dashboard has almost nothing to read | **Critical** — blocks the graded dashboard | Move them server-side. Identity exists; the work is mechanical |
| **R3** | **Generator and verifier are the same vendor.** Both are OpenAI today, so the independence of the fact-check is weaker than designed | **High** — G3 is the product's reason to exist | `VERIFY_PROVIDER` already enables a cross-vendor split. The Sonnet+Haiku target is a real design goal, not a nice-to-have. Interim provider is OpenAI because Anthropic credits are pending an international payment |
| **R4** | **A wrong verifier is worse than none.** `gpt-4o-mini` / `gpt-4.1-mini` **false-positive** on real sources — asked to check a phrase literally present in a 12k-char Wikipedia article, they flag it unsupported because they do not retrieve reliably at length. A verifier that rejects faithful claims burns good cards and spend | **High** | **The verifier must be a reasoning model.** `gpt-5-mini` reasons over the source and gets it right (~7s vs ~1s — worth it). A short probe missed this entirely; only a full article surfaced it |
| **R4b** | **Voiceless output — the risk discovery added.** Both Curious Scroller interviewees abandoned Inshorts, and neither blamed accuracy: *"content with the soul removed — facts stapled together, no voice."* One is a professional content editor who says *"if it's AI I'll smell the genericness a mile off."* The generation prompt's core constraint — add no fact not present in the source — is correct for G3 and pushes directly toward that flatness | **High** — this is a churn mechanism that passes every existing quality check. Verified, sourced, factually perfect cards can still fail | **Currently unmitigated and unmeasured.** Needs (a) an explicit voice constraint in the generation prompt, held alongside groundedness rather than traded against it, and (b) any instrument at all — thumbs, keep-rate by card, sampled editorial review. The cheapest available test is a content professional reading a sample of live cards; Rio indicated in his interview that he would be willing, but **this has not been requested and no review has taken place** |
| **R4c** | **The two personas want opposite things from the writing.** P1 will churn without voice and personality; P2 wants raw facts and distrusts interpretation — *"give me the what, I'll do the so-what"* | **Medium** — over-correcting for R4b breaks the trust persona | The card structure already separates them: the ~150-word body carries the voice, the source link carries the verification. The line to hold is **voice in the telling, never in the claims** — colour may come from how a fact is framed, never from a fact that is not in the source. This is a prompt-level rule that G3's verifier cannot enforce, since it only checks groundedness |
| **R5** | **Content volume ceiling.** At 7–9 cards per topic the library is close to, but not yet at, the level where the personalization claim holds for a full session. The old 5–6-per-topic library failed for 73.8% of simulated users inside 9 swipes | **High** — undermines G2 | A content-volume problem, not a scoring bug. **MVP target is 10 per topic / 60 total**, at which simulated exhaustion is 0.0%; ~10 cards remain to generate. The pipeline is the mechanism and the library grows from there |
| **R6** | **The ethics charge is real and Curio is squarely a target.** The product deliberately reuses the Reels habit loop, greys out a paywall as a conversion nudge, and now has a streak | **High** — and it is graded | NG3 states the line and names its own falsifier (`session_ended.duration_s`). Streak has a grace day, no loss-aversion prompts, no reward for exceeding. Undo-behind-the-paywall is the sharpest version of the charge and is owned explicitly: the free tier is not made worse to sell it |
| **R7** | **Filter-bubble / surveillance story.** Personalization plus stored interests is exactly the shape of the criticism | **Medium** | Discover is ungated by interests and instrumented as the anti-bubble signal (G5). `profiles` RLS stays own-row-only precisely because it holds `interests`. Autocapture off, session recording off, no free-form text in telemetry |
| **R8** | **Comment toxicity is under-measured.** The named guardrail is a word-list rejection *rate* — a proxy. Toxicity that passes the filter is invisible to it | **Medium** | Flagged rather than hidden. Filter quality becomes a prioritized item if the guardrail trips |
| **R9** | **Desktop testing does not exercise the product.** Mouse clicks and programmatic clicks bypass the touch path entirely; four separate shipped bugs were invisible on desktop | **Medium** | Phone verification is mandatory before any interaction change is called done |
| **R10** | **Vendor dependencies:** Supabase (identity, data, RLS), Vercel (hosting), OpenAI (generation), Guardian/Wikipedia (sources), PostHog (analytics) | **Medium** | All on free or low tiers sufficient for course scale. Guardian is an *enhancer*, not a dependency — a run falls back to Wikipedia. Verification going down halts generation: **nothing unverified is ever stored "to fix later."** |
| **R11** | **TMDB attribution** is required before any TMDB-sourced card ships | **Low** but blocking for that source | Not yet used in production content |
| **R12** | **Credential hygiene.** An API key was pasted into a working session and needs rotation | **Medium** | Rotate before Demo Day; all keys server-side only |

---

## Appendix — Where the product stands today

**[FACT, as of 2026-07-28]**

| | |
|---|---|
| Live | https://curio-three-iota.vercel.app/ (auto-deploys on push to `main`) |
| Cards | **50 of a 60-card MVP target**, all `verified: true` with a cited source — bollywood 9 · cricket 9 · history 9 · markets 8 · technology 8 · hollywood 7 |
| Topics | 6 (MVP target: 10 cards each) |
| Backend | Supabase — cards, identity, shared comments, RLS, server-side triggers |
| Identity | Anonymous by default; Google via `linkIdentity` at the 4th swipe-action |
| Analytics | PostHog, explicit taxonomy, autocapture off |
| Pipeline | Guardian trending → Wikipedia grounding → `gpt-4.1-mini` generates → `gpt-5-mini` verifies → store |
| Tests | 42 passing (18 scoring · 13 streak · 11 review) |
| **Not yet server-side** | swipes, saves, topic scores |
| **Not yet built** | metrics dashboard · R7 parity boost · R6 locked nested reply · R5 30s dwell |
| **Not yet acquired** | real users |

---

## Open questions — where I am not sure

1. **Editorial tone — the one live product decision from discovery.** *(Note:
   this is not audio narration, which is settled as the V3 premium feature.)*
   Discovery surfaced a churn mechanism the build has no answer to: flat,
   assembled-sounding cards. One decision is yours now — **does the generation
   prompt get an explicit voice constraint alongside groundedness?** That is a
   prompt change, not a feature, and it is cheap. The second — asking a content
   professional to review a sample of live cards — is optional and unstarted.
2. **Does the target segment narrow?** The stated target is 18–30, but every
   respondent was 24–28 and in knowledge work, and the strongest evidenced pain
   — *"I want to be interesting outside my one thing"* — is a
   professional-identity motive that may not describe a 19-year-old at all. Keep
   the broad target and note the gap, or narrow to 24–30 and say why?
3. **Is P2 in scope for the MVP?** Raghav defines the trust bar and validates the
   source link, but he has no scroll habit, will never be a daily user, and the
   streak and daily set are meaningless to him. He may be better positioned as
   the persona the product must not *offend* rather than one it serves.
4. **Release and success metric targets.** Every number in those two tables is my
   proposal, reasoned from benchmarks, not from Curio data. You should either
   own them or replace them — they are commitments.
5. **Which provider does the document name?** It currently states the truth
   (OpenAI generates and verifies, Anthropic is the target). The alternative is
   to present Sonnet+Haiku as the design and footnote the interim. Truth is more
   defensible; your call on what the spec should claim.
6. **Curio+ price.** The paywall is mocked and no number exists anywhere. GTM
   and monetization need one, even hypothetically. What is it?
7. **Roadmap V1/V2/V3.** I sequenced these by what unblocks the course
   deliverables. If the team has a different view of what comes after the MVP,
   that ordering should be yours.
8. **Team and authorship block.** The document has no author, team number, or
   submission date. Who is on the team and what identifiers does the submission
   need?
9. **Dashboard tool.** The metrics dashboard is a P0 gap. PostHog's built-in
   dashboards would be fastest given the data is already there. Is that
   acceptable, or does the deliverable expect something separate?
10. **Session 7 date.** The "live with real users" deadline drives every
    priority call in the roadmap and I do not have the date.

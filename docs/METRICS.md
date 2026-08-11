# Curio — Metrics & North Star

*Prep for the metrics discussion. Everything in here is backed by an event that
already fires in production, except where marked. Event names are the actual
PostHog event names from `src/lib/analytics.js`.*

---

## 1. The North Star

**Cards retained per weekly active user.**

Operationally: for each user active in a given week, count the distinct kept
cards they came back to in a *later* session that week — a spaced-repetition
review (`review_completed`) or reopening a kept card in full
(`kept_card_opened`). Sum those, divide by weekly active users.

Targets from the spec: 3 per WAU at three months, 6 at six months.

### Why this metric and not engagement

The obvious North Star for a swipe feed is swipes per session or time on app.
Curio rejects both, for one product reason and one honest reason.

The product reason: the value Curio promises is *facts that stick*. A user who
swipes 200 cards and remembers nothing got nothing, and a metric that counts
that as success would steer the product toward becoming the thing it exists to
replace. Retention of knowledge is the promise, so the metric has to be
retention of knowledge.

The honest reason: we can't measure memory, only behaviour. Coming back to a
card you saved days ago is the closest observable proxy for "this stuck." The
product deliberately never claims a card is "mastered" for the same reason —
we observe revisits, not recall.

### Why it resists gaming (the Goodhart check)

A North Star fails when maximizing it directly damages the user. This one is
built so the obvious ways to inflate it are already ruled out elsewhere:

- Inflating saves doesn't work: the 20-card cap keeps saving deliberate, and a
  saved card only counts when it's *revisited later*, not when it's saved.
- Nagging people into reviews doesn't work: NG3 forbids streak-loss prompts and
  FOMO notifications, so there is no mechanism to push reviews artificially.
- Padding sessions doesn't work: session length is a guardrail watched in the
  opposite direction (below).

The metric goes up only when someone chose, unprompted, to return to something
they kept. That is hard to fake and is the product working.

---

## 2. The metric tree

```
                    NORTH STAR
        Cards retained per weekly active user
        (review_completed + kept_card_opened ÷ WAU)
                         ▲
     ┌───────────────────┼──────────────────────┐
     │                   │                      │
 ACTIVATION          ENGAGEMENT             RETURN
 do they start?      is it landing?         do they come back?
     │                   │                      │
 onboarding →        quiz_revealed rate     D1 / D7 return
 first card ≥75%     keep rate (saves ÷     daily_set_completed
 time to first       cards viewed) ~10%     frequency
 card < 60s          card_deep_read
                     source_link_clicked

 GUARDRAILS (ceilings, not targets — these going UP is failure)
 ├─ session_ended.duration_s   median ≤ 6 min and FLAT
 │    the doom-scroll watch; if streaks lengthen sessions, streaks come out
 ├─ comment_rejected rate      ≤ 10%
 │    community health (proxy — filter misses what it doesn't catch)
 ├─ save_limit_reached + paywall_clicked
 │    paywall pressure — are we gating too hard?
 └─ off-interest share of discovery_topic_selected  ≥ 25%
      the anti-filter-bubble check: are people reading OUTSIDE their picks?
```

The logic of the tree, in one sentence: activation feeds engagement, engagement
feeds return, and all three exist to move one number — did people come back to
what they kept — while the guardrails watch for the failure modes a swipe
product invites.

---

## 3. Input metrics — definitions and status

| Metric | Formula (events) | Target | Status |
|---|---|---|---|
| Onboarding completion | `onboarding_completed` ÷ `onboarding_started` | ≥ 75% | live |
| Time to first card | `onboarding_started` → first `card_viewed`, median | < 60s | live |
| Reveal rate | `quiz_revealed` ÷ `card_viewed` | baseline TBD | live |
| Keep rate | `card_saved` ÷ `card_viewed` | ~10% | live |
| Deep-read rate | `card_deep_read` ÷ `card_detail_opened` | baseline TBD | live |
| Trust engagement | `source_link_clicked` ÷ `card_viewed` | baseline TBD | live |
| Daily set completion | `daily_set_completed` ÷ active days | 50% | live |
| Review completion | `review_completed` cards ÷ cards due | 40% | live |
| D1 / D7 return | PostHog retention on `app_opened` | 30% / 15% | live |
| Gate conversion | `signup_completed` ÷ `signup_gate_shown` | ≥ 30% | live |
| Personalization shift | top topic share of `card_viewed`, swipes 1–9, vs 16.7% baseline | ~3× | live (sim: 3.37×) |

"Baseline TBD" is deliberate, not evasive: the pilot cohort is setting these
baselines right now rather than us inventing numbers and retro-fitting a story
to them. The first real pull is below.

---

**Measurement window (revised 2026-08-11):** the live dashboard counts a
**rolling three-week window ending today** — today is always the last day
of the newest week (weeks are today−6…today, today−13…today−7,
today−20…today−14), and events older than 21 days drop out of every
number on the page: funnel, totals, swipe mix, North Star, all of it.
Weeks are therefore ranges anchored to the viewing date, not calendar
weeks. Rationale: the dashboard should always answer "how are the last
three weeks going," not accumulate history that flatters totals.

The PostHog dashboard (1972439) is pinned to the same window via a
dashboard-level `-21d` date filter across all nine tiles. One honest
caveat: PostHog's week-interval charts still break on calendar weeks —
it cannot draw "weeks ending today" — so the live page is the canonical
view of the rolling weeks; PostHog is the drill-down over the same 21
days.

## 3b. The numbers as of 1 August (live PostHog pull)

Pulled directly from the event store, unique people unless stated. Cohort is
~85 visitors since 22 July — mostly classmates and testers, so read these as a
pilot baseline, not traction.

**The funnel:**

| Step | People | Conversion |
|---|---|---|
| Opened the app | 85 | — |
| Touched a topic in onboarding | 59 | 69% |
| Completed onboarding | 54 | 64% |
| Viewed a card | 64 | **75% of starts** |
| Revealed a quiz answer | 36 | 56% of readers |
| Swiped at least once | 40 | — |
| Saved at least one card | 16 | 25% of readers |
| Hit the sign-in gate | 23 | — |
| Signed in | 7 | **30% of gated** |

**Where the targets stand:**

- **Time to first card: median 15 seconds** — target was under 60. Beaten.
- **G1 activation: 75%** of onboarding starts reach a card — exactly at the
  75% floor.
- **Gate conversion: 30%** (7 of 23) — exactly at the threshold where the
  gate pays for itself. Any lower and it moves later in the flow.
- **Swipe ratio: 179 interested vs 88 pass** — two-thirds positive, so the
  feed is serving more hits than misses.
- **Real session length: median ~2.6 minutes** (155s). Guardrail ceiling is
  6 minutes; well under, and the two-minute promise is what sessions look
  like in practice. (Caveat: the raw median is 5s because `session_ended`
  fires per foreground *stint* — 134 of 237 recorded stints are sub-10-second
  tab switches. Filter to ≥30s before quoting session length.)
- **Keep rate: 3.9%** of card views become saves (target ~10%) — though 25%
  of readers saved at least once. The per-view rate is the honest baseline.
- **Return: ~9%** came back on a second calendar day (8 of 91); one person
  came a third day. Target was D1 30%. Missed, and worth owning (below).
- **North Star: effectively zero.** 16 people saved a card; 2 ever returned
  to one. One `review_completed`, one `kept_card_opened`, total.

**What the misses actually say — the live root-cause material:**

1. **The biggest funnel leak is before the first tap.** 26 of 85 visitors
   (31%) opened onboarding and never touched a single topic. The drop isn't
   in the picker or the goal step — it's the intro screen. Hypothesis: step 0
   (the sample card + pitch) is friction for people who arrived already
   intending to try it. Testable fix: collapse step 0 or move the picker
   first. This is a real root-cause finding on live data, found last night —
   lead with it.
2. **The back half of the loop is unproven, for mechanical reasons.** The
   North Star needs a user to save a card, leave, and come back after the
   review interval elapses. A one-session pilot cohort structurally cannot
   score on it — most testers used Curio once, and nothing brings them back
   (notifications are deliberately parked). NS ≈ 0 is therefore expected at
   this stage, not evidence the loop fails; but it stays ≈ 0 until
   distribution gives users a reason to return. That is the next experiment,
   and it is a distribution problem, not a build problem.
3. **Data-quality notes to volunteer:** `signin_completed` re-fires on
   session restore (51 events across 7 people — dedupe to first-per-person
   when reading); a handful of `verification_ping` / pipeline test events
   should be excluded; 17 people used the prototype reset, which marks them
   as testers.

---

## 4. What the course requires at Demo Day, and how each is built

**Funnel.** `onboarding_started → onboarding_completed → card_viewed →
quiz_revealed → card_saved → signup_gate_shown → signup_completed`. Built as a
PostHog funnel insight. The pre/post-signup join works because
`identify()` is called on sign-in — the anonymous distinct_id and the account
merge into one person, so gate conversion is measurable end to end.

**Cohort / retention.** PostHog retention insight on `app_opened`, weekly
cohorts. D1/D7 falls straight out.

**Root-cause analysis.** The method, demonstrated on a real case from this
build: the personalization claim (G2) was underperforming its promise. The
metric alone said "the feed isn't shifting." Segmenting simulated cohorts by
library size found the actual cause: at 5–6 cards per topic, 73.8% of users
exhausted their favourite topic *inside* the 9-swipe measurement window — a
content-supply problem masquerading as an algorithm problem. Fix was 10 cards
per topic (73.8% → 0.0%), not a scoring change. That is the shape of analysis
the dashboard exists to enable on live data.

---

## 5. The honest state of the data (say this before being asked)

- **The event stream is real and server-side.** All 37 events flow to PostHog
  from the live app — autocapture off, so every event is one we chose. The
  behavioural *metrics* do not depend on the localStorage migration; PostHog
  already holds the stream per distinct_id.
- **What localStorage does limit:** app *state* (swipes, saves, scores) is
  device-local, so a second device starts fresh and Supabase can't be queried
  SQL-style for behaviour. That's a V1 work item; it does not block the
  PostHog dashboard.
- **Scale so far:** ~85 visitors since 22 Jul, 48 Supabase accounts (41
  anonymous, 7 Google sign-ins), 64 verified cards across 6 topics. Small,
  and mostly classmates/testers — honest label: pilot cohort, not traction.
- **Two guardrails are proxies and are labelled as such:** comment toxicity is
  measured by filter rejections (misses what the filter misses), and
  "retained" is measured by revisits (we observe behaviour, not memory).

---

## 6. Questions to expect, with answers

**"Why not DAU or session time, like every other feed?"**
Because Curio's success claim is retention of knowledge, and time-on-app is
its named guardrail, not its goal. A session-length increase is treated as a
failure signal even if every other number improves. This is also the ethics
answer: the product's own metric punishes attention capture.

**"How do you know a card was 'retained'? You can't measure memory."**
Correct, and the product never claims to. Retained = revisited in a later
session, the closest observable proxy. The same honesty rule shows up in the
UI: no card is ever labelled "mastered."

**"What's your baseline for X?"**
Where no real cohort exists, the first cohort sets the baseline. The only
numbers asserted in advance are the ones with structural backing: 100%
verified cards (database policy), the 16.7% uniform draw baseline
(arithmetic), the simulated 3.37× shift (reproducible simulation, model
stated).

**"What would make you remove a feature?"**
Streaks, if sessions lengthen rather than multiply (`session_ended` watches
this). The gate, if conversion sits under ~30% — at that point it costs more
users than it converts and moves later in the flow.

**"Your North Star is zero and your D1 is 9%. Isn't that failure?"**
It's the honest reading of a one-session pilot cohort measured against a
metric that requires multi-day behaviour. The North Star cannot score until a
user saves a card, leaves, and returns after the review interval — and
nothing currently brings anyone back (notifications are deliberately parked).
What the pilot *does* establish: activation works (15s to first card, 75%
reach a card), the feed skews positive (2:1 interested vs pass), sessions are
short by design (~2.6 min median), and the gate converts at exactly 30%. The
missing piece is a reason to return — a distribution and re-entry problem,
which is precisely what the metric was designed to expose. If NS is still ~0
after a cohort with a return channel, *then* the loop itself is in question.

**"What's the one metric you'd fix first?"**
The tone gap: SH7 (does the writing read as written, not assembled) is the
only load-bearing hypothesis with no instrument behind it. Cheapest fix is
per-card keep-rate as a quality proxy plus a sampled human read.

---

## 7. If asked to show it live

**Built, 8 Aug — three layers, use whichever fits the moment:**

1. **The live page (presentation-grade, no login):**
   https://curio-three-iota.vercel.app/metrics.html — Curio-designed, queries
   production on every load via `/api/metrics` (the PostHog key stays
   server-side; the page serves aggregates only). *Requires
   `POSTHOG_PERSONAL_KEY` + `POSTHOG_PROJECT_ID` in Vercel env.*
2. **PostHog (live drill-down, team login):**
   https://us.posthog.com/project/523396/dashboard/1972439
3. **The artifact (frozen snapshot for sharing):**
   https://claude.ai/code/artifact/3c6ba862-c9bb-4bc9-8c7f-79c92d9bb716

Nine tiles: activation funnel · the intro-screen leak (the root-cause
exhibit) · day-over-day cohort retention · North Star trend · WAU · keep
rate · swipe mix · median real-session guardrail (≥30s stints only) · gate
conversion. That covers all three course requirements — funnel, cohort
retention, root-cause — on live numbers.

Two reading notes before presenting:

- **Weekly gate conversion can exceed 100%** in a sparse week — someone can
  sign in during a different week than the wall was first shown, and early
  sign-ins predate the gate entirely. Quote the pilot-wide unique-person
  figure (7 of 23, 30%), not a single week's ratio.
- The guardrail tile already filters out sub-30-second stints; it's safe to
  read as-is (median real session 56–226s across pilot weeks, well under
  the 6-minute ceiling).

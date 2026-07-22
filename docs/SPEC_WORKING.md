# Curio — Working Spec (Session 3 format)

*Team build artifact, drafted section-by-section following the SWPM Session 3
spec structure (Goals/Non-Goals → Narratives → Requirements → Error Scenarios →
Telemetry → Acceptance Criteria → NFRs → Prioritization). This working doc
guides the build; the graded individual Product Specification (4N) is written
separately, in the student's own words.*

**Status:** §1–6 complete (Goals · Non-Goals · Narratives · Requirements ·
Error Scenarios · Telemetry) · Acceptance Criteria onward: in progress

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

## 3. Narratives

Day 0 / Day N × Greenfield / Brownfield, per the Session 3 structure.
Narratives deliberately include friction and uncertainty, not just the happy
path — that is what they are for.

### N1 — Day 0, Greenfield (first-ever visit, nothing set up)

**Priya, 23, is a first-year analyst in Gurgaon.** It's 11:40 pm and she's
been on Instagram Reels for over an hour; the familiar mix of guilt and
boredom sets in. A college friend has shared a Curio link in their group chat
with "this is like reels but you actually learn something."

She taps the link. No app store, no signup — a dark screen asks *"What are
you curious about?"* with four topics. She's unsure how many to pick; the
button reads "Pick 2 more," which resolves it. She taps **Cricket** and
**Markets** and hits *Start swiping →*.

The first card is about the 1983 World Cup final. She reads it — takes about
a minute — and notices a **✓ Fact-checked** badge and a Wikipedia source
link. She's mildly skeptical of "AI content," so she taps the source; it
opens the real article. That lands: the card wasn't making it up.

Her Reels muscle memory kicks in and she swipes right without thinking. The
card flies away and a new one appears — but *uncertainty*: did that save it?
Where did it go? She spots the 🔖 button and the hint "← Pass · Interested →
· 🔖 Save to keep," and works out that right-swipe means *more like this*
while Save is deliberate. On the next card she likes, she taps 🔖 — a toast
confirms "Saved ♥" and a badge appears on the Kept tab.

After ~8 swipes, the meter above the deck reads *"Leaning Markets."* She
opens it, sees percentage bars, and realizes the feed is openly telling her
what it thinks she likes.

**Success:** she's read 6 cards, saved 2, can retell one fact from memory,
and — when she closes the tab at 11:55 — nothing nagged her to stay. Next
morning the link is still in her chat, and her Kept pile is still there when
she returns.

### N2 — Day 0, Brownfield (existing data, first encounter with new capabilities)

**Rohan, 26, has used Curio on his phone's browser for a week** — back when
a right swipe meant *Keep*. He has 5 cards in his Kept pile, and his feed
leans firmly toward History. A friend mentions "Curio changed, there's a
Discover thing now." He opens his usual tab.

Nothing asks him to re-onboard. His Kept pile still shows all 5 cards; the
meter still reads *"Leaning History"* — his week of tuning survived the
update. *(Under the hood: his stored state loads into the new schema, with
new fields defaulting safely.)*

He starts swiping. A card about the Cholas is excellent — he right-swipes
it, exactly as he's done all week, and moves on. Three cards later he goes
to Kept to re-read it. **It isn't there.** Confusion, then mild annoyance:
right-swipe no longer saves. The card is gone from the deck and there's no
way to swipe back to it. This is the brownfield cost of our semantics
change: his trained habit now silently does something different from what it
did last week — the feed *did* register his interest, but the card he wanted
is lost to him. *(He can only re-find it by browsing its topic in Discover —
if he thinks to.)*

He notices the hint line — "← Pass · Interested → · 🔖 Save to keep" — and
the new bookmark button, and re-learns the gesture. It costs him one lost
card and thirty seconds of distrust.

He then spots the new **Discover** tab: all four topics browsable, including
Bollywood, which he never picked. He reads two cards there, saves one with
🔖 — deliberately this time. Back on his feed, History still dominates;
exploring didn't reset anything.

**Success:** his old data survived untouched, he adapted to the new save
gesture within one session, and Discover gave him a reason to come back.
**Exposed by this narrative, not solved:** we shipped a swipe-semantics
change with **no migration cue** — an existing user learns the new meaning
only by losing a card. A one-time "what's new: right swipe no longer saves —
use 🔖" notice for returning users is a real gap this narrative surfaces
(candidate requirement for §4).

## 4. Requirements & Features

Each requirement states: trigger/precondition · core behaviour · business
rules · output/state change · exceptions. "Build status" marks work items
this spec creates (vs. behavior already shipped).

**The score ladder (one scale, referenced throughout):**
Pass **−1** · Interested **+3** · Save from feed **+5** · Save from Discover **+3**.

### R1 — Choose interests (onboarding)

**Trigger:** first visit — no stored state exists in this browser.

**The user must be able to:** see all topics (name, emoji, blurb, subtopics)
before choosing; select/deselect freely; confirm only with ≥2 selected — the
CTA stays disabled below the minimum and states how many more are needed.

**Business rules:** no account, email, or personal data required to complete
onboarding. Chosen interests seed scores (+4 each); unchosen topics start at
0 but remain servable (floor weight — no topic is ever fully excluded).

**Output:** `onboarded: true` + interests + seeded scores persisted; user
lands in the feed with a full deck; `onboarding_completed` fires.

**Exceptions:** refresh mid-selection restarts onboarding harmlessly. If
storage is unavailable (private mode/quota), the app still works for the
session — it must not crash or block.

### R2 — Serve the feed

**Trigger:** onboarded user opens the Feed; or a swipe removes the top card.

**The system must:** keep a stack of up to 3 cards, one active top card;
draw each next card from the pool of **unseen, `verified: true`** cards,
weighted by current topic scores; serve **only from the card store** (seed
cards today; Supabase store filled by the async R10 pipeline in the target
release) — **generation never runs in the serving path**; a swipe never
waits on an LLM. Never re-serve a swiped card; keep every topic drawable via
the floor weight (no hard filter bubble). Fire `card_viewed` exactly once
per card, when it becomes top.

**Business rules:** weighting reflects scores at draw time (a swipe updates
scores before the replacement is drawn). The feed stays responsive if the
store is unreachable: serve the prefetched deck, degrade to a clear "can't
load new cards" state — never a spinner blocking the swipe in hand.

**Exceptions:** pool exhausted → caught-up state with explicit *Swipe again*
(replay clears `seen`, **preserves** scores + Kept; `feed_exhausted` fires).
In the target release the pool grows over time — exhaustion means "caught up
*for now*." A card failing to render must not wedge the deck. The pipeline
itself is specced in R10, not here.

### R3 — Swipe: Interested / Pass

**Trigger:** an active top card; drag past threshold or tap 👍 / ✕.

**The user must be able to:** swipe right = Interested / left = Pass, by
gesture *and* button with identical results; see which action a drag will
commit before releasing (stamp at threshold; dragging back cancels); read
the gesture meaning at all times (persistent hint line).

**Business rules:** right +3, left −1, applied before the next draw. **A
swipe never saves** — Kept is exclusively R4's explicit action. Vertical
swipes disabled. Each card recorded at most once (double-count guard).

**Output:** swipe appended with action + timestamp; card enters `seen`;
`card_swiped {action, method: gesture|button, topic, swipe_index}` fires.

**Exceptions:** if the swipe animation fails, the action is still recorded
and the deck still advances — logic never depends on animation. **Known gap,
flagged:** no undo; a mis-swipe is unrecoverable in the feed (mechanism
behind Rohan's lost card in N2) — §9 prioritization candidate.

### R4 — Save to Kept: save auto-swipes right

**Trigger:** 🔖 on the feed's top card, or 🔖 Save on a Discover row.

**Core behaviour:** in the feed, **Save = Keep + Interested in one action** —
card added to Kept, auto-swipes right, **+5** topic score (supersedes the
plain +3; the costlier, more deliberate signal), recorded as `card_swiped
{action: interested, method: save}`. In Discover, Save adds to Kept with
**+3** (no deck to advance). **Unsave** from Kept or Discover rows; frees a
cap slot but does not retract scores (signals are historical).

**Business rules:** Kept modified only by explicit Save/Unsave; one entry
per card; most-recent first. R3's rule holds one-directionally: a plain
swipe never saves, but a save always swipes. **Free tier caps at 20 saved
cards:** the 21st save is blocked — not added, not scored, no auto-swipe —
and the Curio+ nudge shows ("Kept pile full — Curio+ is unlimited"). Per
NG1, never a payment flow. The cap blocks new saves only — never deletes
existing ones; unsaving below 20 re-enables. From 15/20 onward,
confirmations show the count ("Saved ♥ · 17/20").

**Output:** `kept` persisted; fires both `card_saved {source, kept_count}`
and `card_swiped {action: interested, method: save}`; blocked saves fire
`save_limit_reached {kept_count: 20}` — the paywall's highest-intent moment.

**Exceptions:** save completes (persist + events) even if the animation
fails. Brownfield user with >20 saves keeps everything; only new saves
block. **Build status:** auto-swipe-on-save, `SAVE_DELTA = 5`, the 20-cap,
counter toast, and `save_limit_reached` are all new work items. Known gap
unchanged: no full-card reopen from Kept (§9).

### R5 — Discovery (scroll and read only)

**Trigger:** the user opens the Discover tab.

**The user must be able to:** see **all** topics — not just onboarding picks
— each with a live card count; drill in and read **full card bodies**;
filter by subtopic with an explicit **All** chip and a visible count; save
(🔖, +3, Kept, cap applies) or open comments per row; back out freely.
**No swipe controls on rows** — Discover is scroll-and-read only.

**Business rules:** **read in Discover = seen everywhere.** A card is
marked `seen` only after it stays in viewport for **30 continuous seconds**
of active foreground time (backgrounding the tab or switching apps pauses
the timer, never counts toward it) — a genuine read, not a scroll-past.
When uncertain (rapid scrolling, backgrounding right at the boundary), the
card stays **unmarked** — the deliberate bias is toward an occasional
duplicate re-serve over silently burning a scarce card from the pool (see
E4). Once marked, the card is not served again in the feed — no duplicates
across surfaces. (Stated implication: genuinely reading through a full topic
list retires those cards from the feed; acceptable — the user already read
them. Makes the R10 pipeline more load-bearing at 21 cards.) Reading alone
never scores; only Save (+3) does. Topic availability is never gated by
interests — Discover is the anti-filter-bubble surface (G5).

**Output:** Discover-read cards enter `seen`; `discovery_card_read {card_id,
dwell_ms}` fires only when the 30s threshold is met — distinct from
`discovery_opened`, `discovery_topic_selected {topic, card_count}`, and
`discovery_subtopic_filtered {topic, subtopic}`, which just mean the list
was opened/filtered. Comparing rows rendered vs. `discovery_card_read`
count gives the real read-through rate, separate from list-open counts.
`card_saved {source: discovery}` fires with +3. No `card_swiped` ever
originates from Discover.

**Exceptions:** zero-card subtopics show an honest empty state (routine in
the target release while the pipeline back-fills). Target release: counts
reflect only `verified: true` cards — unverified output invisible here as
in the feed (G3 applies everywhere). **Build status:** the 30s
viewport-dwell seen-marking (pausing on background, biased toward
under-marking per E4) and the surface-dependent save weight are new work
items. Known constraint (G5): several subtopics currently hold 1 card.

### R6 — Comments

**Trigger:** 💬 on any card (feed, Discover, or Kept).

**The user must be able to:** read the thread in a sheet without losing
their place (count visible on the trigger); post a top-level comment or
**reply one level deep, free**; see rejected input stay in the composer
with a specific reason — never silently discarded.

**Reply-to-a-reply is Curio+, shown locked:** depth-1 replies display a 🔒
Reply control — visible, tappable, never opens a composer. Tapping shows
the Curio+ nudge ("Deeper threads are Curio+") and fires `paywall_clicked
{feature: nested_reply}`. Per NG1 no payment flow; the unlock is mocked, so
depth 2 is never actually posted in this release.

**Business rules:** every submission passes the profanity/spam filter
before acceptance (empty / >500 chars / links / blocklist → matching
reason). Comments are per-card only — no global feed, no cross-card
surfacing. Comment text never leaves the device as telemetry:
`comment_posted` carries structure only (`is_reply`, `length_bucket`);
`comment_rejected` carries the reason only.

**Output:** accepted comments append with timestamp; `comments_opened` /
`comment_posted` / `comment_rejected` fire. `paywall_clicked` gains a
`feature` property — with `save_limit_reached`, the two comparative
paywall-intent signals.

**Exceptions:** rejection keeps composer state (text + reply target);
cancelling a reply target reverts to top-level, keeping the text. Target
release: the word-list filter is v1 by scope; if the comment-toxicity
guardrail trips, filter quality becomes a §9 item. **Build status:** the
locked 🔒 Reply control and the `feature` property are new work items.

### R7 — Edit interests

**Trigger:** ✎ Edit interests on the You screen.

**The user must be able to:** reopen the picker **pre-filled** with current
interests; add/remove freely subject to the same ≥2 minimum; **cancel**
without consequence; save and land back with a confirmation toast.

**Business rules:** editing never resets learning — swipes, Kept, seen, and
existing scores survive untouched. **A newly added topic jumps straight to
parity with the user's strongest interest:** its score is set to the current
**maximum topic score** (or the +4 head-start, whichever is higher) — never
a token bonus drowned out by weeks of tuning. **Guaranteed visibility:** at
least one card from the newly added topic is served **within the next 3
feed draws** (deterministic injection, once per added topic, then normal
weighted draw resumes). The tuning meter reflects the jump immediately.
Re-adding a removed topic follows the same rule. Removing an interest does
**not** zero its score — the feed de-emphasizes it via future Pass swipes,
and the floor weight keeps it servable (consistent with R2's no-hard-filter
rule). No bonus farming: re-selecting an already-chosen topic grants
nothing.

**Output:** interests + adjusted scores persist; `interests_edit_started`,
`interests_updated {added, removed, interest_count}`; person properties
update for cohort segmentation.

**Exceptions:** below 2 selections disables Save with the "pick N more"
affordance. Cancel discards pending selection including would-have-been
bonuses. **Build status:** set-to-max on add and the next-3-draws injection
are new work items (today's code grants only the flat +4).

### R8 — Returning-user migration cue

**Trigger:** an onboarded user opens the app with stored state created
under older interaction semantics — detected via a `stateVersion` field in
the persisted localStorage blob (absent = the old "right swipe = Keep"
build). No account needed: the localStorage blob *is* the user record;
detection is reading a field from data we already store.

**The system must:** show a **one-time, dismissible notice** before the
first swipe of that session — one card-sized message: *"Swipes changed:
right = Interested (doesn't save). 🔖 saves — and now auto-advances the
card."* Shown exactly once per semantics change (dismissal persists a flag
in the same blob); never shown to fresh users. Dismissal is an explicit tap
— its whole job is preventing Rohan's silent habit break (N2).

**Business rules:** any release that changes what an existing gesture does
must bump `stateVersion` and ship a cue through this mechanism — a standing
rule, not a one-off. The cue never blocks reading the card underneath and
never fires mid-deck. Data migration itself stays silent and lossless; only
*semantics* changes get a voice.

**Output:** `stateVersion` written on every save; `migration_notice_shown`
/ `migration_notice_dismissed {from_version, to_version}` — the gap between
the two counts is itself a signal.

**Exceptions:** prototype reset → fresh state at current version, no
notice. Corrupt state → fresh onboarding (existing behavior), no notice.
Scope truth: per-browser/per-device, same as all persistence today; once
R9 ships, `stateVersion` moves into the user's server record and gains
cross-device reach. **Build status:** entirely new.

### R9 — Sign-in gate after 7 free swipes

**Trigger:** an anonymous user commits their **8th swipe-action** (plain
swipes and saves both count — a save is a swipe per R4).

**The system must:** let the first **7 swipe-actions** happen with zero
friction — anonymous, localStorage-backed. On the 8th attempt, block the
action and show the **auth wall**: sign up / sign in (Supabase Auth; email
OTP or Google — no passwords to manage), with the card in hand still
visible underneath. **Merge, never discard:** on signup, all anonymous
state — swipes, Kept, scores, seen, comments — migrates into the account;
signing up must feel like keeping progress, not restarting. On sign-in
(existing account, new device), server state wins; anonymous local swipes
merge additively.

**Business rules:** the gate blocks **swiping and saving only** — reading
the card in hand, the Kept pile, and Discover browsing stay open. We gate
participation, not access to what they've already earned; per NG3, the
wall states plainly what it is (no manufactured urgency). Once
authenticated the gate never reappears. G1 is preserved (first card and
first 7 swipes need no account); G4's cross-device caveat is **resolved**
for signed-in users.

**Output:** `signup_gate_shown {swipe_count: 7}`, `signup_completed` /
`signin_completed`, `signup_abandoned` (wall dismissed → read-only).
PostHog `identify()` links the anonymous `distinct_id` to the account —
pre- and post-signup behavior joins into one funnel.

**Exceptions:** auth service unreachable → the wall says so; reading stays
open, swipes stay blocked (fail closed on the gate, open on reading). A
signed-in user clearing localStorage loses nothing — server state restores
on sign-in. **Build status:** entirely new and the first hard backend
dependency — Supabase project, Auth config, users table, state-merge
logic. Biggest single work item; sequence against R10 in §9.

### R10 — Content pipeline (async, server-side)

**Trigger:** scheduled runs (e.g., daily) and manual triggers — never a
user action; per R2, generation is never in the serving path.

**The system must:** (1) query the Guardian API for trending topics/stories
mapped to Curio's taxonomy (India-first lens on global data); (2) fetch
**full text** to ground on — Wikipedia backbone, Guardian article text for
news-anchored cards, TMDB for film — never stats/snippet APIs, because the
verify step needs source paragraphs; (3) **Sonnet generates** a ~150-word
card from that source only, adding no fact not present in it, with title,
topic/subtopic, `source_url`; (4) **Haiku verifies** — *"does this card
contain any claim not directly supported by the source text below?"* — zero
flags → `verified: true`; any flag → regenerate (bounded retries) then
discard. A card that never passes never exists as far as users are
concerned (G3); (5) verified cards land in the Supabase `cards` table,
immediately drawable by R2/R5.

**Business rules:** all API keys (Anthropic, Guardian, TMDB) live
server-side only — serverless functions; nothing key-bearing ships to the
client (unlike PostHog's write-key, these are real secrets). Model split is
fixed: Sonnet generates, Haiku verifies — the verifier is never the
generator (no self-grading). No card without `source_url`, structurally.
Per-run volume is capped (cost control) and spread across topics — trending
input must not collapse the library into one topic (supply-side diversity;
the serving-side floor already exists in R2).

**Output:** new verified cards in the store; per-run pipeline telemetry:
generated / passed / flagged-retried / discarded counts and per-card cost —
the "AI evals" story Session 5 expects, measured from day one.

**Exceptions:** Guardian down → run on Wikipedia/TMDB (trending is an
enhancer, not a dependency). Verification down → generation halts; nothing
unverified is ever stored "to fix later" — fail closed. A topic yielding no
passable cards is logged loudly, not padded. **Build status:** entirely
new — the whole Phase-2 backend; with R9, defines the Session-4 build.

### R11 — Notifications *(parked — post-MVP)*

Reply notifications and trending-content notifications were specced in
discussion (opt-in per type, hard frequency caps, genuine-payload-only copy
per NG3, R9-dependent identity, R10-triggered sends) but are **deferred**:
the MVP is a web app, and iOS Safari requires home-screen install for web
push — most of the target audience couldn't receive them. Revisit alongside
any future PWA/native decision. R6's "no reply notifications" scope line
stands for this release.

## 5. Error Scenarios

Each scenario states: what failed · how it's recognized · what state is
preserved · what the user sees · what they can do next · what's logged.

### E1 — Auth service unreachable at the sign-in gate

**What failed:** the user hits swipe 8 (R9's gate), but Supabase Auth can't
be reached (network drop, outage, timeout) — distinct from a user-facing
auth failure like a wrong OTP.

**State preserved:** all 7 anonymous swipes, scores, and saves stay exactly
as they are in localStorage; the card the user was on remains visible
underneath the wall.

**What the user sees:** the wall, with an honest substitution for the
sign-up form: *"Can't reach sign-in right now. Your progress is saved — try
again in a moment."* No spinner implying self-resolution; no silent
fallback letting them keep swiping (that would defeat the gate and mask the
failure).

**What they can do next:** retry the same auth call — deliberately the only
action; a "skip for now" would either break the gate's purpose or invent an
unspecced partially-gated state.

**Logged:** `signup_gate_error {reason: 'auth_unreachable', swipe_count: 7}`
— distinct from `signup_abandoned` so the dashboard can tell "we broke" from
"they declined."

**Recovery guarantee:** once auth is reachable, retry succeeds with zero
data loss — R9's "fail closed on the gate, open on reading" rule made
concrete.

### E2 — Signup succeeds but the state merge fails

**What failed:** the account is created and the user authenticated, but
writing their 7 anonymous swipes/scores/Kept/seen/comments into the new
account fails partway or entirely (network drop mid-write, malformed local
record, server error).

**How it's recognized:** the merge is confirmed as a step **independent**
of auth success — auth succeeding is never treated as merge succeeding.

**State preserved — the non-negotiable rule:** **local anonymous state is
never deleted until the server confirms the merge succeeded.** Clearing
localStorage optimistically and then having the write fail would silently
lose everything with no error shown at all — a direct violation of R9's
"merge, never discard" promise.

**What the user sees:** never a visibly reset feed (empty meter, 0 kept,
generic first card) — that alone would tell them progress is gone before
we've even tried to fix it. Instead: signed in, local 7-swipe state renders
exactly as before, a small non-blocking sync indicator shows in the
background. If unresolved after a short window: *"Syncing your progress —
this may take a moment."* If retries exhaust: *"We couldn't sync your
earlier swipes to your account. Keep going — nothing local was lost."*

**What they can do next:** nothing required — the app works from local
state while retrying silently in the background.

**Logged:** `state_merge_started`, `state_merge_failed {attempt, reason}`,
`state_merge_succeeded {retries}` — retry count on eventual success
distinguishes a rare blip from a systemic problem.

**Recovery guarantee:** local state is the source of truth until the server
confirms otherwise — the worst case is "slower sync," never "silent data
loss."

### E3 — Pipeline stalls and a returning user hits "caught up" expecting fresh content

**What failed:** the R10 pipeline stops producing new verified cards for a
stretch (Guardian/verification down, or a topic's cards keep failing Haiku
until retries exhaust) — the store stops growing while users keep consuming
from it.

**How it's recognized:** the feed's exhaustion check (R2) fires as normal,
but the system distinguishes **two different reasons** for hitting empty:
"you've read everything that exists" vs. "the store hasn't grown in N
hours" — these must not share the same message.

**State preserved:** R2's existing rule, unchanged — replay clears `seen`,
preserves scores and Kept.

**What the user sees:** if content genuinely hasn't arrived recently, the
caught-up screen says so honestly — *"You're caught up — new fact-checked
cards land daily, check back soon"* — never dressing up a stalled pipeline
as "you're just really well-read." Directly protects **G4**: a user who
returns on day 2 to stale re-served content learns fast that returning
isn't rewarded.

**What they can do next:** *Swipe again* still works (re-serves from the
existing library, per R2) — staleness is disappointing, not broken; the app
never dead-ends.

**Logged:** `feed_exhausted {cards_seen, hours_since_last_new_card}` — that
last field turns a UI event into an operational alarm, read alongside R10's
own pipeline-run telemetry (generated/passed/discarded counts). This event
is the **user-impact proof** that an operational problem has become a
product problem.

**Recovery guarantee:** none available client-side — the actual fix is
operational (R10 pipeline health), not client-side; getting the wording
honest is the only thing in this scenario's control.

### E4 — Discover's viewport "seen" marking must not falsely burn scarce content

**What failed (a precise rule, not just a failure):** R5 requires 30
continuous seconds of active-foreground dwell before a card is marked
`seen` — a naive "any pixel visible" implementation would burn cards during
a fast scroll-past that the user never actually read, worsening the
content-scarcity risk already flagged in G2/G5/R2/R10.

**How it's recognized:** dwell time excludes backgrounded/app-switched time
— only active foreground viewing counts toward the 30s.

**The safe default when uncertain:** **under-marking, not over-marking.**
Ambiguous cases (rapid scrolling, backgrounding right at the boundary) stay
unmarked. An occasional duplicate re-serve is the cheaper failure than
silently deleting a scarce card from the pool.

**State preserved:** nothing to recover — this is prevention, not recovery;
the "state" being protected is the card pool itself.

**What the user sees:** nothing directly (invisible plumbing). The
observable symptom of getting this *wrong* is **E3** firing too early
relative to actual Discover reading — the two scenarios are linked.

**Logged:** `discovery_card_read {card_id, dwell_ms}` fires only at the 30s
mark — comparing rows rendered vs. this count gives the real read-through
rate, separate from list-open counts.

**Recovery guarantee:** none needed if the threshold is honored — this
scenario's purpose is making the *correct* implementation explicit enough
that "mark seen on any visibility" never ships by default.

## 6. Telemetry

Every event specced in §4–5, organized into the five categories (outcome /
behavioural / quality / diagnostic / guardrail). The core taxonomy is
already live in `src/lib/analytics.js`; events introduced by R4–R10 are
work items alongside their requirements. Privacy stance carries over
unchanged: autocapture off, session recording off, DNT honoured, no
free-form user text ever sent.

### Outcome — did the customer succeed?

| Event | Succeeds at |
|---|---|
| `onboarding_completed` | finishing onboarding |
| `signup_completed` / `signin_completed` | authenticating (R9) |
| `state_merge_succeeded {retries}` | keeping progress through signup (E2) |
| `comment_posted` | getting a comment through the filter |
| `discovery_card_read {card_id, dwell_ms}` | actually reading (30s dwell, R5/E4) |
| `card_saved {source, kept_count}` | finding something worth keeping |

### Behavioural — what did the customer do?

`app_opened` · `onboarding_started` · `onboarding_topic_toggled` ·
`card_viewed` · `card_swiped {action, method, topic, swipe_index}` ·
`card_unsaved` · `source_link_clicked` · `tuning_meter_toggled` ·
`discovery_opened` · `discovery_topic_selected` ·
`discovery_subtopic_filtered` · `comments_opened` · `kept_pile_viewed` ·
`tab_changed` · `paywall_viewed` · `paywall_clicked {feature}` ·
`interests_edit_started` · `interests_updated {added, removed}` ·
`feed_replayed` · `migration_notice_shown` / `_dismissed` ·
`signup_gate_shown {swipe_count}` · `signup_abandoned`

### Quality — did the system perform correctly?

- **R10 pipeline run log:** generated / passed / flagged-retried /
  discarded counts + per-card cost. *Note: this is backend/operational
  telemetry (a pipeline-run table), a separate surface from PostHog product
  analytics — it needs its own operator view, not folding into user
  analytics.*
- `discovery_card_read` dwell distribution — is content engaging enough to
  hold 30s, not merely present?
- `state_merge_started` → `_succeeded` / `_failed` ratio — is the merge
  mechanism reliable?

### Diagnostic — why did it fail?

| Event | Diagnostic payload |
|---|---|
| `signup_gate_error {reason, swipe_count}` | why the gate blocked entry (E1) |
| `state_merge_failed {attempt, reason}` | why progress didn't carry (E2) |
| `comment_rejected {reason}` | why a comment was blocked — never the text |
| `feed_exhausted {cards_seen, hours_since_last_new_card}` | "read everything" vs. "pipeline stalled" (E3) |
| R10 discard reasons (Haiku flag categories) | why generated cards never shipped |

### Guardrail — what might the product be damaging?

| Guardrail | Measured via |
|---|---|
| **Session length** (doom-scroll watch, NG3) | **Gap, kept deliberately — not built yet.** When built: capture session start/end with duration as a first-class event, not inferred gaps — one signal serving two consumers: the NG3 guardrail *and* the basis for daily/monthly average-usage (DAU/MAU-style) comparisons later. Design once for both. |
| **Comment toxicity rate** | `comment_rejected` rate — **flagged as under-measured and left as-is:** the word-list filter's rejection rate is a proxy; toxicity that passes the filter is invisible to it. The named guardrail is not fully instrumented in this release. |
| **Filter-bubble / top-topic share** (G2, G5) | Aggregation over `card_viewed` / `discovery_topic_selected` topic distributions vs. baseline — a query, not a new event. |
| **Paywall pressure** (over-gating check) | `save_limit_reached` rate + `paywall_clicked {feature}` — the same numbers serve monetization analysis and guard against gating too hard. |

## 7. Acceptance Criteria — *pending*

## 8. Non-Functional Requirements — *pending*

## 9. Prioritization — *pending*

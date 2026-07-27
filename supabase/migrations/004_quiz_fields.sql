-- 004 — quiz fields on cards (redesign: "guess first, then reveal").
--
-- The redesign's default card treatment asks a question, makes the reader
-- commit to a guess, then reveals the answer. That serves the North Star
-- directly: a card you guessed at is a card you're likelier to retain, which
-- is the difference between "cards swiped" and "cards kept AND retained".
--
-- Deliberately ADDITIVE and nullable. This database is shared with the live
-- site, so a migration that dropped or replaced rows would break real users'
-- Kept piles the moment it ran — the pre-redesign frontend simply ignores
-- these columns, and the redesign falls back to the editorial treatment for
-- any card where they are null.
--
-- Apply in the Supabase SQL editor. Idempotent — safe to re-run.

alter table cards add column if not exists quiz_question text;
alter table cards add column if not exists quiz_answer   text;
alter table cards add column if not exists stat          text;
alter table cards add column if not exists stat_label    text;

-- A card is quiz-ready only if it has BOTH halves. Enforced rather than
-- assumed: a question with no answer renders a card the reader can never
-- resolve, which is worse than showing no quiz at all.
alter table cards drop constraint if exists quiz_needs_both_halves;
alter table cards add constraint quiz_needs_both_halves
  check (
    (quiz_question is null and quiz_answer is null)
    or (quiz_question is not null and quiz_answer is not null)
  );

-- Same pairing rule for the headline stat and its label — a number with no
-- label is not information.
alter table cards drop constraint if exists stat_needs_label;
alter table cards add constraint stat_needs_label
  check (
    (stat is null and stat_label is null)
    or (stat is not null and stat_label is not null)
  );

comment on column cards.quiz_question is
  'Guess-first question, answerable from the card body. Null = no quiz treatment.';
comment on column cards.stat is
  'Short headline figure pulled from the source, e.g. "350M" or "1721".';

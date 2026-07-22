-- 003 — Discover reads (R5's 30-second dwell rule).
--
-- A read is deliberately NOT a swipe row. The temptation is to reuse `swipes`
-- with surface='discovery', but `action` is constrained to interested|pass and
-- a read is neither: R5 is explicit that "reading alone never scores; only
-- Save (+3) does". Forcing a read into that column would put non-signal rows
-- into the table every scoring and funnel query reads from, and every future
-- "keep-rate" number would quietly include people who only read.
--
-- Separate table, so "what did they read" and "what did they choose" stay
-- answerable independently.
--
-- Apply in the Supabase SQL editor. Idempotent — safe to re-run.

create table if not exists card_reads (
  user_id   uuid not null references profiles (id) on delete cascade,
  card_id   uuid not null references cards (id) on delete cascade,
  dwell_ms  integer not null check (dwell_ms >= 0),
  read_at   timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists card_reads_user_idx on card_reads (user_id, read_at desc);

alter table card_reads enable row level security;

-- Same shape as swipes: a user sees and writes only their own reads.
drop policy if exists card_reads_own on card_reads;
create policy card_reads_own on card_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

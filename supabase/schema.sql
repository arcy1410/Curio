-- Curio — Supabase schema
-- Implements the data model in docs/SPEC_WORKING.md §4 (R1–R10).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.
-- Safe to re-run (idempotent): every statement is IF NOT EXISTS / OR REPLACE.
--
-- The load-bearing decision in this file is at the bottom: Row Level Security
-- makes G3 ("no unverified card is ever served") a *database* guarantee rather
-- than an application convention. A client key physically cannot read a card
-- with verified = false — not through a bug, a missing WHERE clause, or a
-- hand-written query. Only the pipeline's service_role key sees drafts.

-- ─────────────────────────────────────────────────────────────
-- Topics — top-level topics have parent_topic_id = NULL;
-- sub-topics point at their parent (spec data model).
-- ─────────────────────────────────────────────────────────────
create table if not exists topics (
  id              text primary key,              -- slug: 'cricket', 'cricket.ipl'
  name            text not null,
  parent_topic_id text references topics (id) on delete cascade,
  emoji           text,
  color           text,                          -- per-topic neon accent
  blurb           text,
  created_at      timestamptz not null default now()
);

create index if not exists topics_parent_idx on topics (parent_topic_id);

-- ─────────────────────────────────────────────────────────────
-- Cards — the content store the feed and Discover read from.
-- ─────────────────────────────────────────────────────────────
create table if not exists cards (
  id              uuid primary key default gen_random_uuid(),
  topic_id        text not null references topics (id),           -- top-level
  subtopic_id     text references topics (id),                    -- optional child
  title           text not null,
  body            text not null,
  source_url      text not null,                                  -- never nullable (G3)
  source_type     text not null default 'wikipedia'
                    check (source_type in ('wikipedia', 'guardian', 'tmdb')),
  verified        boolean not null default false,
  verified_at     timestamptz,

  -- R10 provenance: which models produced/checked this card, and what it cost.
  -- Recorded per card so cost and quality can be compared across model versions.
  generator_model text,
  verifier_model  text,
  cost_usd        numeric(10, 6),

  created_at      timestamptz not null default now(),

  -- G3 as a table constraint: 'verified' cannot be true without a source and a
  -- verification timestamp. The invariant cannot be violated by any code path.
  constraint verified_requires_provenance
    check (
      verified = false
      or (source_url is not null and length(source_url) > 0 and verified_at is not null)
    )
);

create index if not exists cards_topic_idx    on cards (topic_id);
create index if not exists cards_verified_idx on cards (verified) where verified = true;
-- One card per source URL — stops the pipeline re-generating the same article.
create unique index if not exists cards_source_url_key on cards (source_url);

-- ─────────────────────────────────────────────────────────────
-- Profiles — app-level user data. Mirrors auth.users (R9).
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  interests     text[] not null default '{}',    -- topic slugs chosen at onboarding
  state_version integer not null default 2,      -- R8 migration cue
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Swipes — one row per interested/pass. Saving is NOT a swipe
-- record's job (R4): saved_cards is its own table.
-- ─────────────────────────────────────────────────────────────
create table if not exists swipes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles (id) on delete cascade,
  card_id   uuid not null references cards (id) on delete cascade,
  action    text not null check (action in ('interested', 'pass')),
  surface   text not null default 'feed' check (surface in ('feed', 'discovery')),
  created_at timestamptz not null default now(),

  -- Exactly-once per card per user (NFR reliability: no double-counted swipes).
  unique (user_id, card_id)
);

create index if not exists swipes_user_idx on swipes (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Saved cards — the Kept pile. Only ever written by an explicit
-- save (R4). The 20-card free-tier cap is enforced by trigger below.
-- ─────────────────────────────────────────────────────────────
create table if not exists saved_cards (
  user_id  uuid not null references profiles (id) on delete cascade,
  card_id  uuid not null references cards (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, card_id)               -- one entry per card, no duplicates
);

create index if not exists saved_cards_user_idx on saved_cards (user_id, saved_at desc);

-- ─────────────────────────────────────────────────────────────
-- Topic scores — additive personalization (Pass −1 / Interested +3 /
-- feed-Save +5 / Discover-Save +3). One row per user per topic.
-- ─────────────────────────────────────────────────────────────
create table if not exists topic_scores (
  user_id    uuid not null references profiles (id) on delete cascade,
  topic_id   text not null references topics (id) on delete cascade,
  score      numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- ─────────────────────────────────────────────────────────────
-- Comments — one level of replies only (R6). A reply must point at
-- a top-level comment; the trigger below rejects depth > 1.
-- ─────────────────────────────────────────────────────────────
create table if not exists comments (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid not null references cards (id) on delete cascade,
  user_id           uuid not null references profiles (id) on delete cascade,
  parent_comment_id uuid references comments (id) on delete cascade,
  body              text not null check (length(body) between 1 and 500),
  created_at        timestamptz not null default now()
);

create index if not exists comments_card_idx on comments (card_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Pipeline runs — R10 operational telemetry. Deliberately NOT
-- product analytics (that's PostHog); this is the operator view
-- that answers "is the content pipeline healthy?" (spec §6).
-- ─────────────────────────────────────────────────────────────
create table if not exists pipeline_runs (
  id                uuid primary key default gen_random_uuid(),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  trigger           text not null default 'scheduled'
                      check (trigger in ('scheduled', 'manual')),
  generated_count   integer not null default 0,
  passed_count      integer not null default 0,
  retried_count     integer not null default 0,
  discarded_count   integer not null default 0,
  total_cost_usd    numeric(10, 6) not null default 0,
  error             text
);

-- ═════════════════════════════════════════════════════════════
-- Constraints enforced by trigger
-- ═════════════════════════════════════════════════════════════

-- R6: replies are one level deep. A comment whose parent already has a
-- parent is rejected — the "locked nested reply" is a paywall affordance,
-- never actually persisted in this release.
create or replace function reject_nested_reply() returns trigger as $$
begin
  if new.parent_comment_id is not null then
    if exists (
      select 1 from comments
      where id = new.parent_comment_id and parent_comment_id is not null
    ) then
      raise exception 'replies are limited to one level deep';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists comments_one_level on comments;
create trigger comments_one_level
  before insert or update on comments
  for each row execute function reject_nested_reply();

-- R4: free tier caps the Kept pile at 20 cards. Enforced server-side so the
-- cap holds even if a client is modified — the paywall is a real boundary,
-- not a UI suggestion.
create or replace function enforce_save_cap() returns trigger as $$
declare
  current_count integer;
begin
  select count(*) into current_count from saved_cards where user_id = new.user_id;
  if current_count >= 20 then
    raise exception 'save_limit_reached' using hint = 'Free tier is capped at 20 saved cards.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists saved_cards_cap on saved_cards;
create trigger saved_cards_cap
  before insert on saved_cards
  for each row execute function enforce_save_cap();

-- Auto-create a profile row when a user signs up (R9 merge target).
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═════════════════════════════════════════════════════════════
-- Row Level Security
--
-- This is where G3 stops being a promise and becomes physics.
-- ═════════════════════════════════════════════════════════════

alter table topics       enable row level security;
alter table cards        enable row level security;
alter table profiles     enable row level security;
alter table swipes       enable row level security;
alter table saved_cards  enable row level security;
alter table topic_scores enable row level security;
alter table comments     enable row level security;
alter table pipeline_runs enable row level security;

-- Topics: world-readable reference data.
drop policy if exists topics_read on topics;
create policy topics_read on topics for select using (true);

-- Cards: ONLY verified cards are visible to any client key.
-- An unverified draft is unreadable through the anon/authenticated role —
-- it does not exist as far as the app is concerned. The pipeline writes
-- drafts with the service_role key, which bypasses RLS entirely.
drop policy if exists cards_read_verified on cards;
create policy cards_read_verified on cards
  for select using (verified = true);

-- Profiles: a user sees and edits only their own.
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Swipes / saves / scores: strictly own-rows.
drop policy if exists swipes_own on swipes;
create policy swipes_own on swipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists saved_own on saved_cards;
create policy saved_own on saved_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists scores_own on topic_scores;
create policy scores_own on topic_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Comments: everyone reads; you may only write/edit/delete your own.
drop policy if exists comments_read on comments;
create policy comments_read on comments for select using (true);

drop policy if exists comments_write_own on comments;
create policy comments_write_own on comments
  for insert with check (auth.uid() = user_id);

drop policy if exists comments_modify_own on comments;
create policy comments_modify_own on comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists comments_delete_own on comments;
create policy comments_delete_own on comments
  for delete using (auth.uid() = user_id);

-- Pipeline runs: no client policy at all. With RLS enabled and zero policies,
-- every client key reads nothing. Only service_role (the pipeline) can touch it.

-- ═════════════════════════════════════════════════════════════
-- Seed topics (mirrors src/data/topics.js)
-- ═════════════════════════════════════════════════════════════

insert into topics (id, name, parent_topic_id, emoji, color, blurb) values
  ('cricket',   'Cricket',   null, '🏏', '#3ddc84', 'The game that stops the country.'),
  ('markets',   'Markets',   null, '📈', '#ffb020', 'Money, mania, and how it all moves.'),
  ('bollywood', 'Bollywood', null, '🎬', '#ff4d8d', 'A century of song, spectacle and stars.'),
  ('history',   'History',   null, '🏛️', '#43b7ff', 'Where the subcontinent came from.')
on conflict (id) do nothing;

insert into topics (id, name, parent_topic_id) values
  ('cricket.indian',      'Indian Cricket',    'cricket'),
  ('cricket.worldcups',   'World Cups',        'cricket'),
  ('cricket.ipl',         'IPL',               'cricket'),
  ('cricket.records',     'Records',           'cricket'),
  ('markets.stocks',      'Stock Market',      'markets'),
  ('markets.personal',    'Personal Finance',  'markets'),
  ('markets.scandals',    'Scandals',          'markets'),
  ('bollywood.classics',  'Classics',          'bollywood'),
  ('bollywood.awards',    'Awards',            'bollywood'),
  ('bollywood.bts',       'Behind the Scenes', 'bollywood'),
  ('history.ancient',     'Ancient India',     'history'),
  ('history.medieval',    'Medieval India',    'history'),
  ('history.science',     'Science & Math',    'history')
on conflict (id) do nothing;

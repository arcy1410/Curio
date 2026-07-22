-- 002 — make comment threads shared, not per-browser.
--
-- The tables already existed and the read policy was already public
-- (`comments_read using (true)`). What was missing was everything needed to
-- actually render someone else's comment safely:
--
--   1. An author name a *reader* is allowed to see.
--   2. A moderation check that survives contact with a hostile client.
--
-- Apply in the Supabase SQL editor. Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Author name, denormalised onto the comment.
-- ─────────────────────────────────────────────────────────────
--
-- The obvious approach — join comments to profiles for display_name — does
-- not work here, and fails SILENTLY rather than loudly: `profiles_own`
-- restricts reads to `auth.uid() = id`, so a join returns your own name and
-- NULL for everyone else. Every comment but yours would render as "Anonymous"
-- with no error anywhere.
--
-- The fix is not to loosen `profiles_own`. That table holds `interests` — the
-- user's chosen topics — and making it world-readable to render a name would
-- publish every user's interest profile. That is exactly the surveillance
-- story the ethics section says Curio must not have.
--
-- So the name is copied onto the comment at insert time: it is the one field
-- the author is publishing on purpose, and it travels with the thing they
-- published.
alter table comments add column if not exists author_name text;

create or replace function set_comment_author()
returns trigger
language plpgsql
security definer                         -- must read profiles past its own RLS
set search_path = public
as $$
begin
  select coalesce(nullif(trim(p.display_name), ''), 'Reader')
    into new.author_name
    from profiles p
   where p.id = new.user_id;

  -- No profile row yet (anonymous sign-in mid-flight): still name them.
  new.author_name := coalesce(new.author_name, 'Reader');
  return new;
end;
$$;

drop trigger if exists comments_set_author on comments;
create trigger comments_set_author
  before insert on comments
  for each row execute function set_comment_author();

-- ─────────────────────────────────────────────────────────────
-- 2. Moderation, enforced by the database.
-- ─────────────────────────────────────────────────────────────
--
-- profanity.js runs in the browser, which made it a UX affordance rather than
-- a control: the publishable key can POST straight to PostgREST and skip the
-- React app entirely. That was tolerable while comments were local — the only
-- person who saw the result was the author. Shared threads make it a real
-- moderation gap, so the rule moves to where it cannot be bypassed.
--
-- Honest limitation: this duplicates the word list in profanity.js, and two
-- copies of a list drift. The client copy is kept for immediate feedback while
-- typing; THIS copy is the one that decides. If they disagree, the database
-- wins and the user sees a generic rejection.
create or replace function check_comment_content()
returns trigger
language plpgsql
as $$
declare
  blocked text[] := array[
    'damn','hell','crap','idiot','stupid','moron',
    'shit','fuck','bastard','ass','bitch'
  ];
  word text;
begin
  if new.body ~* '(https?://|www\.)' then
    raise exception 'links_not_allowed' using errcode = 'check_violation';
  end if;

  -- Word-boundary match on a lowercased body, so "class" does not trip "ass".
  foreach word in array blocked loop
    if lower(new.body) ~ ('\m' || word || '\M') then
      raise exception 'blocked_language' using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists comments_check_content on comments;
create trigger comments_check_content
  before insert or update of body on comments
  for each row execute function check_comment_content();

-- ─────────────────────────────────────────────────────────────
-- 3. Comment counts for the card face.
-- ─────────────────────────────────────────────────────────────
--
-- The card shows "3 comments" before you open the sheet. Counting that in the
-- client would mean fetching every comment for every card in the deck just to
-- print a number. One grouped view instead.
--
-- security_invoker = on so the view is subject to the CALLER's policies, not
-- the view owner's. Without it a view silently becomes a hole around RLS —
-- harmless for a public table like comments, a serious bug the day someone
-- copies this pattern onto a private one.
create or replace view comment_counts
  with (security_invoker = on)
as
  select card_id, count(*)::int as n
    from comments
   group by card_id;

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill any comments that predate the author column.
-- ─────────────────────────────────────────────────────────────
update comments set author_name = 'Reader' where author_name is null;

-- 006 — user-triggered refill runs (api/refill.js).
--
-- Two changes to pipeline_runs:
--   1. Allow trigger = 'user' — a run started by a reader who exhausted the
--      feed, as opposed to the cron ('scheduled') or an operator ('manual').
--   2. requested_by — which user asked. This is what makes the per-user
--      hourly rate limit in api/refill.js enforceable; before this migration
--      the endpoint still works but is protected by the global cap only.
--
-- No RLS change: pipeline_runs stays service-role-only, so requested_by is
-- never readable by any client key.

alter table pipeline_runs
  drop constraint if exists pipeline_runs_trigger_check;

alter table pipeline_runs
  add constraint pipeline_runs_trigger_check
  check (trigger in ('scheduled', 'manual', 'user'));

alter table pipeline_runs
  add column if not exists requested_by uuid references auth.users (id) on delete set null;

-- The rate-limit query is (requested_by, started_at >= now() - 1h).
create index if not exists pipeline_runs_requested_by_idx
  on pipeline_runs (requested_by, started_at desc);

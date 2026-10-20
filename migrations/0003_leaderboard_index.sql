-- Real global leaderboard index (Stage 3 of the multi-source indexer).
-- board_profiles grows from a 48-row hand-picked board into a materialized,
-- SQL-ranked index: every window metric the UI sorts by is a real column so
-- /board is a single indexed ORDER BY ... LIMIT, never N live GitHub fetches.
alter table board_profiles
  add column if not exists login_display text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists followers integer,
  add column if not exists total_12m integer not null default 0,
  add column if not exists total_90d integer not null default 0,
  add column if not exists total_30d integer not null default 0,
  add column if not exists total_7d integer not null default 0,
  add column if not exists active_days_12m integer not null default 0,
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists best_day_date text,
  add column if not exists best_day_count integer not null default 0,
  add column if not exists score_12m integer not null default 0,
  add column if not exists score_90d integer not null default 0,
  add column if not exists score_30d integer not null default 0,
  add column if not exists score_7d integer not null default 0,
  add column if not exists momentum_30d integer,
  add column if not exists commits_12m integer,
  add column if not exists prs_12m integer,
  add column if not exists reviews_12m integer,
  add column if not exists issues_12m integer,
  add column if not exists restricted_12m integer,
  add column if not exists source text,
  add column if not exists bot_score double precision not null default 0,
  add column if not exists is_bot boolean not null default false,
  add column if not exists indexed_at timestamptz;

create index if not exists board_profiles_score_12m_idx
  on board_profiles (score_12m desc) where not is_bot;
create index if not exists board_profiles_score_90d_idx
  on board_profiles (score_90d desc) where not is_bot;
create index if not exists board_profiles_score_30d_idx
  on board_profiles (score_30d desc) where not is_bot;
create index if not exists board_profiles_score_7d_idx
  on board_profiles (score_7d desc) where not is_bot;
create index if not exists board_profiles_total_12m_idx
  on board_profiles (total_12m desc) where not is_bot;
create index if not exists board_profiles_streak_idx
  on board_profiles (current_streak desc) where not is_bot;
create index if not exists board_profiles_peak_idx
  on board_profiles (best_day_count desc) where not is_bot;
create index if not exists board_profiles_indexed_at_idx
  on board_profiles (indexed_at asc nulls first);

-- Stage 1 -> Stage 2 handoff. Every discovery channel (ClickHouse GH Archive,
-- follower-stratified GraphQL sweep, trending, organic profile views, manual
-- adds) enqueues here; the verification worker drains it by priority.
create table if not exists candidate_queue (
  username text primary key,
  source text not null,
  priority integer not null default 0,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  signals jsonb,
  discovered_at timestamptz not null default now(),
  claimed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists candidate_queue_pending_idx
  on candidate_queue (priority desc, next_attempt_at asc)
  where status = 'pending';
create index if not exists candidate_queue_status_idx
  on candidate_queue (status);

-- One row per indexer run (cron, CLI, or manual) for the status surface.
create table if not exists index_runs (
  id bigserial primary key,
  kind text not null,
  status text not null default 'running',
  stats jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists index_runs_started_idx
  on index_runs (started_at desc);

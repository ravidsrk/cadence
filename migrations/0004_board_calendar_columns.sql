-- Existing databases may have applied 0002 before calendar caching was added.
-- A separate migration upgrades them even though 0002 is already recorded.
alter table board_profiles
  add column if not exists calendar_json jsonb,
  add column if not exists cached_today text,
  add column if not exists updated_at timestamptz;

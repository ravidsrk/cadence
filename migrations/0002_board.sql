create table if not exists board_profiles (
  username text primary key,
  added_at timestamptz not null default now(),
  calendar_json jsonb,
  cached_today text,
  updated_at timestamptz
);

alter table board_profiles
  add column if not exists calendar_json jsonb,
  add column if not exists cached_today text,
  add column if not exists updated_at timestamptz;

insert into board_profiles (username) values
  ('ravidsrk'),
  ('torvalds'),
  ('sindresorhus'),
  ('antfu'),
  ('shadcn'),
  ('rich-harris'),
  ('yyx990803'),
  ('gaearon'),
  ('tannerlinsley'),
  ('mitchellh'),
  ('evanw'),
  ('burntsushi'),
  ('dtolnay'),
  ('tiangolo'),
  ('rauchg'),
  ('karpathy')
on conflict (username) do nothing;

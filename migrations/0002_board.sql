create table if not exists board_profiles (
  username text primary key,
  added_at timestamptz not null default now()
);

insert into board_profiles (username) values
  ('ravidsrk'),
  ('torvalds'),
  ('gaearon'),
  ('yyx990803'),
  ('sindresorhus')
on conflict (username) do nothing;

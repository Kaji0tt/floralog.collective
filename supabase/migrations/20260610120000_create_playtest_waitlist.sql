create table if not exists public.playtest_waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  wants_updates boolean not null default false,
  source text not null default 'guest-playtest-direct',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.playtest_waitlist enable row level security;

revoke all on table public.playtest_waitlist from anon;
revoke all on table public.playtest_waitlist from authenticated;

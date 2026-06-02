-- Track map opens to power KPI metrics (avg map views per user by day/week/month).

create table if not exists public."MapViewEvent" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'home_map',
  created_date timestamptz not null default now(),
  created_by text
);

create index if not exists idx_mapviewevent_created_date
  on public."MapViewEvent" (created_date desc);

create index if not exists idx_mapviewevent_auth_id_created_date
  on public."MapViewEvent" (auth_id, created_date desc);

alter table public."MapViewEvent" enable row level security;

-- Users can only write their own events.
drop policy if exists "MapViewEvent insert own" on public."MapViewEvent";
create policy "MapViewEvent insert own"
  on public."MapViewEvent"
  for insert
  to authenticated
  with check ((select auth.uid()) = auth_id);

-- Global KPI cards currently require app-wide reads for authenticated users.
drop policy if exists "MapViewEvent read authenticated" on public."MapViewEvent";
create policy "MapViewEvent read authenticated"
  on public."MapViewEvent"
  for select
  to authenticated
  using (true);

grant select, insert on public."MapViewEvent" to authenticated;

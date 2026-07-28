-- Track in-app navigation and interaction events for UX analytics.
-- Powers the "Navigation & Aktionen" card in KPIAdmin.

create table if not exists public."UserActionEvent" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  source_page text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_useraction_created_at
  on public."UserActionEvent" (created_at desc);

create index if not exists idx_useraction_auth_id_created_at
  on public."UserActionEvent" (auth_id, created_at desc);

create index if not exists idx_useraction_event_name_created_at
  on public."UserActionEvent" (event_name, created_at desc);

alter table public."UserActionEvent" enable row level security;

drop policy if exists "UserActionEvent insert own" on public."UserActionEvent";
create policy "UserActionEvent insert own"
  on public."UserActionEvent"
  for insert
  to authenticated
  with check ((select auth.uid()) = auth_id);

-- All authenticated users can read (KPIAdmin is UI-gated to admin role).
drop policy if exists "UserActionEvent read authenticated" on public."UserActionEvent";
create policy "UserActionEvent read authenticated"
  on public."UserActionEvent"
  for select
  to authenticated
  using (true);

grant select, insert on public."UserActionEvent" to authenticated;

-- Create unique_badges table for special one-off badges awarded to specific users.
-- These badges cannot be earned through metrics and are manually assigned.

create table if not exists public.unique_badges (
  id bigint generated always as identity primary key,
  auth_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  awarded_at timestamptz not null default now(),
  constraint unique_badges_auth_badge_unique unique (auth_id, badge_id)
);

comment on table public.unique_badges is
  'Special one-off badges awarded to specific users (e.g. legacy leaderboard positions).';

-- RLS policies
alter table public.unique_badges enable row level security;

drop policy if exists "Users can read their own unique badges" on public.unique_badges;
create policy "Users can read their own unique badges"
  on public.unique_badges for select
  using (auth.uid() = auth_id);

drop policy if exists "Authenticated users can read all unique badges" on public.unique_badges;
create policy "Authenticated users can read all unique badges"
  on public.unique_badges for select
  using (auth.role() = 'authenticated');

-- Insert legacy leaderboard badges for top 5 players
insert into public.unique_badges (auth_id, badge_id) values
  ('75b01eab-4656-4d36-8b44-f478bc370f37', 'legacy_rank_1'),
  ('cee02e85-6e4c-43fa-a18c-1ef4288835cf', 'legacy_rank_2'),
  ('2b78c699-e18e-44b8-9730-c256bfabbe38', 'legacy_rank_3'),
  ('eb3dc921-1d98-4d8c-b060-ec75ed6c7446', 'legacy_rank_4'),
  ('ab2ab3d4-ad64-41d5-ba10-828a78030309', 'legacy_rank_5')
on conflict (auth_id, badge_id) do nothing;

notify pgrst, 'reload schema';

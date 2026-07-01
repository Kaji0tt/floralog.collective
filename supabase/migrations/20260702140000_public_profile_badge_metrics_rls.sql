-- Migration: Read access for public-profile badge metrics.
-- Adds additive SELECT policies to UserWeeklyQuest, UserMonthlyQuest and UserRewards
-- so that any authenticated user can read stats for players whose public_profile is
-- not explicitly false (the default is true / public).
--
-- The existing own-user policies are preserved; Supabase OR-combines multiple
-- SELECT policies, so own-user access continues to work unchanged.

-- ── UserWeeklyQuest ──────────────────────────────────────────────────────────
drop policy if exists "UserWeeklyQuest: read public profiles"
  on public."UserWeeklyQuest";

create policy "UserWeeklyQuest: read public profiles"
  on public."UserWeeklyQuest"
  for select
  to authenticated
  using (
    auth_id in (
      select auth_id
      from public."PublicProfile"
      where public_profile is not false
        and auth_id is not null
    )
  );

-- ── UserMonthlyQuest ─────────────────────────────────────────────────────────
drop policy if exists "UserMonthlyQuest: read public profiles"
  on public."UserMonthlyQuest";

create policy "UserMonthlyQuest: read public profiles"
  on public."UserMonthlyQuest"
  for select
  to authenticated
  using (
    auth_id in (
      select auth_id
      from public."PublicProfile"
      where public_profile is not false
        and auth_id is not null
    )
  );

-- ── UserRewards ──────────────────────────────────────────────────────────────
-- RLS is already enabled on this table (migration 002_add_rewards_rls.sql).
drop policy if exists "UserRewards: read public profiles"
  on public."UserRewards";

create policy "UserRewards: read public profiles"
  on public."UserRewards"
  for select
  to authenticated
  using (
    auth_id in (
      select auth_id
      from public."PublicProfile"
      where public_profile is not false
        and auth_id is not null
    )
  );

notify pgrst, 'reload schema';

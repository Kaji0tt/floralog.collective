-- Allow all authenticated users to read discoveries from users who have local_tracking enabled.
-- Supabase OR-combines multiple SELECT policies, so this is additive to the existing
-- "userplantdiscovery_select_own" and "read_own_and_friends_discoveries" policies.

drop policy if exists "discovery_select_local_tracking" on public."UserPlantDiscovery";

create policy "discovery_select_local_tracking"
  on public."UserPlantDiscovery"
  for select
  to authenticated
  using (
    exists (
      select 1
      from public."PublicProfile" pp
      where pp.auth_id = "UserPlantDiscovery".auth_id
        and pp.local_tracking is not false
    )
  );

notify pgrst, 'reload schema';

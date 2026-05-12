-- Optional migration for the Explorer Log "Alle" filter.
-- Apply this only if authenticated users should be able to read all discovery rows,
-- including scans from players who are not in their friend list.

drop policy if exists "discovery_select_all_authenticated" on public."UserPlantDiscovery";

create policy "discovery_select_all_authenticated"
  on public."UserPlantDiscovery"
  for select
  to authenticated
  using (true);

notify pgrst, 'reload schema';
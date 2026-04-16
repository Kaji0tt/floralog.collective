-- 035_add_public_community_stats_function.sql
-- Creates a security-definer function that returns aggregate community stats.
-- Safe for anon access: only returns counts, no personal data.

create or replace function public.get_community_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'active_researchers_this_month',
    (
      select count(distinct auth_id)
      from public."UserPlantDiscovery"
      where discovered_date::timestamptz >= date_trunc('month', now())
        and auth_id is not null
    ),
    'total_species',
    (
      select count(*) from public."PlantGenus"
    ),
    'total_scans',
    (
      select count(*) from public."UserPlantDiscovery"
    )
  );
$$;

-- Allow anon and authenticated users to call this function
grant execute on function public.get_community_stats() to anon, authenticated;

-- Global scan leaderboard RPC (bypasses discovery friend/public-profile RLS)
-- Returns aggregated scan counts per user for authenticated clients.

create or replace function public.get_global_scan_leaderboard()
returns table (
  auth_id uuid,
  user_email text,
  display_name text,
  full_name text,
  scan_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
    pp.display_name,
    pp.full_name,
    count(*)::bigint as scan_count
  from public."UserPlantDiscovery" upd
  left join public."PublicProfile" pp
    on pp.auth_id = upd.auth_id
  where upd.auth_id is not null
  group by
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having count(*) > 0
  order by count(*) desc;
$$;

revoke all on function public.get_global_scan_leaderboard() from public;
grant execute on function public.get_global_scan_leaderboard() to authenticated;

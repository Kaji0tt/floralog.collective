-- Scan-of-the-Week history RPC for the Explorer Log "SOTW" filter.
-- Surfaces every past SOTW-style spark grant (automatic "most liked scan of
-- the week" from weeklyRewardsScheduler + manual admin awards from
-- AdminScanOfTheWeek) as a single, publicly readable, staggered-by-week feed.
-- Bypasses UserWalletLedger RLS (select-own-only) via SECURITY DEFINER, same
-- pattern as get_explorer_scan_rewards / get_explorer_reward_unlocks.

create or replace function public.get_scan_of_the_week_history(
  p_limit integer default 200
)
returns table (
  ledger_id           uuid,
  auth_id             uuid,
  actor_name          text,
  discovery_id        text,
  image_url           text,
  plant_species_name  text,
  sparks_amount       integer,
  like_count          integer,
  week_key            text,
  awarded_at          timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id as ledger_id,
    l.auth_id,
    coalesce(pp.display_name, pp.full_name, 'Unbekannt') as actor_name,
    coalesce(l.metadata->>'discovery_id', l.metadata->>'discoveryId') as discovery_id,
    d.image_url,
    p.species_name as plant_species_name,
    l.amount as sparks_amount,
    nullif(l.metadata->>'like_count', '')::integer as like_count,
    coalesce(
      l.metadata->>'week',
      to_char(l.created_at at time zone 'utc', 'IYYY-"W"IW')
    ) as week_key,
    l.created_at as awarded_at
  from public."UserWalletLedger" l
  left join public."PublicProfile" pp on pp.auth_id = l.auth_id
  left join public."UserPlantDiscovery" d
    on d.id = coalesce(l.metadata->>'discovery_id', l.metadata->>'discoveryId')
  left join public."Plant" p on p.id = d.plant_id
  where l.currency_code = 'sparks'
    and l.event_source in ('weekly_likes_reward', 'scan_of_the_week')
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.get_scan_of_the_week_history(integer) from public;
grant execute on function public.get_scan_of_the_week_history(integer) to authenticated;

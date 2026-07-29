-- Explorer scan rewards RPC (bypasses RobotPlantWalletLedger RLS)
-- Returns seed amount, event_source and data_quality_delta for a list of
-- discovery IDs so the social explorer feed can display reward context.

create or replace function public.get_explorer_scan_rewards(
  p_discovery_ids text[]
)
returns table (
  discovery_id text,
  seed_amount  integer,
  event_source text,
  data_quality_delta integer
)
language sql
security definer
set search_path = public
as $$
  select
    l.event_reference::text                                      as discovery_id,
    l.amount::integer                                            as seed_amount,
    l.event_source,
    coalesce((l.metadata->>'dataQualityDelta')::integer, 0)     as data_quality_delta
  from public."RobotPlantWalletLedger" l
  where l.currency_code = 'seed'
    and l.direction     = 'credit'
    and l.amount        > 0
    and l.event_source in (
      'scan', 'new_scan', 'new_global_scan',
      'new_season_scan', 'season_rediscovery'
    )
    and l.event_reference = any(p_discovery_ids);
$$;

revoke all on function public.get_explorer_scan_rewards(text[]) from public;
grant execute on function public.get_explorer_scan_rewards(text[]) to authenticated;

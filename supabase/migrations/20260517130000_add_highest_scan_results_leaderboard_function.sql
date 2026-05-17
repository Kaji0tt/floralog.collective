-- Highest scan-result leaderboard RPC (bypasses RobotPlantWalletLedger RLS)
-- Returns the best single scan reward per user for authenticated clients.

create or replace function public.get_highest_scan_results_leaderboard(
  p_limit integer default 50
)
returns table (
  auth_id uuid,
  user_email text,
  display_name text,
  full_name text,
  reward_amount integer,
  event_source text,
  event_reference text,
  awarded_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with scan_rewards as (
    select
      l.auth_id,
      lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
      pp.display_name,
      pp.full_name,
      l.amount::integer as reward_amount,
      l.event_source,
      l.event_reference,
      l.created_at as awarded_at,
      row_number() over (
        partition by l.auth_id
        order by l.amount desc, l.created_at desc
      ) as rn
    from public."RobotPlantWalletLedger" l
    left join public."PublicProfile" pp
      on pp.auth_id = l.auth_id
    left join public."UserPlantDiscovery" upd
      on upd.id::text = l.event_reference
    where l.auth_id is not null
      and l.currency_code = 'seed'
      and l.direction = 'credit'
      and l.amount > 0
      and l.event_source in ('scan', 'new_scan', 'new_global_scan')
  )
  select
    auth_id,
    user_email,
    display_name,
    full_name,
    reward_amount,
    event_source,
    event_reference,
    awarded_at
  from scan_rewards
  where rn = 1
  order by reward_amount desc, awarded_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.get_highest_scan_results_leaderboard(integer) from public;
grant execute on function public.get_highest_scan_results_leaderboard(integer) to authenticated;

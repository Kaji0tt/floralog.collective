-- Add optional p_from_date parameter to leaderboard functions
-- so rankings default to season data (from 2026-06-21 onwards).
-- Old data remains accessible by passing NULL or omitting the parameter.

-- 1) Global scan leaderboard: add p_from_date filter
drop function if exists public.get_global_scan_leaderboard();

create or replace function public.get_global_scan_leaderboard(
  p_from_date date default null
)
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
    and (p_from_date is null or upd.discovered_date >= p_from_date)
  group by
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having count(*) > 0
  order by count(*) desc;
$$;

revoke all on function public.get_global_scan_leaderboard(date) from public;
grant execute on function public.get_global_scan_leaderboard(date) to authenticated;


-- 2) Highest scan results leaderboard: add p_from_date filter
drop function if exists public.get_highest_scan_results_leaderboard(integer);

create or replace function public.get_highest_scan_results_leaderboard(
  p_limit integer default 50,
  p_from_date date default null
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
      and (p_from_date is null or l.created_at >= p_from_date::timestamptz)
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

revoke all on function public.get_highest_scan_results_leaderboard(integer, date) from public;
grant execute on function public.get_highest_scan_results_leaderboard(integer, date) to authenticated;


-- 3) Weekly seed leaderboard: add p_from_date to override the week start
drop function if exists public.get_weekly_seed_leaderboard(integer);

create or replace function public.get_weekly_seed_leaderboard(
  p_limit integer default 50,
  p_from_date date default null
)
returns table (
  auth_id uuid,
  user_email text,
  display_name text,
  full_name text,
  weekly_seed_total bigint
)
language sql
security definer
set search_path = public
as $$
  with date_bounds as (
    select coalesce(p_from_date::timestamptz, date_trunc('week', now())) as bound_start
  )
  select
    l.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
    pp.display_name,
    pp.full_name,
    sum(l.amount)::bigint as weekly_seed_total
  from public."RobotPlantWalletLedger" l
  left join public."PublicProfile" pp
    on pp.auth_id = l.auth_id
  left join public."UserPlantDiscovery" upd
    on upd.id::text = l.event_reference
  cross join date_bounds db
  where l.auth_id is not null
    and l.currency_code = 'seed'
    and l.direction = 'credit'
    and l.amount > 0
    and l.created_at >= db.bound_start
  group by
    l.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having sum(l.amount) > 0
  order by sum(l.amount) desc, lower(coalesce(pp.user_email, upd.user, upd.created_by)) asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.get_weekly_seed_leaderboard(integer, date) from public;
grant execute on function public.get_weekly_seed_leaderboard(integer, date) to authenticated;

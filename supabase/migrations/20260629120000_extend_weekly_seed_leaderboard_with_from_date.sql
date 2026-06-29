-- Extend get_weekly_seed_leaderboard with optional p_from_date parameter.
-- When p_from_date is provided (e.g. season start), aggregate from that date.
-- When omitted, falls back to the current ISO week (date_trunc('week', now())).

create or replace function public.get_weekly_seed_leaderboard(
  p_limit    integer default 50,
  p_from_date text    default null
)
returns table (
  auth_id          uuid,
  user_email       text,
  display_name     text,
  full_name        text,
  weekly_seed_total bigint
)
language sql
security definer
set search_path = public
as $$
  with window_start as (
    select
      case
        when p_from_date is not null
          then p_from_date::timestamptz
        else date_trunc('week', now())
      end as ts
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
  cross join window_start ws
  where l.auth_id is not null
    and l.currency_code = 'seed'
    and l.direction = 'credit'
    and l.amount > 0
    and l.created_at >= ws.ts
  group by
    l.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having sum(l.amount) > 0
  order by sum(l.amount) desc, lower(coalesce(pp.user_email, upd.user, upd.created_by)) asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.get_weekly_seed_leaderboard(integer, text) from public;
grant execute on function public.get_weekly_seed_leaderboard(integer, text) to authenticated;

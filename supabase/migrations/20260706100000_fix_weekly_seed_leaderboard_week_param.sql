-- Fix: add p_week_start parameter to get_weekly_seed_leaderboard so that
-- the AdminWeeklyReport can fetch seeds earned for any historical week.
-- When p_week_start is NULL the function behaves exactly as before
-- (uses the start of the current ISO week).

create or replace function public.get_weekly_seed_leaderboard(
  p_limit     integer    default 50,
  p_week_start timestamptz default null
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
  with week_bounds as (
    select
      coalesce(p_week_start, date_trunc('week', now())) as week_start,
      coalesce(p_week_start, date_trunc('week', now())) + interval '7 days' as week_end
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
  cross join week_bounds wb
  where l.auth_id is not null
    and l.currency_code = 'seed'
    and l.direction = 'credit'
    and l.amount > 0
    and l.created_at >= wb.week_start
    and l.created_at <  wb.week_end
  group by
    l.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having sum(l.amount) > 0
  order by sum(l.amount) desc, lower(coalesce(pp.user_email, upd.user, upd.created_by)) asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.get_weekly_seed_leaderboard(integer, timestamptz) from public;
grant execute on function public.get_weekly_seed_leaderboard(integer, timestamptz) to authenticated;

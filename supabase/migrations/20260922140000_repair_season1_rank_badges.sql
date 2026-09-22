-- Repair Season 1 rank badges using the same ledger and tie-breaker as the
-- Season 1 seed leaderboard shown in the application.

with season_totals as (
  select
    l.auth_id,
    sum(l.amount)::bigint as seed_total
  from public."RobotPlantWalletLedger" l
  where l.auth_id is not null
    and l.currency_code = 'seed'
    and l.direction = 'credit'
    and l.amount > 0
    and l.created_at >= timestamptz '2026-06-21 00:00:00+00'
    and l.created_at < timestamptz '2026-09-21 00:00:00+00'
  group by l.auth_id
  having sum(l.amount) > 0
), ranked_players as (
  select
    st.auth_id,
    row_number() over (
      order by st.seed_total desc, lower(coalesce(pp.user_email, '')) asc, st.auth_id asc
    )::integer as season_rank
  from season_totals st
  left join public."PublicProfile" pp on pp.auth_id = st.auth_id
)
delete from public.unique_badges ub
where ub.badge_id ~ '^season1_rank_(10|[1-9])$';

with season_totals as (
  select
    l.auth_id,
    sum(l.amount)::bigint as seed_total
  from public."RobotPlantWalletLedger" l
  where l.auth_id is not null
    and l.currency_code = 'seed'
    and l.direction = 'credit'
    and l.amount > 0
    and l.created_at >= timestamptz '2026-06-21 00:00:00+00'
    and l.created_at < timestamptz '2026-09-21 00:00:00+00'
  group by l.auth_id
  having sum(l.amount) > 0
), ranked_players as (
  select
    st.auth_id,
    row_number() over (
      order by st.seed_total desc, lower(coalesce(pp.user_email, '')) asc, st.auth_id asc
    )::integer as season_rank
  from season_totals st
  left join public."PublicProfile" pp on pp.auth_id = st.auth_id
)
insert into public.unique_badges (auth_id, badge_id)
select auth_id, concat('season1_rank_', season_rank)
from ranked_players
where season_rank <= 10
on conflict (auth_id, badge_id) do nothing;

with season_totals as (
  select
    l.auth_id,
    sum(l.amount)::bigint as seed_total
  from public."RobotPlantWalletLedger" l
  where l.auth_id is not null
    and l.currency_code = 'seed'
    and l.direction = 'credit'
    and l.amount > 0
    and l.created_at >= timestamptz '2026-06-21 00:00:00+00'
    and l.created_at < timestamptz '2026-09-21 00:00:00+00'
  group by l.auth_id
  having sum(l.amount) > 0
), ranked_players as (
  select
    st.auth_id,
    row_number() over (
      order by st.seed_total desc, lower(coalesce(pp.user_email, '')) asc, st.auth_id asc
    )::integer as season_rank
  from season_totals st
  left join public."PublicProfile" pp on pp.auth_id = st.auth_id
), selected_badges as (
  select
    pp.auth_id,
    array_agg(
      case
        when old_badge ~ '^season1_rank_(10|[1-9])$' and rp.season_rank <= 10
          then concat('season1_rank_', rp.season_rank)
        else old_badge
      end
      order by badges.ordinality
    )::text[] as badge_ids
  from public."PublicProfile" pp
  cross join lateral unnest(coalesce(pp.selected_badge_ids, '{}'::text[])) with ordinality as badges(old_badge, ordinality)
  left join ranked_players rp on rp.auth_id = pp.auth_id
  group by pp.auth_id
)
update public."PublicProfile" pp
set selected_badge_ids = sb.badge_ids
from selected_badges sb
where sb.auth_id = pp.auth_id;

notify pgrst, 'reload schema';
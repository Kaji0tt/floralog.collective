-- Season 1 = Sommer 2026: 2026-06-21 through 2026-09-20 (UTC).
-- Rank colors: #1 gold, #2 silver, #3 bronze, #4 white, #5-10 gray.
with season_seed_ledger as (
	select
		l.auth_id,
		case when l.direction = 'credit' then l.amount else -l.amount end as amount
	from public."RobotPlantWalletLedger" l
	where l.auth_id is not null
		and l.currency_code = 'seed'
		and l.created_at >= timestamptz '2026-06-21 00:00:00+00'
		and l.created_at < timestamptz '2026-09-21 00:00:00+00'

	union all

	select
		l.auth_id,
		case when l.direction = 'credit' then l.amount else -l.amount end as amount
	from public."UserWalletLedger" l
	where l.auth_id is not null
		and l.currency_code = 'seeds_progress'
		and l.created_at >= timestamptz '2026-06-21 00:00:00+00'
		and l.created_at < timestamptz '2026-09-21 00:00:00+00'
), season_totals as (
	select
		auth_id,
		greatest(0, sum(amount))::bigint as seed_total
	from season_seed_ledger
	group by auth_id
	having greatest(0, sum(amount)) > 0
), ranked_players as (
	select
		auth_id,
		row_number() over (order by seed_total desc, auth_id asc)::integer as season_rank
	from season_totals
)
insert into public.unique_badges (auth_id, badge_id)
select
	auth_id,
	concat('season1_rank_', season_rank)
from ranked_players
where season_rank <= 10
on conflict (auth_id, badge_id) do nothing;

notify pgrst, 'reload schema';

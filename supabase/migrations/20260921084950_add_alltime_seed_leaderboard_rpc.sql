create or replace function public.get_alltime_seed_leaderboard(
	p_limit integer default 500
)
returns table (
	auth_id uuid,
	user_email text,
	display_name text,
	full_name text,
	alltime_seed_total bigint
)
language sql
security definer
set search_path = public
as $$
	with seed_ledger as (
		select
			l.auth_id,
			case when l.direction = 'credit' then l.amount else -l.amount end as amount
		from public."RobotPlantWalletLedger" l
		where l.auth_id is not null
			and l.currency_code = 'seed'

		union all

		select
			l.auth_id,
			case when l.direction = 'credit' then l.amount else -l.amount end as amount
		from public."UserWalletLedger" l
		where l.auth_id is not null
			and l.currency_code = 'seeds_progress'
	), totals as (
		select
			sl.auth_id,
			greatest(0, coalesce(sum(sl.amount), 0))::bigint as alltime_seed_total
		from seed_ledger sl
		group by sl.auth_id
	)
	select
		t.auth_id,
		lower(pp.user_email) as user_email,
		pp.display_name,
		pp.full_name,
		t.alltime_seed_total
	from totals t
	left join public."PublicProfile" pp on pp.auth_id = t.auth_id
	where t.alltime_seed_total > 0
	order by t.alltime_seed_total desc, lower(pp.user_email) asc nulls last, t.auth_id asc
	limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

revoke all on function public.get_alltime_seed_leaderboard(integer) from public;
grant execute on function public.get_alltime_seed_leaderboard(integer) to authenticated;

create or replace function public.get_user_alltime_seed_total(
	p_auth_id uuid default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
	with target as (
		select coalesce(p_auth_id, auth.uid()) as auth_id
	), seed_ledger as (
		select case when l.direction = 'credit' then l.amount else -l.amount end as amount
		from public."RobotPlantWalletLedger" l
		cross join target t
		where t.auth_id is not null
			and l.auth_id = t.auth_id
			and l.currency_code = 'seed'

		union all

		select case when l.direction = 'credit' then l.amount else -l.amount end as amount
		from public."UserWalletLedger" l
		cross join target t
		where t.auth_id is not null
			and l.auth_id = t.auth_id
			and l.currency_code = 'seeds_progress'
	)
	select greatest(0, coalesce(sum(amount), 0))::bigint
	from seed_ledger;
$$;

revoke all on function public.get_user_alltime_seed_total(uuid) from public;
grant execute on function public.get_user_alltime_seed_total(uuid) to authenticated;

notify pgrst, 'reload schema';

create table if not exists public."SeasonSeedReset" (
	season_id text primary key,
	season_title text not null,
	season_start_date date not null unique,
	applied_at timestamptz not null default now(),
	robotplant_rows_reset integer not null default 0,
	userwallet_rows_reset integer not null default 0,
	metadata jsonb not null default '{}'::jsonb
);

alter table public."SeasonSeedReset" enable row level security;

create or replace function public.get_floralog_season_for_date(
	p_date date default current_date
)
returns table (
	season_id text,
	season_title text,
	season_start_date date,
	season_end_date date
)
language sql
stable
set search_path = public
as $$
	with resolved as (
		select
			coalesce(p_date, current_date) as target_date,
			extract(year from coalesce(p_date, current_date))::integer as target_year
	), current_start as (
		select
			case
				when target_date >= make_date(target_year, 12, 21) then make_date(target_year, 12, 21)
				when target_date >= make_date(target_year, 9, 21) then make_date(target_year, 9, 21)
				when target_date >= make_date(target_year, 6, 21) then make_date(target_year, 6, 21)
				when target_date >= make_date(target_year, 3, 21) then make_date(target_year, 3, 21)
				else make_date(target_year - 1, 12, 21)
			end as start_date
		from resolved
	), named as (
		select
			start_date,
			extract(year from start_date)::integer as start_year,
			extract(month from start_date)::integer as start_month
		from current_start
	), next_start as (
		select
			start_date,
			start_year,
			start_month,
			case start_month
				when 3 then make_date(start_year, 6, 21)
				when 6 then make_date(start_year, 9, 21)
				when 9 then make_date(start_year, 12, 21)
				else make_date(start_year + 1, 3, 21)
			end as next_start_date
		from named
	)
	select
		concat(
			case start_month
				when 3 then 'fruehling'
				when 6 then 'sommer'
				when 9 then 'herbst'
				else 'winter'
			end,
			'-',
			start_year::text
		) as season_id,
		case start_month
			when 3 then concat('Frühling Saison ', start_year::text)
			when 6 then concat('Sommer Saison ', start_year::text)
			when 9 then concat('Herbst Saison ', start_year::text)
			else concat('Winter Saison ', start_year::text, '/', right((start_year + 1)::text, 2))
		end as season_title,
		start_date as season_start_date,
		(next_start_date - interval '1 day')::date as season_end_date
	from next_start;
$$;

revoke all on function public.get_floralog_season_for_date(date) from public;
grant execute on function public.get_floralog_season_for_date(date) to service_role;

create or replace function public.award_season_top10_badges(
	p_season_id text,
	p_season_start_date date,
	p_season_end_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
	v_badges_awarded integer := 0;
	v_badge_prefix text := case when p_season_id = 'sommer-2026' then 'season1' else p_season_id end;
begin
	with season_seed_ledger as (
		select
			l.auth_id,
			case when l.direction = 'credit' then l.amount else -l.amount end as amount
		from public."RobotPlantWalletLedger" l
		where l.auth_id is not null
			and l.currency_code = 'seed'
			and l.created_at >= p_season_start_date::timestamptz
			and l.created_at < (p_season_end_date + 1)::timestamptz

		union all

		select
			l.auth_id,
			case when l.direction = 'credit' then l.amount else -l.amount end as amount
		from public."UserWalletLedger" l
		where l.auth_id is not null
			and l.currency_code = 'seeds_progress'
			and l.created_at >= p_season_start_date::timestamptz
			and l.created_at < (p_season_end_date + 1)::timestamptz
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
	), inserted_badges as (
		insert into public.unique_badges (auth_id, badge_id)
		select
			auth_id,
			concat(v_badge_prefix, '_rank_', season_rank)
		from ranked_players
		where season_rank <= 10
		on conflict (auth_id, badge_id) do nothing
		returning id
	)
	select count(*)::integer into v_badges_awarded from inserted_badges;

	return v_badges_awarded;
end;
$$;

revoke all on function public.award_season_top10_badges(text, date, date) from public;
grant execute on function public.award_season_top10_badges(text, date, date) to service_role;

drop function if exists public.apply_due_season_seed_reset(date);

create or replace function public.apply_due_season_seed_reset(
	p_today date default current_date
)
returns table (
	applied boolean,
	season_id text,
	season_title text,
	season_start_date date,
	robotplant_rows_reset integer,
	userwallet_rows_reset integer,
	badges_awarded integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
	v_current record;
	v_previous record;
	v_robotplant_rows integer := 0;
	v_userwallet_rows integer := 0;
	v_badges_awarded integer := 0;
	v_rows integer := 0;
	v_was_applied boolean := false;
begin
	select *
		into v_current
		from public.get_floralog_season_for_date(coalesce(p_today, current_date))
		limit 1;

	select *
		into v_previous
		from public.get_floralog_season_for_date(v_current.season_start_date - 1)
		limit 1;

	select exists(
		select 1
		from public."SeasonSeedReset" ssr
		where ssr.season_id = v_current.season_id
	) into v_was_applied;

	-- The award operation is intentionally idempotent. This also repairs a deployment
	-- where the earlier reset migration already inserted the current season marker.
	v_badges_awarded := public.award_season_top10_badges(
		v_previous.season_id,
		v_previous.season_start_date,
		v_previous.season_end_date
	);

	insert into public."SeasonSeedReset" (season_id, season_title, season_start_date, metadata)
	values (
		v_current.season_id,
		v_current.season_title,
		v_current.season_start_date,
		jsonb_build_object(
			'triggered_for_date', coalesce(p_today, current_date),
			'previous_season_id', v_previous.season_id,
			'badges_awarded', v_badges_awarded
		)
	)
	on conflict (season_id) do nothing;

	if v_was_applied then
		update public."SeasonSeedReset"
		set metadata = metadata || jsonb_build_object('badges_awarded', v_badges_awarded, 'badge_check_at', now())
		where "SeasonSeedReset".season_id = v_current.season_id;

		return query
		select
			false,
			v_current.season_id,
			v_current.season_title,
			v_current.season_start_date,
			0,
			0,
			0;
		return;
	end if;

	if to_regclass('public."RobotPlant"') is not null then
		with season_seed_totals as (
			select
				l.auth_id,
				greatest(0, coalesce(sum(case when l.direction = 'credit' then l.amount else -l.amount end), 0))::integer as season_seed_total
			from public."RobotPlantWalletLedger" l
			where l.currency_code = 'seed'
				and l.created_at >= v_current.season_start_date::timestamptz
			group by l.auth_id
		)
		update public."RobotPlant" rp
		set wallet_balance = coalesce(sst.season_seed_total, 0), updated_at = now()
		from season_seed_totals sst
		where rp.auth_id = sst.auth_id
			and coalesce(rp.wallet_balance, 0) <> coalesce(sst.season_seed_total, 0);

		get diagnostics v_robotplant_rows = row_count;

		update public."RobotPlant" rp
		set wallet_balance = 0, updated_at = now()
		where not exists (
			select 1 from public."RobotPlantWalletLedger" l
			where l.auth_id = rp.auth_id
				and l.currency_code = 'seed'
				and l.created_at >= v_current.season_start_date::timestamptz
		)
			and coalesce(rp.wallet_balance, 0) <> 0;

		get diagnostics v_rows = row_count;
		v_robotplant_rows := v_robotplant_rows + v_rows;
	end if;

	insert into public."UserWallet" (auth_id, seeds_progress)
	select distinct auth_id, 0
	from (
		select rp.auth_id from public."RobotPlant" rp where rp.auth_id is not null
		union all
		select l.auth_id from public."RobotPlantWalletLedger" l
		where l.auth_id is not null and l.currency_code = 'seed'
			and l.created_at >= v_current.season_start_date::timestamptz
	) wallet_auths
	on conflict (auth_id) do nothing;

	with season_seed_totals as (
		select l.auth_id,
			greatest(0, coalesce(sum(case when l.direction = 'credit' then l.amount else -l.amount end), 0))::integer as season_seed_total
		from public."RobotPlantWalletLedger" l
		where l.currency_code = 'seed' and l.created_at >= v_current.season_start_date::timestamptz
		group by l.auth_id
	)
	update public."UserWallet" uw
	set seeds_progress = coalesce(sst.season_seed_total, 0), updated_at = now()
	from season_seed_totals sst
	where uw.auth_id = sst.auth_id
		and coalesce(uw.seeds_progress, 0) <> coalesce(sst.season_seed_total, 0);

	get diagnostics v_userwallet_rows = row_count;

	update public."UserWallet" uw
	set seeds_progress = 0, updated_at = now()
	where not exists (
		select 1 from public."RobotPlantWalletLedger" l
		where l.auth_id = uw.auth_id and l.currency_code = 'seed'
			and l.created_at >= v_current.season_start_date::timestamptz
	)
		and coalesce(uw.seeds_progress, 0) <> 0;

	get diagnostics v_rows = row_count;
	v_userwallet_rows := v_userwallet_rows + v_rows;

	update public."SeasonSeedReset"
	set robotplant_rows_reset = v_robotplant_rows,
		userwallet_rows_reset = v_userwallet_rows,
		metadata = metadata || jsonb_build_object('completed_at', now(), 'badges_awarded', v_badges_awarded)
	where "SeasonSeedReset".season_id = v_current.season_id;

	return query
	select true, v_current.season_id, v_current.season_title, v_current.season_start_date,
		v_robotplant_rows, v_userwallet_rows, v_badges_awarded;
end;
$$;

revoke all on function public.apply_due_season_seed_reset(date) from public;
grant execute on function public.apply_due_season_seed_reset(date) to service_role;

select public.apply_due_season_seed_reset(current_date);

notify pgrst, 'reload schema';

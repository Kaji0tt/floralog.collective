-- Convert each completed season's final seed balance to amber at 1000:1.
-- RobotPlantWalletLedger is the source of truth used by the season reset.
create or replace function public.convert_season_seeds_to_amber(
	p_season_id text,
	p_season_start_date date,
	p_season_end_date date
)
returns table (
	players_converted integer,
	amber_converted bigint
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
	v_players_converted integer := 0;
	v_amber_converted bigint := 0;
	v_new_wallets integer := 0;
begin
	if coalesce(length(trim(p_season_id)), 0) = 0 then
		raise exception 'p_season_id is required';
	end if;

	if p_season_start_date is null or p_season_end_date is null or p_season_end_date < p_season_start_date then
		raise exception 'valid season dates are required';
	end if;

	insert into public."UserWallet" (auth_id)
	select distinct ledger.auth_id
	from public."RobotPlantWalletLedger" ledger
	where ledger.auth_id is not null
		and ledger.currency_code = 'seed'
		and ledger.created_at >= p_season_start_date::timestamptz
		and ledger.created_at < (p_season_end_date + 1)::timestamptz
	on conflict (auth_id) do nothing;

	with season_seed_totals as (
		select
			ledger.auth_id,
			greatest(
				0,
				sum(case when ledger.direction = 'credit' then ledger.amount else -ledger.amount end)
			)::bigint as seed_total
		from public."RobotPlantWalletLedger" ledger
		where ledger.auth_id is not null
			and ledger.currency_code = 'seed'
			and ledger.created_at >= p_season_start_date::timestamptz
			and ledger.created_at < (p_season_end_date + 1)::timestamptz
		group by ledger.auth_id
	), inserted_ledger as (
		insert into public."UserWalletLedger" (
			auth_id,
			currency_code,
			direction,
			amount,
			event_source,
			event_reference,
			metadata
		)
		select
			totals.auth_id,
			'amber',
			'credit',
			(totals.seed_total / 1000)::integer,
			'season_seed_conversion',
			p_season_id,
			jsonb_build_object(
				'season_id', p_season_id,
				'season_start_date', p_season_start_date,
				'season_end_date', p_season_end_date,
				'seed_total', totals.seed_total,
				'conversion_rate', 1000
			)
		from season_seed_totals totals
		where totals.seed_total >= 1000
		on conflict (auth_id, event_source, event_reference, currency_code) do nothing
		returning auth_id, amount
	), updated_wallets as (
		update public."UserWallet" wallet
		set
			amber_balance = wallet.amber_balance + inserted.amount,
			updated_at = now()
		from inserted_ledger inserted
		where wallet.auth_id = inserted.auth_id
		returning inserted.auth_id
	)
	select count(*)::integer
	into v_new_wallets
	from updated_wallets;

	select
		count(*)::integer,
		coalesce(sum(ledger.amount), 0)::bigint
	into v_players_converted, v_amber_converted
	from public."UserWalletLedger" ledger
	where ledger.currency_code = 'amber'
		and ledger.direction = 'credit'
		and ledger.event_source = 'season_seed_conversion'
		and ledger.event_reference = p_season_id;

	return query select v_players_converted, v_amber_converted;
end;
$$;

revoke all on function public.convert_season_seeds_to_amber(text, date, date) from public;
grant execute on function public.convert_season_seeds_to_amber(text, date, date) to service_role;

alter function public.apply_due_season_seed_reset(date)
	rename to apply_due_season_seed_reset_without_amber;

revoke all on function public.apply_due_season_seed_reset_without_amber(date) from public;
revoke all on function public.apply_due_season_seed_reset_without_amber(date) from authenticated;
revoke all on function public.apply_due_season_seed_reset_without_amber(date) from service_role;

create function public.apply_due_season_seed_reset(
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
	v_conversion record;
	v_reset record;
begin
	select *
	into v_current
	from public.get_floralog_season_for_date(coalesce(p_today, current_date))
	limit 1;

	select *
	into v_previous
	from public.get_floralog_season_for_date(v_current.season_start_date - 1)
	limit 1;

	select *
	into v_conversion
	from public.convert_season_seeds_to_amber(
		v_previous.season_id,
		v_previous.season_start_date,
		v_previous.season_end_date
	);

	select *
	into v_reset
	from public.apply_due_season_seed_reset_without_amber(coalesce(p_today, current_date));

	update public."SeasonSeedReset"
	set metadata = metadata || jsonb_build_object(
		'previous_season_id', v_previous.season_id,
		'amber_players_converted', v_conversion.players_converted,
		'amber_converted', v_conversion.amber_converted,
		'amber_conversion_check_at', now()
	)
	where "SeasonSeedReset".season_id = v_current.season_id;

	return query
	select
		v_reset.applied,
		v_reset.season_id,
		v_reset.season_title,
		v_reset.season_start_date,
		v_reset.robotplant_rows_reset,
		v_reset.userwallet_rows_reset,
		v_reset.badges_awarded;
end;
$$;

revoke all on function public.apply_due_season_seed_reset(date) from public;
grant execute on function public.apply_due_season_seed_reset(date) to service_role;

-- Repair Summer 2026 independently of the date on which this migration is applied.
select public.convert_season_seeds_to_amber(
	'sommer-2026',
	date '2026-06-21',
	date '2026-09-20'
);

-- Keep the current and all future season transitions on the automated path.
select public.apply_due_season_seed_reset(current_date);

notify pgrst, 'reload schema';

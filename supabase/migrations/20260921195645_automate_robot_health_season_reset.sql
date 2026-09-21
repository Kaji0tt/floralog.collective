create table if not exists public."SeasonRobotHealthReset" (
	season_id text primary key,
	season_start_date date not null unique,
	health_value integer not null default 35 check (health_value between 0 and 100),
	rows_reset integer not null default 0,
	reset_at timestamptz not null default now()
);

alter table public."SeasonRobotHealthReset" enable row level security;

create or replace function public.apply_due_robot_health_reset(
	p_today date default current_date
)
returns table (
	applied boolean,
	season_id text,
	season_start_date date,
	rows_reset integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
	v_season record;
	v_rows integer := 0;
	v_already_applied boolean := false;
begin
	select *
		into v_season
		from public.get_floralog_season_for_date(coalesce(p_today, current_date))
		limit 1;

	select exists(
		select 1
		from public."SeasonRobotHealthReset" r
		where r.season_id = v_season.season_id
	) into v_already_applied;

	if v_already_applied then
		return query
		select false, v_season.season_id, v_season.season_start_date, 0;
		return;
	end if;

	update public."RobotPlant"
	set
		energy = 35,
		data_quality = 35,
		care = 35,
		updated_at = now();

	get diagnostics v_rows = row_count;

	insert into public."SeasonRobotHealthReset" (
		season_id,
		season_start_date,
		health_value,
		rows_reset
	)
	values (
		v_season.season_id,
		v_season.season_start_date,
		35,
		v_rows
	)
	on conflict (season_id) do nothing;

	return query
	select true, v_season.season_id, v_season.season_start_date, v_rows;
end;
$$;

revoke all on function public.apply_due_robot_health_reset(date) from public;
grant execute on function public.apply_due_robot_health_reset(date) to service_role;

select public.apply_due_robot_health_reset(current_date);

notify pgrst, 'reload schema';

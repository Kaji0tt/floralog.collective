-- Start area collection from zero for the current season.
delete from public."AreaClaim";

update public."RobotPlant"
set claimed_areas_count = 0,
    updated_at = now()
where claimed_areas_count <> 0;

update public."SeasonSeedReset"
set metadata = metadata || jsonb_build_object(
    'area_claims_reset_at', now(),
    'area_claims_reset', true
)
where season_id = (
	select season_id
	from public.get_floralog_season_for_date(current_date)
	limit 1
);

-- Keep the automated season reset idempotent while resetting area collection
-- exactly once when a new season is first applied.
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
	v_reset record;
	v_area_claims_deleted integer := 0;
	v_robotplant_area_rows integer := 0;
begin
	select *
	into v_reset
	from public.apply_due_season_seed_reset_without_amber(coalesce(p_today, current_date));

	if v_reset.applied then
		delete from public."AreaClaim";
		get diagnostics v_area_claims_deleted = row_count;

		update public."RobotPlant"
		set claimed_areas_count = 0,
			updated_at = now()
		where claimed_areas_count <> 0;
		get diagnostics v_robotplant_area_rows = row_count;

		update public."SeasonSeedReset"
		set metadata = metadata || jsonb_build_object(
			'area_claims_reset_at', now(),
			'area_claims_deleted', v_area_claims_deleted,
			'robotplant_area_rows_reset', v_robotplant_area_rows
		)
		where "SeasonSeedReset".season_id = v_reset.season_id;
	end if;

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

select public.apply_due_season_seed_reset(current_date);

notify pgrst, 'reload schema';

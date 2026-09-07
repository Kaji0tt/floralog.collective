create table public."RobotPlantZoneScan" (
	discovery_id text primary key references public."UserPlantDiscovery"(id) on delete cascade,
	auth_id uuid not null references auth.users(id) on delete cascade,
	zone_id uuid not null references public."RobotPlantZone"(id) on delete cascade,
	day_key date not null,
	created_at timestamptz not null default now()
);

create index idx_robotplant_zonescan_auth_day
	on public."RobotPlantZoneScan"(auth_id, day_key desc);

alter table public."RobotPlantZoneScan" enable row level security;

create or replace function public.record_robotplant_zone_scan(
	p_auth_id uuid,
	p_zone_id uuid,
	p_discovery_id text,
	p_day_key date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	current_scan_count integer;
begin
	if not exists (
		select 1
		from public."UserPlantDiscovery"
		where id = p_discovery_id
			and auth_id = p_auth_id
	) then
		raise exception 'Discovery does not belong to the supplied user';
	end if;

	if not exists (
		select 1
		from public."RobotPlantZone"
		where id = p_zone_id
			and is_active = true
			and day_generated = p_day_key
			and zone_key like ('%:' || replace(p_auth_id::text, '-', ''))
	) then
		raise exception 'Zone is not active for the supplied user and day';
	end if;

	with recorded_scan as (
		insert into public."RobotPlantZoneScan" (discovery_id, auth_id, zone_id, day_key)
		values (p_discovery_id, p_auth_id, p_zone_id, p_day_key)
		on conflict (discovery_id) do nothing
		returning 1
	), incremented_state as (
		insert into public."RobotPlantUserZoneState" (auth_id, zone_id, day_key, scans_in_zone, last_scan_at)
		select p_auth_id, p_zone_id, p_day_key, 1, now()
		from recorded_scan
		on conflict (auth_id, zone_id, day_key) do update
			set scans_in_zone = public."RobotPlantUserZoneState".scans_in_zone + 1,
					last_scan_at = excluded.last_scan_at
		returning scans_in_zone
	)
	select scans_in_zone into current_scan_count
	from incremented_state;

	if current_scan_count is null then
		select scans_in_zone into current_scan_count
		from public."RobotPlantUserZoneState"
		where auth_id = p_auth_id
			and zone_id = p_zone_id
			and day_key = p_day_key;
	end if;

	return coalesce(current_scan_count, 0);
end;
$$;

revoke all on function public.record_robotplant_zone_scan(uuid, uuid, text, date) from public;
grant execute on function public.record_robotplant_zone_scan(uuid, uuid, text, date) to service_role;

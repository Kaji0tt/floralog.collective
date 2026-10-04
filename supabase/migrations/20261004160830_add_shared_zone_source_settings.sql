alter table public."ZoneSharedInvite"
	add column if not exists required_scan_count integer not null default 5
		check (required_scan_count between 3 and 5),
	add column if not exists zone_bonus_multiplier double precision not null default 1.5
		check (zone_bonus_multiplier between 1 and 2.5);

alter table public."ZoneSharedInvite"
	alter column expires_at set default (now() + interval '30 days');

update public."ZoneSharedInvite"
set expires_at = now() + interval '30 days'
where status = 'pending' and expires_at <= now();

update public."ZoneSharedInvite" invite
set required_scan_count = coalesce(zone.required_scan_count, 5),
		zone_bonus_multiplier = coalesce(zone.zone_bonus_multiplier, 1.5)
from public."RobotPlantZone" zone
where zone.id = invite.source_zone_id;

create or replace function public.set_zone_shared_invite_source_settings()
returns trigger
language plpgsql
set search_path = public
as $$
declare
	v_zone public."RobotPlantZone";
begin
	select * into v_zone
	from public."RobotPlantZone"
	where id = new.source_zone_id;

	if not found then
		raise exception 'zone_not_found';
	end if;

	new.required_scan_count := coalesce(v_zone.required_scan_count, 5);
	new.zone_bonus_multiplier := coalesce(v_zone.zone_bonus_multiplier, 1.5);
	return new;
end;
$$;

revoke all on function public.set_zone_shared_invite_source_settings() from public;

drop trigger if exists zone_shared_invite_copy_source_settings on public."ZoneSharedInvite";
create trigger zone_shared_invite_copy_source_settings
	before insert on public."ZoneSharedInvite"
	for each row execute function public.set_zone_shared_invite_source_settings();

create or replace function public.record_zone_shared_invite_scan(
	p_invite_id uuid,
	p_discovery_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_invite public."ZoneSharedInvite";
	v_discovery public."UserPlantDiscovery";
	v_inserted boolean := false;
	v_sender_count integer;
	v_recipient_count integer;
begin
	if auth.uid() is null then raise exception 'not_authenticated'; end if;

	select * into v_invite
	from public."ZoneSharedInvite"
	where id = p_invite_id
	for update;
	if not found then raise exception 'invite_not_found'; end if;
	if v_invite.status <> 'accepted' then raise exception 'invite_not_accepted'; end if;
	if v_invite.challenge_expires_at is null or v_invite.challenge_expires_at <= now() then raise exception 'invite_expired'; end if;
	if auth.uid() not in (v_invite.sender_auth_id, v_invite.recipient_auth_id) then raise exception 'not_invite_participant'; end if;

	select * into v_discovery
	from public."UserPlantDiscovery"
	where id = p_discovery_id and auth_id = auth.uid();
	if not found then raise exception 'discovery_not_owned'; end if;

	if not exists (
		select 1 from public."ZoneSharedInviteScan" s
		where s.invite_id = v_invite.id and s.discovery_id = p_discovery_id
	) then
		insert into public."ZoneSharedInviteScan" (invite_id, auth_id, discovery_id)
		values (v_invite.id, auth.uid(), p_discovery_id);
		v_inserted := true;

		update public."ZoneSharedInvite"
		set zone_bonus_multiplier = greatest(1, zone_bonus_multiplier - 0.1)
		where id = v_invite.id
		returning * into v_invite;
	end if;

	select count(*) filter (where auth_id = v_invite.sender_auth_id),
			 count(*) filter (where auth_id = v_invite.recipient_auth_id)
	into v_sender_count, v_recipient_count
	from public."ZoneSharedInviteScan"
	where invite_id = v_invite.id;

	if v_sender_count >= v_invite.required_scan_count
		and v_recipient_count >= v_invite.required_scan_count
		and v_invite.status = 'accepted' then
		update public."ZoneSharedInvite"
		set status = 'completed', completed_at = coalesce(completed_at, now())
		where id = v_invite.id
		returning * into v_invite;

		update public."RobotPlantZone"
		set is_active = false
		where id = v_invite.source_zone_id;
	end if;

	return jsonb_build_object(
		'invite_id', v_invite.id,
		'sender_scan_count', v_sender_count,
		'recipient_scan_count', v_recipient_count,
		'required_scan_count', v_invite.required_scan_count,
		'zone_bonus_multiplier', v_invite.zone_bonus_multiplier,
		'completed', v_invite.status = 'completed',
		'inserted', v_inserted
	);
end;
$$;

revoke all on function public.record_zone_shared_invite_scan(uuid, text) from public;
grant execute on function public.record_zone_shared_invite_scan(uuid, text) to authenticated;

create or replace function public.respond_to_zone_shared_invite(
	p_invite_id uuid,
	p_response text
)
returns public."ZoneSharedInvite"
language plpgsql
security definer
set search_path = public
as $$
declare
	v_invite public."ZoneSharedInvite";
	v_status text := lower(trim(coalesce(p_response, '')));
begin
	if auth.uid() is null then raise exception 'not_authenticated'; end if;
	if v_status not in ('accepted', 'declined') then raise exception 'invalid_response'; end if;

	select * into v_invite
	from public."ZoneSharedInvite"
	where id = p_invite_id
		and recipient_auth_id = auth.uid()
	for update;

	if not found then raise exception 'invite_not_found'; end if;
	if v_invite.status <> 'pending' then raise exception 'invite_not_pending'; end if;
	if v_invite.expires_at <= now() then
		update public."ZoneSharedInvite"
		set status = 'expired'
		where id = v_invite.id
		returning * into v_invite;
		raise exception 'invite_expired';
	end if;

	update public."ZoneSharedInvite"
	set status = v_status,
		accepted_at = case when v_status = 'accepted' then now() else null end,
		challenge_expires_at = case when v_status = 'accepted' then now() + interval '30 minutes' else null end
	where id = v_invite.id
	returning * into v_invite;

	return v_invite;
end;
$$;

revoke all on function public.respond_to_zone_shared_invite(uuid, text) from public;
grant execute on function public.respond_to_zone_shared_invite(uuid, text) to authenticated;

notify pgrst, 'reload schema';

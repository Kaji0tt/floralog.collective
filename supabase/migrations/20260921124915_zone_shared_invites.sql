create table if not exists public."ZoneSharedInvite" (
	id uuid primary key default gen_random_uuid(),
	sender_auth_id uuid not null references auth.users(id) on delete cascade,
	recipient_auth_id uuid not null references auth.users(id) on delete cascade,
	source_zone_id uuid not null references public."RobotPlantZone"(id) on delete cascade,
	zone_theme text not null,
	zone_title text not null,
	center_lat double precision not null,
	center_lng double precision not null,
	radius_m integer not null check (radius_m > 0),
	status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'completed')),
	expires_at timestamptz not null default (now() + interval '5 minutes'),
	challenge_expires_at timestamptz,
	accepted_at timestamptz,
	completed_at timestamptz,
	created_at timestamptz not null default now(),
	constraint zone_shared_invite_different_users check (sender_auth_id <> recipient_auth_id)
);

create unique index if not exists zone_shared_invite_one_pending_per_pair
	on public."ZoneSharedInvite" (sender_auth_id, recipient_auth_id, source_zone_id)
	where status = 'pending';

create index if not exists zone_shared_invite_recipient_status_idx
	on public."ZoneSharedInvite" (recipient_auth_id, status, expires_at);

create table if not exists public."ZoneSharedInviteScan" (
	id uuid primary key default gen_random_uuid(),
	invite_id uuid not null references public."ZoneSharedInvite"(id) on delete cascade,
	auth_id uuid not null references auth.users(id) on delete cascade,
	discovery_id text not null references public."UserPlantDiscovery"(id) on delete cascade,
	created_at timestamptz not null default now(),
	unique (invite_id, discovery_id)
);

create index if not exists zone_shared_invite_scan_progress_idx
	on public."ZoneSharedInviteScan" (invite_id, auth_id, created_at);

alter table public."ZoneSharedInvite" enable row level security;
alter table public."ZoneSharedInviteScan" enable row level security;

drop policy if exists zone_shared_invite_select_participant on public."ZoneSharedInvite";
create policy zone_shared_invite_select_participant
	on public."ZoneSharedInvite" for select to authenticated
	using ((select auth.uid()) in (sender_auth_id, recipient_auth_id));

drop policy if exists zone_shared_invite_scan_select_participant on public."ZoneSharedInviteScan";
create policy zone_shared_invite_scan_select_participant
	on public."ZoneSharedInviteScan" for select to authenticated
	using (
		exists (
			select 1
			from public."ZoneSharedInvite" i
			where i.id = invite_id
				and (select auth.uid()) in (i.sender_auth_id, i.recipient_auth_id)
		)
	);

create or replace function public.create_zone_shared_invite(
	p_recipient_auth_id uuid,
	p_source_zone_id uuid
)
returns public."ZoneSharedInvite"
language plpgsql
security definer
set search_path = public
as $$
declare
	v_sender_auth_id uuid := auth.uid();
	v_zone public."RobotPlantZone";
	v_invite public."ZoneSharedInvite";
begin
	if v_sender_auth_id is null then
		raise exception 'not_authenticated';
	end if;
	if p_recipient_auth_id is null or p_recipient_auth_id = v_sender_auth_id then
		raise exception 'invalid_recipient';
	end if;

	if not exists (
		select 1 from public."Friend" f
		where lower(coalesce(f.status, '')) = 'accepted'
			and (
				(f.request_sent_by_auth_id = v_sender_auth_id and f.request_sent_to_auth_id = p_recipient_auth_id)
				or (f.request_sent_by_auth_id = p_recipient_auth_id and f.request_sent_to_auth_id = v_sender_auth_id)
			)
	) then
		raise exception 'recipient_not_friend';
	end if;

	select * into v_zone
	from public."RobotPlantZone"
	where id = p_source_zone_id
		and is_active = true
		and zone_key like ('%:' || replace(v_sender_auth_id::text, '-', ''))
	for update;

	if not found then
		raise exception 'zone_not_owned_or_inactive';
	end if;

	update public."ZoneSharedInvite"
	set status = 'expired'
	where sender_auth_id = v_sender_auth_id
		and recipient_auth_id = p_recipient_auth_id
		and source_zone_id = p_source_zone_id
		and status = 'pending'
		and expires_at <= now();

	insert into public."ZoneSharedInvite" (
		sender_auth_id, recipient_auth_id, source_zone_id, zone_theme, zone_title,
		center_lat, center_lng, radius_m
	) values (
		v_sender_auth_id, p_recipient_auth_id, v_zone.id, v_zone.theme, v_zone.title,
		v_zone.center_lat, v_zone.center_lng, v_zone.radius_m
	)
	returning * into v_invite;

	return v_invite;
exception
	when unique_violation then
		select * into v_invite
		from public."ZoneSharedInvite"
		where sender_auth_id = v_sender_auth_id
			and recipient_auth_id = p_recipient_auth_id
			and source_zone_id = p_source_zone_id
			and status = 'pending'
		order by created_at desc
		limit 1;
		return v_invite;
end;
$$;

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
		update public."ZoneSharedInvite" set status = 'expired' where id = v_invite.id returning * into v_invite;
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

	select * into v_invite from public."ZoneSharedInvite" where id = p_invite_id for update;
	if not found then raise exception 'invite_not_found'; end if;
	if v_invite.status <> 'accepted' then raise exception 'invite_not_accepted'; end if;
	if v_invite.challenge_expires_at is null or v_invite.challenge_expires_at <= now() then raise exception 'invite_expired'; end if;
	if auth.uid() not in (v_invite.sender_auth_id, v_invite.recipient_auth_id) then raise exception 'not_invite_participant'; end if;

	select * into v_discovery
	from public."UserPlantDiscovery"
	where id = p_discovery_id and auth_id = auth.uid();
	if not found then raise exception 'discovery_not_owned'; end if;

	if exists (
		select 1 from public."ZoneSharedInviteScan" s
		where s.invite_id = v_invite.id and s.discovery_id = p_discovery_id
	) then
		null;
	else
		insert into public."ZoneSharedInviteScan" (invite_id, auth_id, discovery_id)
		values (v_invite.id, auth.uid(), p_discovery_id);
		v_inserted := true;
	end if;

	select count(*) filter (where auth_id = v_invite.sender_auth_id),
				 count(*) filter (where auth_id = v_invite.recipient_auth_id)
		into v_sender_count, v_recipient_count
	from public."ZoneSharedInviteScan"
	where invite_id = v_invite.id;

	if v_sender_count >= 5 and v_recipient_count >= 5 and v_invite.status = 'accepted' then
		update public."ZoneSharedInvite"
		set status = 'completed', completed_at = coalesce(completed_at, now())
		where id = v_invite.id
		returning * into v_invite;
	end if;

	return jsonb_build_object(
		'invite_id', v_invite.id,
		'sender_scan_count', v_sender_count,
		'recipient_scan_count', v_recipient_count,
		'completed', v_invite.status = 'completed',
		'inserted', v_inserted
	);
end;
$$;

revoke all on function public.create_zone_shared_invite(uuid, uuid) from public;
revoke all on function public.respond_to_zone_shared_invite(uuid, text) from public;
revoke all on function public.record_zone_shared_invite_scan(uuid, text) from public;
grant execute on function public.create_zone_shared_invite(uuid, uuid) to authenticated;
grant execute on function public.respond_to_zone_shared_invite(uuid, text) to authenticated;
grant execute on function public.record_zone_shared_invite_scan(uuid, text) to authenticated;

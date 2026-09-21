-- Community quests: a server-wide shared goal (e.g. "scan 400 Kastanien across all users").
-- Unlike regular/weekly/monthly quests, the reward is only unlocked once the GLOBAL
-- target (CommunityQuest.required_discoveries) is reached, not just individual progress.
-- Anyone can participate; a "participation" row (UserCommunityQuest) is created
-- automatically the first time one of a user's scans counts toward the goal.
--
-- Anti-grind rule: a scan only counts toward the global goal if it is more than
-- radius_m meters away from every earlier COUNTED scan of the same plant by the
-- same user for this quest. This prevents someone from scanning the same physical
-- plant over and over to inflate progress.

create table if not exists public."CommunityQuest" (
	id text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
	quest_number integer,
	title text not null,
	description text,
	requirement text,
	reward_name text,
	seed_reward integer not null default 400,
	xp_reward integer,
	icon_emoji text default '🌍',
	category text,
	target_genus_name text,
	target_species_name text,
	required_discoveries integer not null check (required_discoveries > 0),
	radius_m integer not null default 50 check (radius_m > 0),
	current_progress integer not null default 0,
	completed boolean not null default false,
	completed_at timestamptz,
	start_date timestamptz,
	end_date timestamptz,
	is_active boolean not null default true,
	created_date timestamptz default now(),
	updated_date timestamptz default now(),
	created_by text,
	created_by_id text
);

comment on table public."CommunityQuest" is
	'Server-wide community quests. Reward is only unlockable once current_progress reaches required_discoveries.';

create table if not exists public."UserCommunityQuest" (
	id text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
	community_quest_id text not null references public."CommunityQuest"(id) on delete cascade,
	auth_id uuid not null,
	created_by text,
	contributed_count integer not null default 0,
	status text not null default 'active' check (status in ('active', 'redeemed')),
	joined_at timestamptz not null default now(),
	redeemed_at timestamptz,
	created_date timestamptz default now(),
	updated_date timestamptz default now(),
	unique (community_quest_id, auth_id)
);

create index if not exists usercommunityquest_auth_idx on public."UserCommunityQuest" (auth_id);

create table if not exists public."CommunityQuestContribution" (
	id text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
	community_quest_id text not null references public."CommunityQuest"(id) on delete cascade,
	auth_id uuid not null,
	discovery_id text not null references public."UserPlantDiscovery"(id) on delete cascade,
	plant_id text,
	latitude double precision,
	longitude double precision,
	discovered_date timestamptz,
	created_at timestamptz not null default now(),
	unique (discovery_id, community_quest_id)
);

create index if not exists communityquestcontribution_dedup_idx
	on public."CommunityQuestContribution" (community_quest_id, auth_id, plant_id);

alter table public."CommunityQuest" enable row level security;
alter table public."UserCommunityQuest" enable row level security;
alter table public."CommunityQuestContribution" enable row level security;

drop policy if exists community_quest_select_all on public."CommunityQuest";
create policy community_quest_select_all
	on public."CommunityQuest" for select to authenticated
	using (true);

drop policy if exists user_community_quest_select_own on public."UserCommunityQuest";
create policy user_community_quest_select_own
	on public."UserCommunityQuest" for select to authenticated
	using ((select auth.uid()) = auth_id);

drop policy if exists community_quest_contribution_select_own on public."CommunityQuestContribution";
create policy community_quest_contribution_select_own
	on public."CommunityQuestContribution" for select to authenticated
	using ((select auth.uid()) = auth_id);

-- security definer: writes to CommunityQuest/UserCommunityQuest/CommunityQuestContribution
-- happen only through this trigger, never directly from client REST calls.
create or replace function public.sync_community_quest_on_discovery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	discovery_coords record;
	quest_row public."CommunityQuest"%rowtype;
	target_matches boolean;
	nearest_distance_m double precision;
	inserted_contribution boolean;
begin
	if new.auth_id is null or new.plant_id is null or new.discovered_date is null then
		return new;
	end if;

	select
		(coordinates)[1]::double precision as latitude,
		(coordinates)[2]::double precision as longitude
	into discovery_coords
	from regexp_match(new.discovery_location, '(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)') as coordinates;

	if discovery_coords.latitude is null or discovery_coords.longitude is null
		or discovery_coords.latitude < -90 or discovery_coords.latitude > 90
		or discovery_coords.longitude < -180 or discovery_coords.longitude > 180
	then
		return new;
	end if;

	for quest_row in
		select * from public."CommunityQuest"
		where is_active
			and not completed
			and (start_date is null or new.discovered_date >= start_date)
			and (end_date is null or new.discovered_date <= end_date)
	loop
		select case
			when coalesce(nullif(quest_row.target_species_name, ''), '') <> '' then
				plant.species_name = quest_row.target_species_name
			when coalesce(nullif(quest_row.target_genus_name, ''), '') <> '' then
				exists (
					select 1
					from public."PlantGenus" genus
					where genus.category = plant.genus_category
						and genus.category_dex_number = plant.genus_number
						and genus.genus_name = quest_row.target_genus_name
				)
			when coalesce(nullif(quest_row.category, ''), 'Alle') <> 'Alle' then
				plant.genus_category = quest_row.category
			else true
		end
		into target_matches
		from public."Plant" plant
		where plant.id = new.plant_id;

		if not coalesce(target_matches, false) then
			continue;
		end if;

		-- Dedup: skip if this user already has a counted scan of the same plant
		-- within radius_m meters of this new discovery for this quest.
		select min(
			6371000 * 2 * asin(sqrt(
				power(sin(radians(contribution.latitude - discovery_coords.latitude) / 2), 2) +
				cos(radians(discovery_coords.latitude)) * cos(radians(contribution.latitude)) *
				power(sin(radians(contribution.longitude - discovery_coords.longitude) / 2), 2)
			))
		)
		into nearest_distance_m
		from public."CommunityQuestContribution" contribution
		where contribution.community_quest_id = quest_row.id
			and contribution.auth_id = new.auth_id
			and contribution.plant_id = new.plant_id;

		if nearest_distance_m is not null and nearest_distance_m < quest_row.radius_m then
			continue;
		end if;

		insert into public."CommunityQuestContribution" (
			community_quest_id, auth_id, discovery_id, plant_id,
			latitude, longitude, discovered_date
		)
		values (
			quest_row.id, new.auth_id, new.id, new.plant_id,
			discovery_coords.latitude, discovery_coords.longitude, new.discovered_date
		)
		on conflict (discovery_id, community_quest_id) do nothing;

		inserted_contribution := found;
		if not inserted_contribution then
			continue;
		end if;

		insert into public."UserCommunityQuest" (community_quest_id, auth_id, created_by, contributed_count)
		values (quest_row.id, new.auth_id, new.created_by, 1)
		on conflict (community_quest_id, auth_id)
		do update set
			contributed_count = public."UserCommunityQuest".contributed_count + 1,
			updated_date = now();

		update public."CommunityQuest"
		set
			current_progress = current_progress + 1,
			completed = (current_progress + 1) >= required_discoveries,
			completed_at = case when (current_progress + 1) >= required_discoveries then now() else completed_at end,
			updated_date = now()
		where id = quest_row.id;
	end loop;

	return new;
end;
$$;

drop trigger if exists sync_community_quest_on_discovery on public."UserPlantDiscovery";
create trigger sync_community_quest_on_discovery
after insert on public."UserPlantDiscovery"
for each row execute function public.sync_community_quest_on_discovery();

-- Claim the reward for a completed community quest. Only succeeds once the
-- community quest's global target has actually been reached.
create or replace function public.claim_community_quest_reward(p_user_community_quest_id text)
returns public."UserCommunityQuest"
language plpgsql
security definer
set search_path = public
as $$
declare
	v_auth_id uuid := auth.uid();
	v_row public."UserCommunityQuest"%rowtype;
	v_quest public."CommunityQuest"%rowtype;
begin
	if v_auth_id is null then
		raise exception 'Not authenticated';
	end if;

	select * into v_row
	from public."UserCommunityQuest"
	where id = p_user_community_quest_id
		and auth_id = v_auth_id
	for update;

	if not found then
		raise exception 'Community-Quest-Teilnahme nicht gefunden';
	end if;

	if v_row.status = 'redeemed' then
		raise exception 'Belohnung wurde bereits eingelöst';
	end if;

	select * into v_quest from public."CommunityQuest" where id = v_row.community_quest_id;

	if v_quest.id is null or not v_quest.completed then
		raise exception 'Community-Quest-Ziel wurde noch nicht erreicht';
	end if;

	update public."UserCommunityQuest"
	set status = 'redeemed', redeemed_at = now(), updated_date = now()
	where id = v_row.id
	returning * into v_row;

	return v_row;
end;
$$;

grant execute on function public.claim_community_quest_reward(text) to authenticated;

notify pgrst, 'reload schema';

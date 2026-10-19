-- Community Events: turns CommunityQuest rows flagged with is_event into
-- time-boxed, highlighted events with automatic server-side reward grants.
--
-- Changes:
--   * CommunityQuest: event metadata (slug, reward tiers, success/failure Funken,
--     push bookkeeping, outcome/finalized_at).
--   * UserCommunityQuest: what was granted at finalization.
--   * sync_community_quest_on_discovery: keeps counting until end_date even after
--     the global target was reached (personal reward tiers stay reachable), and the
--     anti-grind rule now applies to ANY earlier counted scan of the same user for
--     the quest (not only the same plant_id) within radius_m.
--   * finalize_community_quest: idempotent reward distribution (service role only).
--   * get_community_quest_scans: public list of all counted scans of a quest.
--   * Rewards.exclusive_source: protects event-only rewards from being re-listed in
--     the shop by syncLogoAssets.
--   * Seeds the "Kastanien-Kartierung" event (19.10.–25.10.2026, Europe/Berlin).

alter table public."CommunityQuest"
	add column if not exists slug text,
	add column if not exists is_event boolean not null default false,
	add column if not exists reward_tiers jsonb not null default '[]'::jsonb,
	add column if not exists success_sparks integer not null default 0 check (success_sparks >= 0),
	add column if not exists failure_sparks integer not null default 0 check (failure_sparks >= 0),
	add column if not exists outcome text check (outcome in ('succeeded', 'failed')),
	add column if not exists finalized_at timestamptz,
	add column if not exists start_notified_at timestamptz,
	add column if not exists progress_notified_count integer not null default 0,
	add column if not exists goal_notified_at timestamptz,
	add column if not exists end_notified_at timestamptz;

create unique index if not exists communityquest_slug_key on public."CommunityQuest" (slug) where slug is not null;

comment on column public."CommunityQuest".reward_tiers is
	'Cumulative personal tiers granted on success, e.g. [{"min_contributions":5,"reward_id":"..."}].';

alter table public."UserCommunityQuest"
	add column if not exists granted_sparks integer not null default 0,
	add column if not exists granted_reward_ids text[] not null default '{}',
	add column if not exists outcome text check (outcome in ('succeeded', 'failed'));

create index if not exists communityquestcontribution_quest_user_idx
	on public."CommunityQuestContribution" (community_quest_id, auth_id);

create index if not exists communityquestcontribution_quest_date_idx
	on public."CommunityQuestContribution" (community_quest_id, discovered_date desc);

alter table public."Rewards"
	add column if not exists exclusive_source text;

comment on column public."Rewards".exclusive_source is
	'If set, the reward is only obtainable through this source and must stay shop_hidden (respected by syncLogoAssets).';

-- Counting trigger -----------------------------------------------------------
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

	-- Counting continues after the global target is reached (completed = true) so
	-- personal reward tiers stay reachable until the event window closes.
	for quest_row in
		select * from public."CommunityQuest"
		where is_active
			and finalized_at is null
			and (start_date is null or new.discovered_date >= start_date)
			and (end_date is null or new.discovered_date <= end_date)
			and (completed = false or is_event)
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

		-- Anti-grind: a user's scan only counts if it is at least radius_m away from
		-- every earlier counted scan of that same user for this quest (any target plant).
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
			and contribution.auth_id = new.auth_id;

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

		if not found then
			continue;
		end if;

		insert into public."UserCommunityQuest" (community_quest_id, auth_id, created_by, contributed_count)
		values (quest_row.id, new.auth_id, new.created_by, 1)
		on conflict (community_quest_id, auth_id)
		do update set
			contributed_count = public."UserCommunityQuest".contributed_count + 1,
			updated_date = now();

		update public."CommunityQuest" cq
		set
			current_progress = cq.current_progress + 1,
			completed = cq.completed or (cq.current_progress + 1) >= cq.required_discoveries,
			completed_at = case
				when cq.completed_at is null and (cq.current_progress + 1) >= cq.required_discoveries then now()
				else cq.completed_at
			end,
			updated_date = now()
		where cq.id = quest_row.id;
	end loop;

	return new;
end;
$$;

-- Events are granted automatically by finalize_community_quest; manual claiming is
-- only kept for legacy (non-event) community quests.
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

	if v_quest.is_event then
		raise exception 'Community-Event-Belohnungen werden automatisch nach Event-Ende vergeben';
	end if;

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

-- Finalization ---------------------------------------------------------------
create or replace function public.finalize_community_quest(
	p_quest_id text,
	p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_quest public."CommunityQuest"%rowtype;
	v_outcome text;
	v_participant public."UserCommunityQuest"%rowtype;
	v_profile record;
	v_tier jsonb;
	v_reward record;
	v_sparks integer;
	v_granted_ids text[];
	v_granted_names text[];
	v_participants integer := 0;
	v_title text;
	v_message text;
	v_target_label text;
begin
	select * into v_quest from public."CommunityQuest" where id = p_quest_id for update;

	if not found then
		raise exception 'Community quest % not found', p_quest_id;
	end if;

	if v_quest.finalized_at is not null then
		return jsonb_build_object('already_finalized', true, 'outcome', v_quest.outcome);
	end if;

	if not p_force and v_quest.end_date is not null and now() < v_quest.end_date then
		raise exception 'Community quest % has not ended yet', p_quest_id;
	end if;

	v_outcome := case when v_quest.completed then 'succeeded' else 'failed' end;
	v_target_label := coalesce(nullif(trim(v_quest.target_species_name), ''), nullif(trim(v_quest.target_genus_name), ''), 'Zielpflanze');
	if v_target_label ~ 'e$' then
		v_target_label := v_target_label || 'n';
	end if;

	for v_participant in
		select * from public."UserCommunityQuest"
		where community_quest_id = v_quest.id
			and contributed_count > 0
			and outcome is null
		for update
	loop
		v_participants := v_participants + 1;
		v_granted_ids := '{}';
		v_granted_names := '{}';
		v_sparks := case when v_outcome = 'succeeded' then v_quest.success_sparks else v_quest.failure_sparks end;

		select pp.user_email, coalesce(nullif(trim(pp.display_name), ''), nullif(trim(pp.full_name), '')) as user_name
		into v_profile
		from public."PublicProfile" pp
		where pp.auth_id = v_participant.auth_id
		limit 1;

		if v_sparks > 0 then
			perform public.wallet_grant_currency(
				v_participant.auth_id,
				'sparks',
				'community_event_reward',
				'community_quest:' || v_quest.id,
				v_sparks,
				'credit',
				jsonb_build_object(
					'community_quest_id', v_quest.id,
					'community_quest_title', v_quest.title,
					'outcome', v_outcome,
					'contributed_count', v_participant.contributed_count
				)
			);
		end if;

		if v_outcome = 'succeeded' then
			for v_tier in select value from jsonb_array_elements(coalesce(v_quest.reward_tiers, '[]'::jsonb))
			loop
				if v_participant.contributed_count < coalesce((v_tier->>'min_contributions')::integer, 2147483647) then
					continue;
				end if;

				select r.id, coalesce(r.display_name, r.name, r.value, r.id) as display_name
				into v_reward
				from public."Rewards" r
				where r.id = v_tier->>'reward_id';

				if v_reward.id is null then
					continue;
				end if;

				if not exists (
					select 1 from public."UserRewards" ur
					where ur.auth_id = v_participant.auth_id and ur.reward_id = v_reward.id
				) then
					insert into public."UserRewards" (
						auth_id, reward_id, reward_name, user_email, user_name,
						unlocked_date, created_date, updated_date
					)
					values (
						v_participant.auth_id, v_reward.id, v_reward.display_name,
						v_profile.user_email, v_profile.user_name,
						now(), now(), now()
					);
				end if;

				v_granted_ids := array_append(v_granted_ids, v_reward.id);
				v_granted_names := array_append(v_granted_names, v_reward.display_name);
			end loop;
		end if;

		update public."UserCommunityQuest"
		set
			status = 'redeemed',
			redeemed_at = now(),
			outcome = v_outcome,
			granted_sparks = v_sparks,
			granted_reward_ids = v_granted_ids,
			updated_date = now()
		where id = v_participant.id;

		if v_outcome = 'succeeded' then
			v_title := '🌰 ' || v_quest.title || ' geschafft!';
			v_message := 'Gemeinsam habt ihr ' || v_quest.current_progress || ' ' || v_target_label || ' kartiert. Dein Beitrag: '
				|| v_participant.contributed_count || '. Belohnung: +' || v_sparks || ' Funken'
				|| case when array_length(v_granted_names, 1) > 0
					then ' und ' || array_to_string(v_granted_names, ', ')
					else '' end
				|| '.';
		else
			v_title := '🌰 ' || v_quest.title || ' beendet';
			v_message := 'Das Community-Ziel wurde knapp verfehlt (' || v_quest.current_progress || '/'
				|| v_quest.required_discoveries || '). Danke für deine ' || v_participant.contributed_count
				|| ' Scans – als Dankeschön gibt es +' || v_sparks || ' Funken.';
		end if;

		insert into public."UserNotification" (
			id, auth_id, user_email, notification_type, related_quest_id, seen,
			title, message, description, action_url, priority, display_location,
			created_date, updated_date
		)
		values (
			encode(extensions.gen_random_bytes(12), 'hex'),
			v_participant.auth_id,
			v_profile.user_email,
			'community_event_result',
			v_quest.id,
			false,
			v_title,
			v_message,
			jsonb_build_object(
				'community_quest_id', v_quest.id,
				'outcome', v_outcome,
				'contributed_count', v_participant.contributed_count,
				'community_progress', v_quest.current_progress,
				'community_target', v_quest.required_discoveries,
				'sparks', v_sparks,
				'reward_ids', to_jsonb(v_granted_ids)
			)::text,
			'Achievements',
			'high',
			'home',
			now(),
			now()
		);
	end loop;

	update public."CommunityQuest"
	set finalized_at = now(), outcome = v_outcome, updated_date = now()
	where id = v_quest.id;

	return jsonb_build_object(
		'already_finalized', false,
		'outcome', v_outcome,
		'participants', v_participants,
		'progress', v_quest.current_progress,
		'target', v_quest.required_discoveries
	);
end;
$$;

revoke all on function public.finalize_community_quest(text, boolean) from public, anon, authenticated;
grant execute on function public.finalize_community_quest(text, boolean) to service_role;

-- Public scan list -----------------------------------------------------------
create or replace function public.get_community_quest_scans(
	p_quest_id text,
	p_limit integer default 100,
	p_offset integer default 0
)
returns table (
	contribution_id text,
	discovery_id text,
	auth_id uuid,
	actor_name text,
	actor_email text,
	plant_id text,
	plant_species_name text,
	plant_scientific_name text,
	genus_category text,
	genus_number integer,
	image_url text,
	discovered_date timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
	select
		c.id as contribution_id,
		c.discovery_id,
		c.auth_id,
		coalesce(nullif(trim(pp.display_name), ''), nullif(trim(pp.full_name), ''), 'Unbekannt') as actor_name,
		pp.user_email as actor_email,
		c.plant_id,
		p.species_name as plant_species_name,
		p.scientific_name as plant_scientific_name,
		p.genus_category,
		p.genus_number,
		d.image_url,
		c.discovered_date
	from public."CommunityQuestContribution" c
	join public."CommunityQuest" q on q.id = c.community_quest_id
	left join public."PublicProfile" pp on pp.auth_id = c.auth_id
	left join public."UserPlantDiscovery" d on d.id = c.discovery_id
	left join public."Plant" p on p.id = c.plant_id
	where c.community_quest_id = p_quest_id
		and q.is_event
	order by c.discovered_date desc nulls last, c.created_at desc
	limit greatest(1, least(coalesce(p_limit, 100), 500))
	offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.get_community_quest_scans(text, integer, integer) from public;
grant execute on function public.get_community_quest_scans(text, integer, integer) to authenticated;

-- Event rewards (faces already exist via syncLogoAssets) ----------------------
update public."Rewards"
set
	shop_hidden = true,
	exclusive_source = 'community_event:kastanien-kartierung-2026',
	custom_description = coalesce(custom_description, 'Exklusiv aus dem Community Event „Die Kastanien-Kartierung“.')
where id in (
	'reward_logo_accessory_face_Mojo',
	'reward_logo_accessory_face_Twodee',
	'reward_logo_accessory_face_Skyjo'
);

-- Seed: Die Kastanien-Kartierung ---------------------------------------------
-- Mo 19.10.2026 00:00 – So 25.10.2026 23:59:59 Europe/Berlin (DST ends on 25.10.).
insert into public."CommunityQuest" (
	slug, is_event, title, description, requirement, reward_name,
	seed_reward, icon_emoji, category, target_genus_name,
	required_discoveries, radius_m, start_date, end_date, is_active,
	reward_tiers, success_sparks, failure_sparks
)
values (
	'kastanien-kartierung-2026',
	true,
	'Die Kastanien-Kartierung',
	'Unsere Florabot-Sensoren haben etwas entdeckt: Überall auf eurem Planeten fallen gerade Kastanien von den Bäumen! '
		|| 'Helft uns, gemeinsam 150 Kastanienbäume zu kartieren, damit wir verstehen, wie sie sich über die Erde verteilen.',
	'Scanne Kastanien (Rosskastanie oder Edelkastanie). Pro Spieler zählt nur ein Kastanien-Scan im Umkreis von 50 m.',
	null,
	0,
	'🌰',
	'Bäume',
	'Kastanie',
	150,
	50,
	('2026-10-19 00:00:00'::timestamp at time zone 'Europe/Berlin'),
	('2026-10-25 23:59:59'::timestamp at time zone 'Europe/Berlin'),
	true,
	jsonb_build_array(
		jsonb_build_object('min_contributions', 5, 'reward_id', 'reward_logo_accessory_face_Mojo'),
		jsonb_build_object('min_contributions', 15, 'reward_id', 'reward_logo_accessory_face_Twodee'),
		jsonb_build_object('min_contributions', 25, 'reward_id', 'reward_logo_accessory_face_Skyjo')
	),
	25,
	5
)
on conflict (slug) where slug is not null do nothing;

notify pgrst, 'reload schema';

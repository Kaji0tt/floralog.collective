-- Community Event #2: "Die Kürbis-Jagd" (31.10.–06.11.2026, Europe/Berlin).
--
-- Changes:
--   * CommunityQuest.theme: visual theme of an event surface (null = chestnut default).
--   * reward_tiers entries may set "requires_success": false – such tiers are granted
--     at finalization regardless of the event outcome (default stays success-only).
--   * finalize_community_quest: honours requires_success, uses the event's icon_emoji
--     and pluralizes "…is" targets (Kürbis → Kürbisse).
--   * Marks the event faces as exclusive (shop_hidden) and seeds the event.
--   * Same anti-grind rule as before (radius_m = 50 m per player).

alter table public."CommunityQuest"
	add column if not exists theme text;

comment on column public."CommunityQuest".theme is
	'Visual theme key for event surfaces (e.g. "chestnut", "pumpkin"). Null = default theme.';

comment on column public."CommunityQuest".reward_tiers is
	'Cumulative personal tiers, e.g. [{"min_contributions":5,"reward_id":"..."}]. Granted on success only unless the tier sets "requires_success": false.';

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
	v_icon text;
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
	v_icon := coalesce(nullif(trim(v_quest.icon_emoji), ''), '🌰');
	v_target_label := coalesce(nullif(trim(v_quest.target_species_name), ''), nullif(trim(v_quest.target_genus_name), ''), 'Zielpflanze');
	if v_target_label ~ 'e$' then
		v_target_label := v_target_label || 'n';
	elsif v_target_label ~ 'is$' then
		v_target_label := v_target_label || 'se';
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

		for v_tier in select value from jsonb_array_elements(coalesce(v_quest.reward_tiers, '[]'::jsonb))
		loop
			if v_outcome <> 'succeeded' and coalesce((v_tier->>'requires_success')::boolean, true) then
				continue;
			end if;

			if v_participant.contributed_count < coalesce((v_tier->>'min_contributions')::integer, 2147483647) then
				continue;
			end if;

			select r.id, coalesce(r.display_name, r.name, r.value, r.id) as display_name
			into v_reward
			from public."Rewards" r
			-- Asset ids may differ in case from the tier config (face_Pumpkinbot vs face_pumpkinbot).
			where lower(r.id) = lower(v_tier->>'reward_id')
			order by (r.id = v_tier->>'reward_id') desc
			limit 1;

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
			v_title := v_icon || ' ' || v_quest.title || ' geschafft!';
			v_message := 'Gemeinsam habt ihr ' || v_quest.current_progress || ' ' || v_target_label || ' kartiert. Dein Beitrag: '
				|| v_participant.contributed_count || '. Belohnung: +' || v_sparks || ' Funken'
				|| case when array_length(v_granted_names, 1) > 0
					then ' und ' || array_to_string(v_granted_names, ', ')
					else '' end
				|| '.';
		else
			v_title := v_icon || ' ' || v_quest.title || ' beendet';
			v_message := 'Das Community-Ziel wurde knapp verfehlt (' || v_quest.current_progress || '/'
				|| v_quest.required_discoveries || '). Danke für deine ' || v_participant.contributed_count
				|| ' Scans – als Dankeschön gibt es +' || v_sparks || ' Funken'
				|| case when array_length(v_granted_names, 1) > 0
					then ' und ' || array_to_string(v_granted_names, ', ')
					else '' end
				|| '.';
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
				'reward_ids', to_jsonb(v_granted_ids),
				'theme', v_quest.theme,
				'icon_emoji', v_icon,
				'target_label', v_target_label
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

-- The finished chestnut event keeps its theme explicitly.
update public."CommunityQuest"
set theme = 'chestnut'
where slug = 'kastanien-kartierung-2026' and theme is null;

-- Event rewards (faces come from syncLogoAssets; syncLogoAssets also re-applies the
-- exclusive flag for every event tier reward synced later) --------------------
update public."Rewards"
set
	shop_hidden = true,
	exclusive_source = 'community_event:kuerbis-jagd-2026',
	custom_description = coalesce(custom_description, 'Exklusiv aus dem Community Event „Die Kürbis-Jagd“.')
where lower(id) in (
	'reward_logo_accessory_face_pumpkinbot',
	'reward_logo_accessory_face_spoonbot',
	'reward_logo_accessory_face_bonnybot'
);

-- Seed: Die Kürbis-Jagd ------------------------------------------------------
-- Sa 31.10.2026 00:00 – Fr 06.11.2026 23:59:59 Europe/Berlin (7 Tage).
insert into public."CommunityQuest" (
	slug, is_event, theme, title, description, requirement, reward_name,
	seed_reward, icon_emoji, category, target_genus_name,
	required_discoveries, radius_m, start_date, end_date, is_active,
	reward_tiers, success_sparks, failure_sparks
)
values (
	'kuerbis-jagd-2026',
	true,
	'pumpkin',
	'Die Kürbis-Jagd',
	'Unsere Florabot-Sensoren schlagen Alarm: Überall auf eurem Planeten leuchten plötzlich orangefarbene Riesenbeeren! '
		|| 'Helft uns, gemeinsam 25 Kürbisse aufzuspüren, damit wir dieses Phänomen verstehen.',
	'Scanne Kürbisse. Pro Spieler zählt nur ein Kürbis-Scan im Umkreis von 50 m.',
	null,
	0,
	'🎃',
	'Blumen',
	'Kürbis',
	25,
	50,
	('2026-10-31 00:00:00'::timestamp at time zone 'Europe/Berlin'),
	('2026-11-06 23:59:59'::timestamp at time zone 'Europe/Berlin'),
	true,
	jsonb_build_array(
		jsonb_build_object('min_contributions', 1, 'reward_id', 'reward_logo_accessory_face_pumpkinbot', 'requires_success', false),
		jsonb_build_object('min_contributions', 1, 'reward_id', 'reward_logo_accessory_face_spoonbot'),
		jsonb_build_object('min_contributions', 3, 'reward_id', 'reward_logo_accessory_face_bonnybot')
	),
	25,
	5
)
on conflict (slug) where slug is not null do nothing;

notify pgrst, 'reload schema';

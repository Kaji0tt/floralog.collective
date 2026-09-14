alter table public."PublicProfile"
	drop column if exists favorite_plant_id;

alter table if exists public."User"
	drop column if exists favorite_plant_id;

alter table if exists public."baseUser"
	drop column if exists favorite_plant_id;

create index if not exists idx_userplantdiscovery_auth_discovered
	on public."UserPlantDiscovery" (auth_id, discovered_date desc);

create index if not exists idx_userplantdiscovery_auth_plant
	on public."UserPlantDiscovery" (auth_id, plant_id);

create index if not exists idx_robotplantledger_reference_auth
	on public."RobotPlantWalletLedger" (event_reference, auth_id);

create or replace function public.get_public_player_profile(p_auth_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
	with target_profile as (
		select pp.*
		from public."PublicProfile" pp
		where pp.auth_id = p_auth_id
		limit 1
	),
	discovery_base as (
		select
			upd.id,
			upd.plant_id,
			upd.discovered_date,
			upd.image_url,
			p.species_name,
			p.genus_category,
			p.genus_number
		from public."UserPlantDiscovery" upd
		left join public."Plant" p on p.id = upd.plant_id
		where upd.auth_id = p_auth_id
	),
	top_plant as (
		select
			db.plant_id,
			max(db.species_name) as species_name,
			count(*)::bigint as scan_count,
			max(db.discovered_date) as latest_scan_at
		from discovery_base db
		where db.plant_id is not null
		group by db.plant_id
		order by count(*) desc, max(db.discovered_date) desc nulls last, db.plant_id
		limit 1
	),
	top_genus as (
		select
			pg.id as genus_id,
			pg.genus_name,
			count(*)::bigint as scan_count,
			max(db.discovered_date) as latest_scan_at
		from discovery_base db
		join public."PlantGenus" pg
			on pg.category = db.genus_category
		 and pg.category_dex_number = db.genus_number
		group by pg.id, pg.genus_name
		order by count(*) desc, max(db.discovered_date) desc nulls last, pg.id
		limit 1
	),
	species_count as (
		select count(distinct db.plant_id)::bigint as value
		from discovery_base db
		where db.plant_id is not null
	),
	latest_scan as (
		select db.*
		from discovery_base db
		order by db.discovered_date desc nulls last, db.id desc
		limit 1
	),
	latest_scan_reward as (
		select coalesce(sum(l.amount), 0)::bigint as seeds
		from latest_scan ls
		left join public."RobotPlantWalletLedger" l
			on l.auth_id = p_auth_id
		 and l.event_reference = ls.id
		 and l.currency_code = 'seed'
		 and l.direction = 'credit'
		 and l.event_source in ('scan', 'new_scan', 'new_global_scan', 'new_season_scan', 'season_rediscovery')
	)
	select jsonb_build_object(
		'auth_id', tp.auth_id,
		'display_name', tp.display_name,
		'full_name', tp.full_name,
		'title', tp.title,
		'selected_title', tp.selected_title,
		'bot_name', tp.bot_name,
		'background_image_url', tp.background_image_url,
		'background_color', tp.background_color,
		'selected_face_asset', tp.selected_face_asset,
		'selected_plant_asset', tp.selected_plant_asset,
		'selected_border_asset', tp.selected_border_asset,
		'selected_border_color', tp.selected_border_color,
		'selected_profile_effect', tp.selected_profile_effect,
		'selected_logo_effect', tp.selected_logo_effect,
		'selected_badge_ids', coalesce(tp.selected_badge_ids, '{}'::text[]),
		'scan_highlights', jsonb_build_object(
			'top_plant', case when top_plant.plant_id is null then null else jsonb_build_object(
				'plant_id', top_plant.plant_id,
				'name', coalesce(top_plant.species_name, 'Unbekannte Pflanze'),
				'scan_count', top_plant.scan_count
			) end,
			'top_genus', case when top_genus.genus_id is null then null else jsonb_build_object(
				'genus_id', top_genus.genus_id,
				'name', coalesce(top_genus.genus_name, 'Unbekannte Gattung'),
				'scan_count', top_genus.scan_count
			) end,
			'discovered_species_count', coalesce(species_count.value, 0),
			'latest_scan', case when latest_scan.id is null then null else jsonb_build_object(
				'discovery_id', latest_scan.id,
				'plant_id', latest_scan.plant_id,
				'plant_name', coalesce(latest_scan.species_name, 'Unbekannte Pflanze'),
				'image_url', latest_scan.image_url,
				'discovered_at', latest_scan.discovered_date,
				'seeds', coalesce(latest_scan_reward.seeds, 0)
			) end
		)
	)
	from target_profile tp
	left join top_plant on true
	left join top_genus on true
	left join species_count on true
	left join latest_scan on true
	left join latest_scan_reward on true;
$$;

revoke all on function public.get_public_player_profile(uuid) from public;
grant execute on function public.get_public_player_profile(uuid) to anon, authenticated;

revoke select on table public."PublicProfile" from anon;

create or replace function public.get_friendship_status(p_target_auth_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
	select f.status
	from public."PublicProfile" viewer
	join public."PublicProfile" target on target.auth_id = p_target_auth_id
	join public."Friend" f
		on (
			lower(f.request_sent_by) = lower(viewer.user_email)
			and lower(f.request_sent_to) = lower(target.user_email)
		) or (
			lower(f.request_sent_to) = lower(viewer.user_email)
			and lower(f.request_sent_by) = lower(target.user_email)
		)
	where viewer.auth_id = auth.uid()
	order by f.updated_date desc nulls last, f.created_date desc nulls last
	limit 1;
$$;

revoke all on function public.get_friendship_status(uuid) from public;
grant execute on function public.get_friendship_status(uuid) to authenticated;

drop function if exists public.get_user_friends_public(uuid);

create function public.get_user_friends_public(p_user_auth_id uuid)
returns table (
	auth_id uuid,
	display_name text,
	full_name text,
	selected_title text,
	title text,
	bot_name text,
	selected_face_asset text,
	selected_plant_asset text,
	selected_border_asset text,
	selected_border_color text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
	with target as (
		select pp.auth_id, pp.user_email
		from public."PublicProfile" pp
		where pp.auth_id = p_user_auth_id
	),
	viewer as (
		select pp.auth_id, pp.user_email
		from public."PublicProfile" pp
		where pp.auth_id = auth.uid()
	),
	permitted as (
		select true as allowed
		from target t
		left join viewer v on true
		where auth.uid() = t.auth_id
			 or exists (
				 select 1
				 from public."Friend" f
				 where lower(coalesce(f.status, '')) = 'accepted'
					 and (
						 (lower(f.request_sent_by) = lower(t.user_email) and lower(f.request_sent_to) = lower(v.user_email))
						 or
						 (lower(f.request_sent_to) = lower(t.user_email) and lower(f.request_sent_by) = lower(v.user_email))
					 )
			 )
	),
	related_emails as (
		select case
			when lower(f.request_sent_by) = lower(t.user_email) then f.request_sent_to
			else f.request_sent_by
		end as other_email
		from public."Friend" f
		join target t on true
		join permitted p on p.allowed
		where lower(coalesce(f.status, '')) = 'accepted'
			and (
				lower(f.request_sent_by) = lower(t.user_email)
				or lower(f.request_sent_to) = lower(t.user_email)
			)
	)
	select
		pp.auth_id,
		pp.display_name,
		pp.full_name,
		pp.selected_title,
		pp.title,
		pp.bot_name,
		pp.selected_face_asset,
		pp.selected_plant_asset,
		pp.selected_border_asset,
		pp.selected_border_color
	from related_emails re
	join public."PublicProfile" pp on lower(pp.user_email) = lower(re.other_email)
	where pp.auth_id is not null;
$$;

revoke all on function public.get_user_friends_public(uuid) from public;
grant execute on function public.get_user_friends_public(uuid) to authenticated;

notify pgrst, 'reload schema';

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
      upd.discovery_location,
      p.species_name,
      p.genus_category,
      p.genus_number
    from public."UserPlantDiscovery" upd
    left join public."Plant" p on p.id = upd.plant_id
    where upd.auth_id = p_auth_id
  ),
  location_points as (
    select
      db.id,
      db.discovered_date,
      (coordinates)[1]::double precision as latitude,
      (coordinates)[2]::double precision as longitude
    from discovery_base db
    cross join lateral regexp_match(
      db.discovery_location,
      '(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)'
    ) as coordinates
  ),
  ordered_location_points as (
    select
      lp.*,
      lag(lp.latitude) over (order by lp.discovered_date, lp.id) as previous_latitude,
      lag(lp.longitude) over (order by lp.discovered_date, lp.id) as previous_longitude
    from location_points lp
    where lp.latitude between -90 and 90
      and lp.longitude between -180 and 180
  ),
  scan_metrics as (
    select count(*)::bigint as total_scans
    from discovery_base
  ),
  distance_metrics as (
    select
      coalesce(sum(
        case
          when olp.previous_latitude is null or olp.previous_longitude is null then 0
          else 6371000 * 2 * atan2(
            sqrt(
              power(sin(radians(olp.latitude - olp.previous_latitude) / 2), 2) +
              cos(radians(olp.previous_latitude)) * cos(radians(olp.latitude)) *
              power(sin(radians(olp.longitude - olp.previous_longitude) / 2), 2)
            ),
            sqrt(greatest(0, 1 - (
              power(sin(radians(olp.latitude - olp.previous_latitude) / 2), 2) +
              cos(radians(olp.previous_latitude)) * cos(radians(olp.latitude)) *
              power(sin(radians(olp.longitude - olp.previous_longitude) / 2), 2)
            )))
          )
        end
      ), 0)::double precision / 1000 as total_distance_between_scans_km
    from ordered_location_points olp
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
    'badge_metrics', jsonb_build_object(
      'total_scans', coalesce(sm.total_scans, 0),
      'total_distance_between_scans_km', coalesce(dm.total_distance_between_scans_km, 0)
    ),
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
  cross join scan_metrics sm
  cross join distance_metrics dm
  left join top_plant on true
  left join top_genus on true
  left join species_count on true
  left join latest_scan on true
  left join latest_scan_reward on true;
$$;

revoke all on function public.get_public_player_profile(uuid) from public;
grant execute on function public.get_public_player_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
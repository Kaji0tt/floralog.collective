-- Expose the complete profile badge metric set to compact public profile cards.

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
      p.genus_number,
      p.rarity
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
    select coalesce(sum(
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
  like_metrics as (
    select count(sl.id)::bigint as received_likes_count
    from public."ScanLike" sl
    join discovery_base db on db.id = sl.discovery_id
  ),
  robot_metrics as (
    select
      coalesce(rp.energy, 0)::numeric as energy,
      coalesce(rp.data_quality, 0)::numeric as data_quality,
      coalesce(rp.care, 0)::numeric as care,
      coalesce(rp.streak_days, 0)::bigint as daily_streak_days,
      coalesce(rp.claimed_areas_count, 0)::bigint as claimed_areas
    from public."RobotPlant" rp
    where rp.auth_id = p_auth_id
    limit 1
  ),
  alltime_seed_total as (
    select greatest(0, coalesce(sum(amount), 0))::bigint as total
    from (
      select case when l.direction = 'credit' then l.amount else -l.amount end as amount
      from public."RobotPlantWalletLedger" l
      where l.auth_id = p_auth_id and l.currency_code = 'seed'
      union all
      select case when l.direction = 'credit' then l.amount else -l.amount end as amount
      from public."UserWalletLedger" l
      where l.auth_id = p_auth_id and l.currency_code = 'seeds_progress'
    ) ledger
  ),
  season_bounds as (
    select case
      when current_date >= make_date(extract(year from current_date)::integer, 12, 21)
        then make_date(extract(year from current_date)::integer, 12, 21)
      when current_date >= make_date(extract(year from current_date)::integer, 9, 21)
        then make_date(extract(year from current_date)::integer, 9, 21)
      when current_date >= make_date(extract(year from current_date)::integer, 6, 21)
        then make_date(extract(year from current_date)::integer, 6, 21)
      when current_date >= make_date(extract(year from current_date)::integer, 3, 21)
        then make_date(extract(year from current_date)::integer, 3, 21)
      else make_date(extract(year from current_date)::integer - 1, 12, 21)
    end as season_start
  ),
  season_seed_totals as (
    select l.auth_id, sum(l.amount)::bigint as seed_total
    from public."RobotPlantWalletLedger" l
    cross join season_bounds sb
    where l.auth_id is not null
      and l.currency_code = 'seed'
      and l.direction = 'credit'
      and l.amount > 0
      and l.created_at >= sb.season_start::timestamptz
    group by l.auth_id
    having sum(l.amount) > 0
  ),
  season_ranks as (
    select
      sst.auth_id,
      sst.seed_total,
      row_number() over (
        order by sst.seed_total desc, lower(coalesce(pp.user_email, '')) asc, sst.auth_id asc
      )::bigint as season_rank
    from season_seed_totals sst
    left join public."PublicProfile" pp on pp.auth_id = sst.auth_id
  ),
  highest_scan_metric as (
    select coalesce(max(l.amount), 0)::bigint as highest_scan_result
    from public."RobotPlantWalletLedger" l
    where l.auth_id = p_auth_id
      and l.currency_code = 'seed'
      and l.direction = 'credit'
      and l.event_source in ('scan', 'new_scan', 'new_global_scan', 'new_season_scan', 'season_rediscovery')
  ),
  rarest_plant_metric as (
    select coalesce(max(case
      when lower(coalesce(db.rarity, '')) ~ 'ausgestorben|verschollen' then 6
      when lower(coalesce(db.rarity, '')) ~ 'extrem[[:space:]]*selten' then 5
      when lower(coalesce(db.rarity, '')) ~ 'sehr[[:space:]]*selten' then 4
      when lower(coalesce(db.rarity, '')) ~ '[[:<:]]selten[[:>:]]' then 3
      when lower(coalesce(db.rarity, '')) ~ 'gelegentlich|ungew' then 2
      when lower(coalesce(db.rarity, '')) ~ 'häufig|haufig|common' then 1
      else 0
    end), 0)::bigint as rarest_plant_score
    from discovery_base db
  ),
  quest_metrics as (
    select
      (select count(*)::bigint from public."UserWeeklyQuest" q
       where q.auth_id = p_auth_id and (q.status in ('completed', 'redeemed') or q.completed is true)) as weekly_quests_completed,
      (select count(*)::bigint from public."UserMonthlyQuest" q
       where q.auth_id = p_auth_id and (q.status in ('completed', 'redeemed') or q.completed is true)) as monthly_quests_completed
  ),
  accessory_metrics as (
    select count(*)::bigint as zone_unlocked_plant_accessories
    from public."UserRewards" ur
    join public."Rewards" r on r.id = ur.reward_id
    where ur.auth_id = p_auth_id
      and lower(coalesce(r.type, '')) in ('logo_accessory', 'accessory')
      and nullif(trim(coalesce(r.requires_zone_theme, '')), '') is not null
  ),
  top_plant as (
    select db.plant_id, max(db.species_name) as species_name, count(*)::bigint as scan_count
    from discovery_base db
    where db.plant_id is not null
    group by db.plant_id
    order by count(*) desc, max(db.discovered_date) desc nulls last, db.plant_id
    limit 1
  ),
  top_genus as (
    select pg.id as genus_id, pg.genus_name, count(*)::bigint as scan_count
    from discovery_base db
    join public."PlantGenus" pg on pg.category = db.genus_category and pg.category_dex_number = db.genus_number
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
      'total_distance_between_scans_km', coalesce(dm.total_distance_between_scans_km, 0),
      'global_seed_rank', coalesce(sr.season_rank, 0),
      'received_likes_count', coalesce(lm.received_likes_count, 0),
      'total_seeds', coalesce(ast.total, 0),
      'claimed_areas', coalesce(rm.claimed_areas, 0),
      'highest_scan_result', coalesce(hsm.highest_scan_result, 0),
      'highest_plant_status', case
        when coalesce(rm.energy, 0) <= 0 or coalesce(rm.data_quality, 0) <= 0 or coalesce(rm.care, 0) <= 0 then 0
        else round(3 / (1 / rm.energy + 1 / rm.data_quality + 1 / rm.care))
      end,
      'rarest_plant_score', coalesce(rpm.rarest_plant_score, 0),
      'weekly_quests_completed', coalesce(qm.weekly_quests_completed, 0),
      'monthly_quests_completed', coalesce(qm.monthly_quests_completed, 0),
      'daily_streak_days', coalesce(rm.daily_streak_days, 0),
      'member_since_days', greatest(0, floor(extract(epoch from (now() - coalesce(tp.created_date, now()))) / 86400))::bigint,
      'zone_unlocked_plant_accessories', coalesce(am.zone_unlocked_plant_accessories, 0),
      'season_seeds', coalesce(sr.seed_total, 0),
      'alltime_seeds', coalesce(ast.total, 0)
    ),
    'scan_highlights', jsonb_build_object(
      'top_plant', case when top_plant.plant_id is null then null else jsonb_build_object('plant_id', top_plant.plant_id, 'name', coalesce(top_plant.species_name, 'Unbekannte Pflanze'), 'scan_count', top_plant.scan_count) end,
      'top_genus', case when top_genus.genus_id is null then null else jsonb_build_object('genus_id', top_genus.genus_id, 'name', coalesce(top_genus.genus_name, 'Unbekannte Gattung'), 'scan_count', top_genus.scan_count) end,
      'discovered_species_count', coalesce(species_count.value, 0),
      'latest_scan', case when latest_scan.id is null then null else jsonb_build_object('discovery_id', latest_scan.id, 'plant_id', latest_scan.plant_id, 'plant_name', coalesce(latest_scan.species_name, 'Unbekannte Pflanze'), 'image_url', latest_scan.image_url, 'discovered_at', latest_scan.discovered_date, 'seeds', coalesce(latest_scan_reward.seeds, 0)) end
    )
  )
  from target_profile tp
  cross join scan_metrics sm
  cross join distance_metrics dm
  cross join like_metrics lm
  left join robot_metrics rm on true
  cross join alltime_seed_total ast
  left join season_ranks sr on sr.auth_id = p_auth_id
  cross join highest_scan_metric hsm
  cross join rarest_plant_metric rpm
  cross join quest_metrics qm
  cross join accessory_metrics am
  left join top_plant on true
  left join top_genus on true
  left join species_count on true
  left join latest_scan on true
  left join latest_scan_reward on true;
$$;

revoke all on function public.get_public_player_profile(uuid) from public;
grant execute on function public.get_public_player_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
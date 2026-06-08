-- Extend highest scan leaderboard with scan detail fields
-- and add global taxonomy highlights RPC for achievements stats.

drop function if exists public.get_highest_scan_results_leaderboard(integer);

create or replace function public.get_highest_scan_results_leaderboard(
  p_limit integer default 50
)
returns table (
  auth_id uuid,
  user_email text,
  display_name text,
  full_name text,
  reward_amount integer,
  event_source text,
  event_reference text,
  awarded_at timestamptz,
  plant_species_name text,
  plant_rarity text,
  scan_status text,
  zone_multiplier numeric,
  rarity_multiplier numeric,
  novelty_multiplier numeric,
  care_multiplier numeric,
  streak_multiplier numeric,
  first_scan_of_day_multiplier numeric,
  tile_claim_multiplier numeric,
  pre_tile_claim_reward integer
)
language sql
security definer
set search_path = public
as $$
  with scan_rewards as (
    select
      l.auth_id,
      lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
      pp.display_name,
      pp.full_name,
      l.amount::integer as reward_amount,
      l.event_source,
      l.event_reference,
      l.created_at as awarded_at,
      plant.species_name as plant_species_name,
      plant.rarity as plant_rarity,
      case
        when l.event_source = 'new_global_scan' then 'new_global'
        when l.event_source = 'new_scan' then 'new_personal'
        when l.event_source = 'scan' then 'repeat'
        else 'unknown'
      end as scan_status,
      nullif(l.metadata -> 'reward_breakdown' ->> 'zoneMultiplier', '')::numeric as zone_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'rarityMultiplier', '')::numeric as rarity_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'noveltyMultiplier', '')::numeric as novelty_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'careMultiplier', '')::numeric as care_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'streakMultiplier', '')::numeric as streak_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'firstScanOfDayMultiplier', '')::numeric as first_scan_of_day_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'tileClaimMultiplier', '')::numeric as tile_claim_multiplier,
      nullif(l.metadata -> 'reward_breakdown' ->> 'preTileClaimReward', '')::integer as pre_tile_claim_reward,
      row_number() over (
        partition by l.auth_id
        order by l.amount desc, l.created_at desc
      ) as rn
    from public."RobotPlantWalletLedger" l
    left join public."PublicProfile" pp
      on pp.auth_id = l.auth_id
    left join public."UserPlantDiscovery" upd
      on upd.id::text = l.event_reference
    left join public."Plant" plant
      on plant.id = upd.plant_id
    where l.auth_id is not null
      and l.currency_code = 'seed'
      and l.direction = 'credit'
      and l.amount > 0
      and l.event_source in ('scan', 'new_scan', 'new_global_scan')
  )
  select
    auth_id,
    user_email,
    display_name,
    full_name,
    reward_amount,
    event_source,
    event_reference,
    awarded_at,
    plant_species_name,
    plant_rarity,
    scan_status,
    zone_multiplier,
    rarity_multiplier,
    novelty_multiplier,
    care_multiplier,
    streak_multiplier,
    first_scan_of_day_multiplier,
    tile_claim_multiplier,
    pre_tile_claim_reward
  from scan_rewards
  where rn = 1
  order by reward_amount desc, awarded_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.get_highest_scan_results_leaderboard(integer) from public;
grant execute on function public.get_highest_scan_results_leaderboard(integer) to authenticated;

create or replace function public.get_global_scan_taxonomy_highlights()
returns table (
  top_species_name text,
  top_species_count bigint,
  top_genus_name text,
  top_genus_count bigint
)
language sql
security definer
set search_path = public
as $$
  with species_counts as (
    select
      plant.species_name,
      count(*)::bigint as scan_count
    from public."UserPlantDiscovery" upd
    join public."Plant" plant
      on plant.id = upd.plant_id
    where plant.species_name is not null
      and plant.species_name <> ''
    group by plant.species_name
  ),
  genus_counts as (
    select
      genus.genus_name,
      count(*)::bigint as scan_count
    from public."UserPlantDiscovery" upd
    join public."Plant" plant
      on plant.id = upd.plant_id
    join public."PlantGenus" genus
      on genus.category = plant.genus_category
     and genus.category_dex_number = plant.genus_number
    where genus.genus_name is not null
      and genus.genus_name <> ''
    group by genus.genus_name
  )
  select
    (select species_name from species_counts order by scan_count desc, species_name asc limit 1) as top_species_name,
    (select scan_count from species_counts order by scan_count desc, species_name asc limit 1) as top_species_count,
    (select genus_name from genus_counts order by scan_count desc, genus_name asc limit 1) as top_genus_name,
    (select scan_count from genus_counts order by scan_count desc, genus_name asc limit 1) as top_genus_count;
$$;

revoke all on function public.get_global_scan_taxonomy_highlights() from public;
grant execute on function public.get_global_scan_taxonomy_highlights() to authenticated;

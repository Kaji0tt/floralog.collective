-- Aggregated, non-personal game content for the AI reach agent (social posts).
-- Only master data (plant names, fun facts, quests) and suppressed aggregates leave the database.

create table if not exists public."AiContentSnapshotRequest" (
	id uuid primary key default gen_random_uuid(),
	request_bucket timestamptz not null unique,
	requested_at timestamptz not null default now()
);

alter table public."AiContentSnapshotRequest" enable row level security;
revoke all on table public."AiContentSnapshotRequest" from anon, authenticated;
grant select, insert on table public."AiContentSnapshotRequest" to service_role;

create or replace function public.ai_get_content_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
	with boundaries as (
		select
			now() as generated_at,
			now() at time zone 'Europe/Berlin' as local_now,
			now() - interval '7 days' as since_7d,
			now() - interval '14 days' as since_14d
	), recent_scans as (
		select discovery.auth_id, discovery.plant_id
		from public."UserPlantDiscovery" discovery
		cross join boundaries
		where discovery.auth_id is not null
			and discovery.discovered_date >= boundaries.since_7d
	), community as (
		select
			count(*)::integer as scans_7d,
			count(distinct recent_scans.auth_id)::integer as active_explorers_7d,
			count(distinct recent_scans.plant_id)::integer as distinct_species_7d
		from recent_scans
	), species_total as (
		select count(*)::integer as species_in_game
		from public."Plant"
	), plant_ranking as (
		-- Small-cohort suppression: a plant is only highlighted if at least 3 players scanned it.
		select recent_scans.plant_id, count(*)::integer as scan_count_7d
		from recent_scans
		where recent_scans.plant_id is not null
		group by recent_scans.plant_id
		having count(distinct recent_scans.auth_id) >= 3
		order by count(*) desc, recent_scans.plant_id
		limit 5
	), top_plants as (
		select coalesce(
			jsonb_agg(
				jsonb_build_object(
					'species_name', plant.species_name,
					'scientific_name', plant.scientific_name,
					'genus_name', genus.genus_name,
					'category', plant.genus_category,
					'rarity', plant.rarity,
					'fun_fact', left(plant.fun_fact, 400),
					'scan_count_7d', plant_ranking.scan_count_7d
				)
				order by plant_ranking.scan_count_7d desc, plant.species_name
			),
			'[]'::jsonb
		) as items
		from plant_ranking
		join public."Plant" plant on plant.id = plant_ranking.plant_id
		left join public."PlantGenus" genus
			on genus.category = plant.genus_category
			and genus.category_dex_number = plant.genus_number
		where plant.species_name is not null
	), scan_of_the_week as (
		select jsonb_build_object(
			'week_key', coalesce(
				ledger.metadata->>'week',
				to_char(ledger.created_at at time zone 'utc', 'IYYY-"W"IW')
			),
			'species_name', plant.species_name,
			'genus_name', genus.genus_name,
			'category', plant.genus_category,
			'like_count', nullif(ledger.metadata->>'like_count', '')::integer,
			'source', case
				when ledger.event_source = 'weekly_likes_reward' then 'scheduler'
				else 'admin'
			end
		) as item
		from public."UserWalletLedger" ledger
		cross join boundaries
		join public."UserPlantDiscovery" discovery
			on discovery.id = coalesce(
				ledger.metadata->>'discovery_id',
				ledger.metadata->>'discoveryId'
			)
		join public."Plant" plant on plant.id = discovery.plant_id
		left join public."PlantGenus" genus
			on genus.category = plant.genus_category
			and genus.category_dex_number = plant.genus_number
		where ledger.currency_code = 'sparks'
			and ledger.event_source in ('weekly_likes_reward', 'scan_of_the_week')
			and ledger.created_at >= boundaries.since_14d
			and plant.species_name is not null
		order by ledger.created_at desc
		limit 1
	), weekly_quest as (
		-- Mirrors getCurrentWeeklyQuest(): (ISO week - 1) % quest count, ordered by quest_number.
		select jsonb_build_object(
			'title', ranked.title,
			'description', left(ranked.description, 400),
			'category', ranked.category,
			'target_genus_name', ranked.target_genus_name,
			'target_species_name', ranked.target_species_name,
			'required_discoveries', ranked.required_discoveries
		) as item
		from (
			select
				quest.*,
				row_number() over (order by quest.quest_number nulls last, quest.id) - 1 as quest_index,
				count(*) over () as quest_total
			from public."WeeklyQuest" quest
		) ranked
		cross join boundaries
		where ranked.quest_index
			= (extract(week from boundaries.local_now)::integer - 1) % ranked.quest_total
	), monthly_quest as (
		-- Mirrors getCurrentMonthlyQuest(): (month - 1) % quest count, ordered by quest_number.
		select jsonb_build_object(
			'title', ranked.title,
			'description', left(ranked.description, 400),
			'category', ranked.category,
			'target_genus_name', ranked.target_genus_name,
			'target_species_name', ranked.target_species_name,
			'required_discoveries', ranked.required_discoveries
		) as item
		from (
			select
				quest.*,
				row_number() over (order by quest.quest_number nulls last, quest.id) - 1 as quest_index,
				count(*) over () as quest_total
			from public."MonthlyQuest" quest
		) ranked
		cross join boundaries
		where ranked.quest_index
			= (extract(month from boundaries.local_now)::integer - 1) % ranked.quest_total
	)
	select jsonb_build_object(
		'generated_at', boundaries.generated_at,
		'week_key', to_char(boundaries.local_now, 'IYYY-"W"IW'),
		'community', jsonb_build_object(
			'scans_7d', community.scans_7d,
			'active_explorers_7d', community.active_explorers_7d,
			'distinct_species_7d', community.distinct_species_7d,
			'species_in_game', species_total.species_in_game
		),
		'top_plants_7d', top_plants.items,
		'scan_of_the_week', (select scan_of_the_week.item from scan_of_the_week),
		'weekly_quest', (select weekly_quest.item from weekly_quest),
		'monthly_quest', (select monthly_quest.item from monthly_quest)
	)
	from boundaries
	cross join community
	cross join species_total
	cross join top_plants;
$$;

revoke all on function public.ai_get_content_snapshot() from public, anon, authenticated;
grant execute on function public.ai_get_content_snapshot() to service_role;

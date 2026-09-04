-- Weekly quest completion belongs to the discovery transaction. Client-side
-- recalculation is vulnerable to navigation, offline, and cache races.
alter table public."UserWeeklyQuest"
	add column if not exists completed_by_discovery_id text;

create index if not exists userweeklyquest_auth_quest_week_unique
	on public."UserWeeklyQuest" (auth_id, weekly_quest_id, active_week)
	where auth_id is not null and weekly_quest_id is not null and active_week is not null;

create index if not exists userplantdiscovery_auth_weekly_progress_idx
	on public."UserPlantDiscovery" (auth_id, discovered_date, plant_id);

create or replace function public.sync_weekly_quest_on_discovery()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
	weekly_quest public."WeeklyQuest"%rowtype;
	active_week_key text := to_char(new.discovered_date at time zone 'UTC', 'IYYY-"W"IW');
	weekly_quest_count integer;
	target_matches boolean := false;
begin
	if new.auth_id is null or new.plant_id is null or new.discovered_date is null then
		return new;
	end if;

	select count(*) into weekly_quest_count from public."WeeklyQuest";
	if weekly_quest_count = 0 then
		return new;
	end if;

	select * into weekly_quest
	from public."WeeklyQuest"
	order by quest_number
	offset ((extract(week from new.discovered_date at time zone 'UTC')::integer - 1) % weekly_quest_count)
	limit 1;

	insert into public."UserWeeklyQuest" (
		id, weekly_quest_id, active_week, auth_id, created_by, status,
		accepted, accepted_at, accepted_date, progress, completed
	)
	values (
		encode(extensions.gen_random_bytes(12), 'hex'), weekly_quest.id, active_week_key,
		new.auth_id, new.created_by, 'active', 'true'::jsonb, new.discovered_date,
		new.discovered_date::text, '0', false
	)
	on conflict do nothing;

	select case
		when coalesce(nullif(weekly_quest.target_species_name, ''), '') <> '' then
			plant.species_name = weekly_quest.target_species_name
		when coalesce(nullif(weekly_quest.target_genus_name, ''), '') <> '' then
			exists (
				select 1
				from public."PlantGenus" genus
				where genus.category = plant.genus_category
					and genus.category_dex_number = plant.genus_number
					and genus.genus_name = weekly_quest.target_genus_name
			)
		when coalesce(nullif(weekly_quest.category, ''), 'Alle') <> 'Alle' then
			plant.genus_category = weekly_quest.category
		else true
	end
	into target_matches
	from public."Plant" plant
	where plant.id = new.plant_id;

	if not coalesce(target_matches, false) then
		return new;
	end if;

	update public."UserWeeklyQuest" user_quest
	set
		progress = (coalesce(nullif(user_quest.progress, ''), '0')::integer + 1)::text,
		completed = coalesce(nullif(user_quest.progress, ''), '0')::integer + 1 >= weekly_quest.required_discoveries,
		status = case
			when coalesce(nullif(user_quest.progress, ''), '0')::integer + 1 >= weekly_quest.required_discoveries then 'completed'
			else 'active'
		end,
		completed_date = case
			when coalesce(nullif(user_quest.progress, ''), '0')::integer + 1 >= weekly_quest.required_discoveries
				and not coalesce(user_quest.completed, false) then new.discovered_date::text
			else user_quest.completed_date
		end,
		completed_at = case
			when coalesce(nullif(user_quest.progress, ''), '0')::integer + 1 >= weekly_quest.required_discoveries
				and not coalesce(user_quest.completed, false) then new.discovered_date
			else user_quest.completed_at
		end,
		completed_by_discovery_id = case
			when coalesce(nullif(user_quest.progress, ''), '0')::integer + 1 >= weekly_quest.required_discoveries
				and not coalesce(user_quest.completed, false) then new.id
			else user_quest.completed_by_discovery_id
		end,
		updated_at = now()
	where user_quest.auth_id = new.auth_id
		and user_quest.weekly_quest_id = weekly_quest.id
		and user_quest.active_week = active_week_key
		and user_quest.status = 'active';

	return new;
end;
$$;

drop trigger if exists sync_weekly_quest_on_discovery on public."UserPlantDiscovery";
create trigger sync_weekly_quest_on_discovery
after insert on public."UserPlantDiscovery"
for each row execute function public.sync_weekly_quest_on_discovery();

-- Apply the same deterministic calculation to qualifying scans already saved
-- in the current ISO week before this trigger is deployed. This deliberately
-- avoids ON CONFLICT because old installations can have a differently-defined
-- partial unique index.
with current_week as (
	select date_trunc('week', now() at time zone 'UTC') as starts_at
),
weekly_quest_backfill as (
select
	discovery.auth_id,
	discovery.created_by,
	quest.id as weekly_quest_id,
	to_char(discovery.discovered_date at time zone 'UTC', 'IYYY-"W"IW') as active_week,
	min(discovery.discovered_date) as accepted_at,
	count(*)::text as progress,
	count(*) >= quest.required_discoveries as completed,
	case when count(*) >= quest.required_discoveries then max(discovery.discovered_date)::text end as completed_date,
	case when count(*) >= quest.required_discoveries then max(discovery.discovered_date) end as completed_at,
	case when count(*) >= quest.required_discoveries then (array_agg(discovery.id order by discovery.discovered_date desc))[1] end as completed_by_discovery_id
from public."UserPlantDiscovery" discovery
join public."Plant" plant on plant.id = discovery.plant_id
cross join lateral (
	select weekly.*
	from public."WeeklyQuest" weekly
	order by weekly.quest_number
	offset ((extract(week from discovery.discovered_date at time zone 'UTC')::integer - 1) % (select count(*) from public."WeeklyQuest"))
	limit 1
) quest
cross join current_week
where discovery.auth_id is not null
	and discovery.discovered_date >= current_week.starts_at
	and discovery.discovered_date < current_week.starts_at + interval '7 days'
	and case
		when coalesce(nullif(quest.target_species_name, ''), '') <> '' then plant.species_name = quest.target_species_name
		when coalesce(nullif(quest.target_genus_name, ''), '') <> '' then exists (
			select 1 from public."PlantGenus" genus
			where genus.category = plant.genus_category
				and genus.category_dex_number = plant.genus_number
				and genus.genus_name = quest.target_genus_name
		)
		when coalesce(nullif(quest.category, ''), 'Alle') <> 'Alle' then plant.genus_category = quest.category
		else true
	end
group by discovery.auth_id, discovery.created_by, quest.id, quest.required_discoveries,
	to_char(discovery.discovered_date at time zone 'UTC', 'IYYY-"W"IW')
),
updated_quests as (
update public."UserWeeklyQuest" user_quest
set
	progress = backfill.progress,
	completed = backfill.completed,
	status = case when backfill.completed then 'completed' else 'active' end,
	completed_date = backfill.completed_date,
	completed_at = backfill.completed_at,
	completed_by_discovery_id = backfill.completed_by_discovery_id,
	updated_at = now()
from weekly_quest_backfill backfill
where user_quest.auth_id = backfill.auth_id
	and user_quest.weekly_quest_id = backfill.weekly_quest_id
	and user_quest.active_week = backfill.active_week
	and user_quest.status = 'active'
returning user_quest.id
)

insert into public."UserWeeklyQuest" (
	id, weekly_quest_id, active_week, auth_id, created_by, status,
	accepted, accepted_at, accepted_date, progress, completed,
	completed_date, completed_at, completed_by_discovery_id
)
select
	encode(extensions.gen_random_bytes(12), 'hex'), backfill.weekly_quest_id,
	backfill.active_week, backfill.auth_id, backfill.created_by,
	case when backfill.completed then 'completed' else 'active' end,
	'true'::jsonb, backfill.accepted_at, backfill.accepted_at::text,
	backfill.progress, backfill.completed, backfill.completed_date,
	backfill.completed_at, backfill.completed_by_discovery_id
from weekly_quest_backfill backfill
where not exists (
	select 1
	from public."UserWeeklyQuest" user_quest
	where user_quest.auth_id = backfill.auth_id
		and user_quest.weekly_quest_id = backfill.weekly_quest_id
		and user_quest.active_week = backfill.active_week
);

notify pgrst, 'reload schema';

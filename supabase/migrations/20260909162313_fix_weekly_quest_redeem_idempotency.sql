-- Ensure there can be only one per-user row for a weekly quest in an ISO week.
-- A previous migration created a plain index with a "unique" name, so duplicate
-- active/redeemed rows could coexist and make the same completed quest redeemable
-- repeatedly until the UI cache eventually caught up.

alter table public."UserWeeklyQuest"
	add column if not exists completed_by_discovery_id text;

drop index if exists public.userweeklyquest_auth_quest_week_unique;

with duplicate_groups as (
	select auth_id, weekly_quest_id, active_week
	from public."UserWeeklyQuest"
	where auth_id is not null
		and weekly_quest_id is not null
		and active_week is not null
	group by auth_id, weekly_quest_id, active_week
	having count(*) > 1
), ranked_duplicates as (
	select
		user_quest.*,
		row_number() over (
			partition by auth_id, weekly_quest_id, active_week
			order by
				case when status = 'redeemed' or lower(coalesce(redeemed, '')) = 'true' then 0 else 1 end,
				case when status = 'completed' or coalesce(completed, false) then 0 else 1 end,
				coalesce(updated_at, redeemed_date, completed_at, accepted_at, created_date, now()) desc,
				id
		) as duplicate_rank,
		max(case when coalesce(progress, '') ~ '^[0-9]+$' then progress::integer else 0 end) over (
			partition by auth_id, weekly_quest_id, active_week
		) as max_progress,
		bool_or(coalesce(completed, false) or status in ('completed', 'redeemed')) over (
			partition by auth_id, weekly_quest_id, active_week
		) as any_completed,
		bool_or(lower(coalesce(redeemed, '')) = 'true' or status = 'redeemed') over (
			partition by auth_id, weekly_quest_id, active_week
		) as any_redeemed,
		max(completed_at) over (partition by auth_id, weekly_quest_id, active_week) as latest_completed_at,
		max(redeemed_date) over (partition by auth_id, weekly_quest_id, active_week) as latest_redeemed_date,
		max(completed_date) over (partition by auth_id, weekly_quest_id, active_week) as latest_completed_date,
		max(completed_by_discovery_id) over (partition by auth_id, weekly_quest_id, active_week) as merged_completed_by_discovery_id
	from public."UserWeeklyQuest" user_quest
	join duplicate_groups using (auth_id, weekly_quest_id, active_week)
), keepers as (
	select *
	from ranked_duplicates
	where duplicate_rank = 1
), merged_duplicates as (
	update public."UserWeeklyQuest" user_quest
	set
		progress = keepers.max_progress::text,
		completed = keepers.any_completed,
		redeemed = case when keepers.any_redeemed then 'true' else coalesce(user_quest.redeemed, 'false') end,
		status = case
			when keepers.any_redeemed then 'redeemed'
			when keepers.any_completed then 'completed'
			else user_quest.status
		end,
		completed_at = coalesce(user_quest.completed_at, keepers.latest_completed_at),
		redeemed_date = coalesce(user_quest.redeemed_date, keepers.latest_redeemed_date),
		completed_date = coalesce(user_quest.completed_date, keepers.latest_completed_date),
		completed_by_discovery_id = coalesce(user_quest.completed_by_discovery_id, keepers.merged_completed_by_discovery_id),
		updated_at = now()
	from keepers
	where user_quest.id = keepers.id
	returning user_quest.id
)
delete from public."UserWeeklyQuest" user_quest
using ranked_duplicates ranked
where user_quest.id = ranked.id
	and ranked.duplicate_rank > 1;

create unique index userweeklyquest_auth_quest_week_unique
	on public."UserWeeklyQuest" (auth_id, weekly_quest_id, active_week)
	where auth_id is not null and weekly_quest_id is not null and active_week is not null;

notify pgrst, 'reload schema';

-- Backfill missing UserReward rows for already unlocked achievements.
-- Resolves reward links robustly by matching Achievement.reward_name/title_reward
-- against Rewards.name, Rewards.display_name or Rewards.value (case-insensitive).
--
-- This keeps UserReward in sync with UserAchievement for historical data where
-- reward references were stored inconsistently.

with reward_candidates as (
  select
    ua.auth_id,
    ua.created_by,
    ua.unlocked_date,
    a.id as achievement_id,
    nullif(trim(a.reward_name), '') as reward_name_candidate,
    nullif(trim(a.title_reward), '') as title_reward_candidate
  from public."UserAchievement" ua
  join public."Achievement" a
    on a.id = ua.achievement_id
  where ua.auth_id is not null
), resolved_rewards as (
  select distinct on (rc.auth_id, r.id)
    rc.auth_id,
    rc.created_by,
    rc.unlocked_date,
    r.id as reward_id,
    coalesce(nullif(trim(r.display_name), ''), nullif(trim(r.name), ''), nullif(trim(r.value), '')) as reward_name
  from reward_candidates rc
  join public."Rewards" r
    on (
      (rc.reward_name_candidate is not null and lower(trim(r.name)) = lower(rc.reward_name_candidate))
      or (rc.reward_name_candidate is not null and lower(trim(coalesce(r.display_name, ''))) = lower(rc.reward_name_candidate))
      or (rc.reward_name_candidate is not null and lower(trim(coalesce(r.value, ''))) = lower(rc.reward_name_candidate))
      or (rc.title_reward_candidate is not null and lower(trim(r.name)) = lower(rc.title_reward_candidate))
      or (rc.title_reward_candidate is not null and lower(trim(coalesce(r.display_name, ''))) = lower(rc.title_reward_candidate))
      or (rc.title_reward_candidate is not null and lower(trim(coalesce(r.value, ''))) = lower(rc.title_reward_candidate))
    )
  order by rc.auth_id, r.id, rc.unlocked_date asc nulls last
), profile_data as (
  select
    pp.auth_id,
    nullif(trim(pp.user_email), '') as user_email,
    coalesce(nullif(trim(pp.display_name), ''), nullif(trim(pp.full_name), '')) as user_name
  from public."PublicProfile" pp
)
insert into public."UserReward" (
  reward_id,
  reward_name,
  auth_id,
  user_email,
  user_name,
  unlocked_date,
  created_by
)
select
  rr.reward_id,
  rr.reward_name,
  rr.auth_id,
  coalesce(pd.user_email, nullif(trim(rr.created_by), '')) as user_email,
  coalesce(pd.user_name, nullif(trim(rr.created_by), '')) as user_name,
  coalesce(rr.unlocked_date, now()) as unlocked_date,
  nullif(trim(rr.created_by), '') as created_by
from resolved_rewards rr
left join profile_data pd
  on pd.auth_id = rr.auth_id
where not exists (
  select 1
  from public."UserReward" ur
  where ur.auth_id = rr.auth_id
    and ur.reward_id = rr.reward_id
);

-- Optional verification examples:
-- 1) Missing rewards for unlocked achievements (should return 0 rows after migration)
-- select ua.auth_id, a.title, a.reward_name, a.title_reward
-- from public."UserAchievement" ua
-- join public."Achievement" a on a.id = ua.achievement_id
-- left join public."Rewards" r
--   on lower(trim(r.name)) = lower(trim(coalesce(a.reward_name, '')))
--   or lower(trim(coalesce(r.display_name, ''))) = lower(trim(coalesce(a.reward_name, '')))
--   or lower(trim(coalesce(r.value, ''))) = lower(trim(coalesce(a.reward_name, '')))
--   or lower(trim(r.name)) = lower(trim(coalesce(a.title_reward, '')))
--   or lower(trim(coalesce(r.display_name, ''))) = lower(trim(coalesce(a.title_reward, '')))
--   or lower(trim(coalesce(r.value, ''))) = lower(trim(coalesce(a.title_reward, '')))
-- left join public."UserReward" ur on ur.auth_id = ua.auth_id and ur.reward_id = r.id
-- where r.id is not null and ur.id is null;

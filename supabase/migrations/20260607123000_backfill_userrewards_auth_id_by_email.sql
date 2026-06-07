-- Backfill legacy UserRewards rows that only contain email/user metadata but no auth_id.
-- This restores visibility under RLS policy `auth.uid() = auth_id` after reinstall/login.

with profile_by_email as (
  select
    pp.auth_id,
    lower(nullif(trim(pp.user_email), '')) as normalized_email,
    coalesce(nullif(trim(pp.display_name), ''), nullif(trim(pp.full_name), '')) as resolved_name,
    nullif(trim(pp.user_email), '') as raw_email
  from public."PublicProfile" pp
  where pp.auth_id is not null
    and nullif(trim(pp.user_email), '') is not null
), candidates as (
  select
    ur.id,
    pbe.auth_id,
    pbe.raw_email,
    pbe.resolved_name
  from public."UserRewards" ur
  join profile_by_email pbe
    on pbe.normalized_email = lower(coalesce(nullif(trim(ur.user_email), ''), nullif(trim(ur.created_by), '')))
  where ur.auth_id is null
), non_conflicting as (
  select
    c.id,
    c.auth_id,
    c.raw_email,
    c.resolved_name
  from candidates c
  join public."UserRewards" source
    on source.id = c.id
  where not exists (
    select 1
    from public."UserRewards" existing
    where existing.auth_id = c.auth_id
      and existing.reward_id = source.reward_id
  )
)
update public."UserRewards" ur
set
  auth_id = nc.auth_id,
  user_email = coalesce(nullif(trim(ur.user_email), ''), nc.raw_email),
  user_name = coalesce(nullif(trim(ur.user_name), ''), nc.resolved_name)
from non_conflicting nc
where ur.id = nc.id;

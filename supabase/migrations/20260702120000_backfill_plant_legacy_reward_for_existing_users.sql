-- Backfill: Grant plant_legacy accessory to all users created before 2026-07-02.
--
-- Background: plant_legacy was previously default-unlocked for all users via
-- the frontend hardcode (DEFAULT_UNLOCKED_IDS). On 2026-07-02 the asset was
-- retired (shop_hidden = true on the reward, default_unlocked removed from code).
-- To preserve access for existing users, we insert a UserRewards row for every
-- PublicProfile whose auth.users.created_at predates the retirement date.
-- New users registered on or after 2026-07-02 will NOT receive this row and
-- will no longer see the item in the shop or customisation menu.

insert into public."UserRewards" (auth_id, reward_id, reward_name, user_email, user_name, unlocked_date)
select
  pp.auth_id,
  'reward_logo_accessory_plant_legacy'                                       as reward_id,
  'plant_legacy'                                                              as reward_name,
  pp.user_email,
  coalesce(nullif(trim(pp.display_name), ''), nullif(trim(pp.full_name), '')) as user_name,
  now()                                                                       as unlocked_date
from public."PublicProfile" pp
join auth.users au on au.id = pp.auth_id
where au.created_at < '2026-07-02T00:00:00+00:00'
  and pp.auth_id is not null
  and not exists (
    select 1
    from public."UserRewards" existing
    where existing.auth_id = pp.auth_id
      and existing.reward_id = 'reward_logo_accessory_plant_legacy'
  );

notify pgrst, 'reload schema';

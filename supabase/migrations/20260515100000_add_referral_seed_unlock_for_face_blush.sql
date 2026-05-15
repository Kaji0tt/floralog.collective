alter table "Rewards"
  add column if not exists requires_referred_seeds_progress integer;

update "Rewards"
set
  requires_referrals = 1,
  requires_referred_seeds_progress = 1500,
  type = coalesce(type, 'logo_accessory')
where lower(coalesce(value, '')) in ('face_blush', 'blush')
  and coalesce(type, 'logo_accessory') in ('logo_accessory', 'accessory');

insert into "Rewards" (
  id,
  name,
  display_name,
  type,
  value,
  image_url,
  requires_referrals,
  requires_referred_seeds_progress
)
select
  'reward_logo_accessory_face_blush_referral_1500',
  'face_blush_referral_seed_unlock',
  'Blush Face',
  'logo_accessory',
  'face_blush',
  null,
  1,
  1500
where not exists (
  select 1
  from "Rewards"
  where lower(coalesce(value, '')) in ('face_blush', 'blush')
    and coalesce(type, 'logo_accessory') in ('logo_accessory', 'accessory')
);

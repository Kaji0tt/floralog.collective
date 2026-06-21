alter table public."PublicProfile"
  add column if not exists selected_profile_effect text,
  add column if not exists selected_logo_effect text;

comment on column public."PublicProfile".selected_profile_effect is
  'Aktiv ausgeruesteter Profileffekt aus Rewards.type = profile_effect.';

comment on column public."PublicProfile".selected_logo_effect is
  'Vorbereiteter Logoeffekt aus Rewards.type = logo_effect (noch nicht aktiv in der UI).';

insert into "Rewards" (
  id,
  name,
  display_name,
  type,
  value,
  color,
  spark_price,
  amber_price
)
select
  'reward_profile_effect_rarity_border_glow',
  'profile_effect_rarity_border_glow',
  'Rarity Aura',
  'profile_effect',
  'rarity_border_glow',
  '#F0E5A5',
  140,
  null
where not exists (
  select 1
  from "Rewards"
  where type = 'profile_effect'
    and lower(coalesce(value, '')) = 'rarity_border_glow'
);

insert into "Rewards" (
  id,
  name,
  display_name,
  type,
  value,
  color,
  spark_price,
  amber_price
)
select
  'reward_logo_effect_rarity_pulse',
  'logo_effect_rarity_pulse',
  'Logo Pulse',
  'logo_effect',
  'logo_rarity_pulse',
  '#F0E5A5',
  160,
  null
where not exists (
  select 1
  from "Rewards"
  where type = 'logo_effect'
    and lower(coalesce(value, '')) = 'logo_rarity_pulse'
);

notify pgrst, 'reload schema';

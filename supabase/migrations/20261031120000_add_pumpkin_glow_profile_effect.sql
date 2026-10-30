-- Profileffekt: Kürbis-Glühen (Glow des Community Events „Die Kürbis-Jagd“, orange/violett, blinkend)
insert into "Rewards" (
  id,
  name,
  display_name,
  type,
  value,
  color,
  spark_price,
  amber_price,
  custom_description
)
select
  'reward_profile_effect_pumpkin_glow',
  'profile_effect_pumpkin_glow',
  'Kürbis-Glühen',
  'profile_effect',
  'pumpkin_glow',
  '#F97316',
  360,
  120,
  'Der leuchtende Rahmen der Kürbis-Jagd – orange-violett und blinkend.'
where not exists (
  select 1
  from "Rewards"
  where type = 'profile_effect'
    and lower(coalesce(value, '')) = 'pumpkin_glow'
);

notify pgrst, 'reload schema';

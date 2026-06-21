-- Profileffekt: Shell Border Glow (glitzernder Rand um die Home-Shell)
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
  'reward_profile_effect_shell_border_glow',
  'profile_effect_shell_border_glow',
  'Schimmernder Rahmen',
  'profile_effect',
  'shell_border_glow',
  '#F0E5A5',
  360,
  120
where not exists (
  select 1
  from "Rewards"
  where type = 'profile_effect'
    and lower(coalesce(value, '')) = 'shell_border_glow'
);

notify pgrst, 'reload schema';

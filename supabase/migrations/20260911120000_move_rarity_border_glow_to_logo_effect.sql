-- Reclassify "Rarity Aura" from a Profileffekt to a Florabot-Effekt (rendering already targets the Florabot logo).
update "Rewards"
set type = 'logo_effect'
where type = 'profile_effect'
  and lower(coalesce(value, '')) = 'rarity_border_glow';

-- Carry over any equipped selection so players keep seeing the effect unchanged after the reclassification.
update "PublicProfile"
set selected_logo_effect = 'rarity_border_glow',
    selected_profile_effect = null
where lower(coalesce(selected_profile_effect, '')) = 'rarity_border_glow';

notify pgrst, 'reload schema';

-- Add theme-specific panda face rewards to the matching zone lootbox pools.
-- Weight 4 matches the existing rare Sputnik accessory candidate.

WITH panda_rewards(reward_name, zone_theme) AS (
  VALUES
    ('accessory_face_forestpanda', 'forest'),
    ('accessory_face_meadowpanda', 'meadow'),
    ('accessory_face_waterpanda', 'water'),
    ('accessory_face_urbanpanda', 'urban')
)
INSERT INTO public."ZoneLootboxEntry" (
  pool_id,
  reward_id,
  selection_group,
  shared_only,
  weight,
  duplicate_seed_value
)
SELECT
  pool.id,
  reward.id,
  'bonus',
  false,
  4,
  250
FROM panda_rewards panda
JOIN public."Rewards" reward
  ON lower(reward.name) = lower(panda.reward_name)
  OR lower(reward.value) = replace(lower(panda.reward_name), 'accessory_', '')
JOIN public."ZoneLootboxPool" pool
  ON pool.zone_theme = panda.zone_theme
 AND pool.is_active = true
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pool.id
    AND entry.reward_id = reward.id
);

NOTIFY pgrst, 'reload schema';

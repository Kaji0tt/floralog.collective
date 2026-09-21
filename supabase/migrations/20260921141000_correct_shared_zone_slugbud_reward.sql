-- Correct the shared-zone lootbox reward: use Slugbud instead of Bork.

DELETE FROM public."ZoneLootboxEntry"
WHERE reward_id = 'reward_logo_accessory_face_bork';

INSERT INTO public."Rewards" (id, name, display_name, type, value)
VALUES (
  'reward_logo_accessory_face_slugbud',
  'accessory_face_slugbud',
  'Slugbud',
  'logo_accessory',
  'face_slugbud'
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    type = EXCLUDED.type,
    value = EXCLUDED.value;

WITH pools AS (
  SELECT id AS pool_id
  FROM public."ZoneLootboxPool"
  WHERE is_active = true
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
  pools.pool_id,
  'reward_logo_accessory_face_slugbud',
  'bonus',
  true,
  1,
  500
FROM pools
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pools.pool_id
    AND entry.reward_id = 'reward_logo_accessory_face_slugbud'
);

NOTIFY pgrst, 'reload schema';

-- Season 2: Zone lootbox content
-- Each claim grants exactly one guaranteed currency entry and one bonus entry.
-- Weights are relative within each selection_group.

ALTER TABLE public."ZoneLootboxEntry"
  ALTER COLUMN reward_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS selection_group text NOT NULL DEFAULT 'bonus',
  ADD COLUMN IF NOT EXISTS currency_code text NULL,
  ADD COLUMN IF NOT EXISTS currency_amount integer NULL,
  ADD COLUMN IF NOT EXISTS shared_only boolean NOT NULL DEFAULT false;

ALTER TABLE public."ZoneLootboxEntry"
  DROP CONSTRAINT IF EXISTS zone_lootbox_entry_selection_group_check;
ALTER TABLE public."ZoneLootboxEntry"
  ADD CONSTRAINT zone_lootbox_entry_selection_group_check
  CHECK (selection_group IN ('guaranteed', 'bonus'));

ALTER TABLE public."ZoneLootboxEntry"
  DROP CONSTRAINT IF EXISTS zone_lootbox_entry_currency_check;
ALTER TABLE public."ZoneLootboxEntry"
  ADD CONSTRAINT zone_lootbox_entry_currency_check
  CHECK (
    currency_code IS NULL
    OR currency_code IN ('seeds_progress', 'sparks', 'amber')
  );

ALTER TABLE public."ZoneLootboxEntry"
  DROP CONSTRAINT IF EXISTS zone_lootbox_entry_currency_amount_check;
ALTER TABLE public."ZoneLootboxEntry"
  ADD CONSTRAINT zone_lootbox_entry_currency_amount_check
  CHECK (currency_amount IS NULL OR currency_amount > 0);

-- Entries created by the earlier optional catalog seed are bonus candidates.
UPDATE public."ZoneLootboxEntry"
SET selection_group = 'bonus'
WHERE selection_group IS NULL;

-- Remove the previous automatically seeded entries so the configured pool is deterministic.
DELETE FROM public."ZoneLootboxEntry"
WHERE selection_group = 'bonus'
  AND currency_code IS NULL
  AND reward_id IN (
    SELECT id
    FROM public."Rewards"
    WHERE requires_zone_theme IS NOT NULL
  );

-- The guaranteed part: 100 Seeds is common, 250 less common, 500 rare.
WITH seed_amounts(amount, weight) AS (
  VALUES (100, 70), (250, 25), (500, 5)
), pools AS (
  SELECT id AS pool_id
  FROM public."ZoneLootboxPool"
  WHERE is_active = true
)
INSERT INTO public."ZoneLootboxEntry" (
  pool_id, reward_id, selection_group, currency_code, currency_amount, shared_only, weight, duplicate_seed_value
)
SELECT pools.pool_id, NULL, 'guaranteed', 'seeds_progress', seed_amounts.amount, false, seed_amounts.weight, 0
FROM pools
CROSS JOIN seed_amounts
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pools.pool_id
    AND entry.selection_group = 'guaranteed'
    AND entry.currency_code = 'seeds_progress'
    AND entry.currency_amount = seed_amounts.amount
);

-- Bonus currency: 3 Sparks is frequent; larger amounts are increasingly rare.
WITH bonus(amount, currency, weight) AS (
  VALUES
    (3,  'sparks', 600),
    (5,  'sparks', 250),
    (10, 'sparks', 100),
    (30, 'sparks', 40),
    (10, 'amber', 5)
), pools AS (
  SELECT id AS pool_id
  FROM public."ZoneLootboxPool"
  WHERE is_active = true
)
INSERT INTO public."ZoneLootboxEntry" (
  pool_id, reward_id, selection_group, currency_code, currency_amount, shared_only, weight, duplicate_seed_value
)
SELECT pools.pool_id, NULL, 'bonus', bonus.currency, bonus.amount, false, bonus.weight, 0
FROM pools
CROSS JOIN bonus
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pools.pool_id
    AND entry.selection_group = 'bonus'
    AND entry.currency_code = bonus.currency
    AND entry.currency_amount = bonus.amount
);

-- Ensure the requested accessory rewards exist in the global catalog.
INSERT INTO public."Rewards" (id, name, display_name, type, value)
VALUES
  ('reward_logo_accessory_face_snuggles', 'accessory_face_snuggles', 'Snuggles', 'logo_accessory', 'face_snuggles'),
  ('reward_logo_accessory_face_slug', 'accessory_face_slug', 'Slug', 'logo_accessory', 'face_slug'),
  ('reward_logo_accessory_face_sputnik', 'accessory_face_sputnik', 'Sputnik', 'logo_accessory', 'face_sputnik'),
  ('reward_logo_accessory_face_luchsorbit', 'accessory_face_luchsorbit', 'Luchsorbit', 'logo_accessory', 'face_luchsorbit'),
  ('reward_logo_accessory_face_slugbud', 'accessory_face_slugbud', 'Slugbud', 'logo_accessory', 'face_slugbud')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    value = EXCLUDED.value;

-- Regular accessory candidates are rare bonus rewards in every active pool.
WITH requested_rewards(reward_id, weight) AS (
  VALUES
    ('reward_logo_accessory_face_snuggles', 8),
    ('reward_logo_accessory_face_slug', 6),
    ('reward_logo_accessory_face_sputnik', 4),
    ('reward_logo_accessory_face_luchsorbit', 2)
), pools AS (
  SELECT id AS pool_id
  FROM public."ZoneLootboxPool"
  WHERE is_active = true
)
INSERT INTO public."ZoneLootboxEntry" (
  pool_id, reward_id, selection_group, shared_only, weight, duplicate_seed_value
)
SELECT pools.pool_id, requested_rewards.reward_id, 'bonus', false, requested_rewards.weight, 250
FROM pools
CROSS JOIN requested_rewards
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pools.pool_id
    AND entry.reward_id = requested_rewards.reward_id
);

-- Slugbud is only eligible when the completed zone came from an accepted shared invite.
WITH pools AS (
  SELECT id AS pool_id
  FROM public."ZoneLootboxPool"
  WHERE is_active = true
)
INSERT INTO public."ZoneLootboxEntry" (
  pool_id, reward_id, selection_group, shared_only, weight, duplicate_seed_value
)
SELECT pools.pool_id, 'reward_logo_accessory_face_slugbud', 'bonus', true, 1, 500
FROM pools
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pools.pool_id
    AND entry.reward_id = 'reward_logo_accessory_face_slugbud'
);

CREATE INDEX IF NOT EXISTS idx_zone_lootbox_entry_selection_group
  ON public."ZoneLootboxEntry" (pool_id, selection_group, shared_only, weight DESC);

NOTIFY pgrst, 'reload schema';

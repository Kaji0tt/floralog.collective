-- Season 2: Phase B – default pool definitions for zone lootboxes
-- These rows create the operational pool catalog. Reward entries themselves
-- are intentionally not guessed here; they are added later from the actual
-- Reward catalog and the final balancing pass.

ALTER TABLE public."ZoneLootboxPool"
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text;

INSERT INTO public."ZoneLootboxPool" (id, zone_theme, name, description, is_active)
SELECT gen_random_uuid(), theme.slug, theme.name, theme.description, true
FROM (
  VALUES
    ('forest', 'Wald-Entdecker-Knospe', 'Belohnungen aus dem Wald-Theme.'),
    ('water', 'Wasser-Entdecker-Knospe', 'Belohnungen aus dem Wasser-Theme.'),
    ('meadow', 'Wiesen-Entdecker-Knospe', 'Belohnungen aus dem Wiesen-Theme.'),
    ('urban', 'Stadt-Entdecker-Knospe', 'Belohnungen aus dem Stadt-Theme.'),
    ('beach', 'Strand-Entdecker-Knospe', 'Belohnungen aus dem Strand-Theme.'),
    ('wetlands', 'Feuchtgebiets-Entdecker-Knospe', 'Belohnungen aus dem Feuchtgebiets-Theme.'),
    ('all', 'Allgemeine Entdecker-Knospe', 'Fallback-Knospe für alle Zone-Themes.')
) AS theme(slug, name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxPool" p
  WHERE p.zone_theme = theme.slug
);

-- Optional seed based on an existing Reward catalog: if a reward already matches a
-- configured zone theme, it is attached as a candidate entry with a safe default
-- weight and duplicate compensation value. This does not invent final balancing.
INSERT INTO public."ZoneLootboxEntry" (id, pool_id, reward_id, weight, duplicate_seed_value)
SELECT gen_random_uuid(), pool.id, reward.id, 10, COALESCE(reward.spark_price, 0)
FROM public."ZoneLootboxPool" pool
JOIN public."Rewards" reward
  ON (
    (pool.zone_theme = 'all' AND reward.requires_zone_theme IS NOT NULL)
    OR reward.requires_zone_theme = pool.zone_theme
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public."ZoneLootboxEntry" entry
  WHERE entry.pool_id = pool.id AND entry.reward_id = reward.id
)
ON CONFLICT DO NOTHING;

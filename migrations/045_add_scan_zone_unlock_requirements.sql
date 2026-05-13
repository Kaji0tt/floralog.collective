ALTER TABLE "Rewards"
  ADD COLUMN IF NOT EXISTS requires_plant_id text REFERENCES "Plant"(id),
  ADD COLUMN IF NOT EXISTS requires_plant_species text,
  ADD COLUMN IF NOT EXISTS requires_zone_theme text;

CREATE INDEX IF NOT EXISTS idx_rewards_requires_zone_theme
  ON "Rewards" (requires_zone_theme)
  WHERE requires_zone_theme IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rewards_requires_plant_id
  ON "Rewards" (requires_plant_id)
  WHERE requires_plant_id IS NOT NULL;

INSERT INTO "Rewards" (
  id,
  name,
  display_name,
  type,
  value,
  image_url,
  requires_plant_species,
  requires_zone_theme
)
VALUES (
  'reward_logo_accessory_plant_schilf_water',
  'plant_schilf_water_unlock',
  'Schilf Accessoire',
  'logo_accessory',
  'plant_schilf',
  NULL,
  'Schilf',
  'water'
)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  type = EXCLUDED.type,
  value = EXCLUDED.value,
  requires_plant_species = EXCLUDED.requires_plant_species,
  requires_zone_theme = EXCLUDED.requires_zone_theme;
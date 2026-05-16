-- 1) FK-Spalte fuer Gattung
ALTER TABLE "Rewards"
  ADD COLUMN IF NOT EXISTS requires_plant_genus_id text REFERENCES "PlantGenus"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rewards_requires_plant_genus_id
  ON "Rewards" (requires_plant_genus_id)
  WHERE requires_plant_genus_id IS NOT NULL;

-- 2) FK-Spalte fuer Pflanzenart anlegen (ersetzt requires_plant_id)
ALTER TABLE "Rewards"
  ADD COLUMN IF NOT EXISTS requires_plant_species_id text REFERENCES "Plant"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rewards_requires_plant_species_id
  ON "Rewards" (requires_plant_species_id)
  WHERE requires_plant_species_id IS NOT NULL;

-- Bestehende Daten aus requires_plant_id uebernehmen
UPDATE "Rewards"
SET requires_plant_species_id = requires_plant_id
WHERE requires_plant_species_id IS NULL
  AND requires_plant_id IS NOT NULL;

-- 3) Veraltete Spalte requires_plant_id entfernen
ALTER TABLE "Rewards"
  DROP COLUMN IF EXISTS requires_plant_id;

-- Hinweis: requires_plant_genus und requires_plant_species haben in der DB nie existiert,
-- daher sind keine Backfill- oder Drop-Schritte noetig.

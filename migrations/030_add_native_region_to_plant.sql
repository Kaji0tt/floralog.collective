-- Add native_region column to Plant table
-- Stores the geographic origin/distribution of a plant species,
-- derived from GBIF species distribution data (not LLM-generated).
-- Example values: "Europa (Germany · France · Spain)"

ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS native_region TEXT DEFAULT NULL;

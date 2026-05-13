ALTER TABLE "Rewards"
  ADD COLUMN IF NOT EXISTS requires_plant_genus text;

CREATE INDEX IF NOT EXISTS idx_rewards_requires_plant_genus
  ON "Rewards" (requires_plant_genus)
  WHERE requires_plant_genus IS NOT NULL;

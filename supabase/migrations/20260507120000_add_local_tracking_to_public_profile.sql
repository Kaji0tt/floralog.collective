-- Migration: Add local_tracking preference to PublicProfile
-- Used for local map visibility. Defaults to true and backfills from legacy
-- weekly_tracking when that column still exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'local_tracking'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN local_tracking boolean NOT NULL DEFAULT true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'weekly_tracking'
  ) THEN
    EXECUTE '
      UPDATE "PublicProfile"
      SET local_tracking = COALESCE(weekly_tracking, true)
      WHERE local_tracking IS DISTINCT FROM COALESCE(weekly_tracking, true)
    ';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
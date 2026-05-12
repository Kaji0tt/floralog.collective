-- Add per-user visibility for the global Explorer Log feed.
-- Default is enabled so existing users stay visible unless they opt out.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'global_explorer_visibility'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN global_explorer_visibility boolean NOT NULL DEFAULT true;
  END IF;

  UPDATE "PublicProfile"
  SET global_explorer_visibility = true
  WHERE global_explorer_visibility IS NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
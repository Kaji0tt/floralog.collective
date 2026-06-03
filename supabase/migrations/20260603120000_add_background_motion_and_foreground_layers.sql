-- Add background reward motion flag and profile fields for future foreground layers in Home/Shop
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Rewards' AND column_name = 'background_motion_enabled'
  ) THEN
    ALTER TABLE "Rewards"
      ADD COLUMN background_motion_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'background_motion_enabled'
  ) THEN
    ALTER TABLE "PublicProfile"
      DROP COLUMN background_motion_enabled;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'home_foreground_image_url'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN home_foreground_image_url text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'home_foreground_motion_enabled'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN home_foreground_motion_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'shop_foreground_image_url'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN shop_foreground_image_url text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'shop_foreground_motion_enabled'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN shop_foreground_motion_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

UPDATE "Rewards"
SET
  background_motion_enabled = COALESCE(background_motion_enabled, false)
WHERE
  background_motion_enabled IS NULL;

UPDATE "PublicProfile"
SET
  home_foreground_motion_enabled = COALESCE(home_foreground_motion_enabled, true),
  shop_foreground_motion_enabled = COALESCE(shop_foreground_motion_enabled, true)
WHERE
  home_foreground_motion_enabled IS NULL
  OR shop_foreground_motion_enabled IS NULL;

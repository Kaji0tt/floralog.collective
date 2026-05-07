-- Migration: Add equipped logo accessory slots to PublicProfile
-- Defaults are enabled for all existing and future users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'selected_face_asset'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN selected_face_asset text NOT NULL DEFAULT 'face_original';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'selected_plant_asset'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN selected_plant_asset text NOT NULL DEFAULT 'plant_leaf';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'selected_border_asset'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN selected_border_asset text NOT NULL DEFAULT 'border_original';
  END IF;

  UPDATE "PublicProfile"
  SET selected_face_asset = 'face_original'
  WHERE selected_face_asset IS NULL OR btrim(selected_face_asset) = '';

  UPDATE "PublicProfile"
  SET selected_plant_asset = 'plant_leaf'
  WHERE selected_plant_asset IS NULL OR btrim(selected_plant_asset) = '';

  UPDATE "PublicProfile"
  SET selected_border_asset = 'border_original'
  WHERE selected_border_asset IS NULL OR btrim(selected_border_asset) = '';
END;
$$;

NOTIFY pgrst, 'reload schema';

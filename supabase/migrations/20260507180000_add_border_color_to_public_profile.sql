-- Add selected_border_color column to "PublicProfile" for hex color tinting of the border accessory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'selected_border_color'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN selected_border_color text DEFAULT NULL;
  END IF;
END $$;

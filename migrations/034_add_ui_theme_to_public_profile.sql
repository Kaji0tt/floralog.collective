-- Migration 034: Add ui_theme preference to PublicProfile
-- This field stores the profile owner's preferred interface theme (light/dark).
-- When visitors browse a friend's profile pages, they see the friend's chosen theme.
-- NULL means no explicit preference (visitor's own theme is used as fallback).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'ui_theme'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN ui_theme TEXT DEFAULT NULL
      CONSTRAINT public_profile_ui_theme_check CHECK (ui_theme IS NULL OR ui_theme IN ('light', 'dark'));
  END IF;
END $$;

-- Migration 042: Add public_profile preference to PublicProfile
-- Replaces the 'weekly_tracking' setting semantics with a public profile toggle.
-- When true (default), non-friends who find the profile (e.g. via leaderboards)
-- can also see the user's collections and scans.
-- When false, only friends can see collections and scans.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PublicProfile' AND column_name = 'public_profile'
  ) THEN
    ALTER TABLE "PublicProfile"
      ADD COLUMN public_profile boolean NOT NULL DEFAULT true;
  END IF;
END;
$$;

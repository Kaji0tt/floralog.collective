-- 006_add_role_to_public_profile.sql
-- Add a simple role column to PublicProfile to support admin checks in the app.
-- Run this in Supabase before using the admin pages (AdminQuestCreator, NewsAdmin, AdminBackup, ...).

ALTER TABLE "PublicProfile"
  ADD COLUMN IF NOT EXISTS role text;

-- Example: promote specific users to admin (adapt the email addresses):
-- UPDATE "PublicProfile" SET role = 'admin' WHERE user_email IN (
--   'deine.mail@adresse.de',
--   'zweite.admin@adresse.de'
-- );

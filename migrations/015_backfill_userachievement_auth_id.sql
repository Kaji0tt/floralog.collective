-- Backfill missing auth_id values on legacy UserAchievement rows.
-- Matches UserAchievement.created_by (legacy Base44 email) against:
-- 1) PublicProfile.user_email
-- 2) User.email
-- and writes the corresponding auth_id when UserAchievement.auth_id is missing.
--
-- Note: auth_id is a UUID column. "0" is usually not a valid UUID value.
-- This migration therefore treats only NULL and the all-zero UUID as missing.

-- Prefer PublicProfile as source when available.
UPDATE public."UserAchievement" ua
SET auth_id = pp.auth_id
FROM public."PublicProfile" pp
WHERE lower(trim(ua.created_by)) = lower(trim(pp.user_email))
  AND pp.auth_id IS NOT NULL
  AND (
    ua.auth_id IS NULL
    OR ua.auth_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- Fallback to legacy User table for rows still missing auth_id.
UPDATE public."UserAchievement" ua
SET auth_id = u.auth_id
FROM public."User" u
WHERE lower(trim(ua.created_by)) = lower(trim(u.email))
  AND u.auth_id IS NOT NULL
  AND (
    ua.auth_id IS NULL
    OR ua.auth_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- Optional verification query:
-- SELECT id, created_by, auth_id
-- FROM public."UserAchievement"
-- WHERE auth_id IS NULL
-- ORDER BY created_by;

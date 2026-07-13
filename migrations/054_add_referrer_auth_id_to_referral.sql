-- Migration 054: Add referrer_auth_id to Referral table
--
-- Problem: When a referrer changes their email address, the Referral row still
-- holds the OLD referrer_email. grantRewards queries by current email → no match
-- → referral-based rewards (e.g. "Blush Face") are never unlocked for the referrer.
--
-- Fix: Store the referrer's auth_id durably on the Referral row.
-- grantRewards will then use: referrer_email ILIKE current_email OR referrer_auth_id = auth_id

ALTER TABLE public."Referral"
  ADD COLUMN IF NOT EXISTS referrer_auth_id uuid;

-- Backfill: resolve referrer_auth_id from PublicProfile where not yet set.
UPDATE public."Referral" r
SET referrer_auth_id = pp.auth_id
FROM public."PublicProfile" pp
WHERE r.referrer_auth_id IS NULL
  AND r.referrer_email IS NOT NULL
  AND LOWER(r.referrer_email) = LOWER(pp.user_email);

-- Index for efficient lookup in grantRewards fallback query.
CREATE INDEX IF NOT EXISTS idx_referral_referrer_auth_id
  ON public."Referral" (referrer_auth_id);

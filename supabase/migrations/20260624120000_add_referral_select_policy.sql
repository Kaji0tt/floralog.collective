-- Allow participants of a referral to read their own referral rows.
-- Previously RLS was enabled on "Referral" without a SELECT policy, so the
-- referrer could never see who they invited via the regular (anon) client.
-- This is required for the "invited by me" handshake marker in the friends list
-- and for the referral-based story unlock counter.

ALTER TABLE public."Referral" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_select_participant ON public."Referral";

CREATE POLICY referral_select_participant ON public."Referral"
  FOR SELECT
  TO authenticated
  USING (
    lower(coalesce(referrer_email, '')) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    OR lower(coalesce(referred_email, '')) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    OR auth_id = auth.uid()
  );

-- Allow authenticated users to read UserAchievement rows of their accepted friends.
-- The existing policy in 003 only allows reading own rows (auth.uid() = auth_id).
-- A second SELECT policy is additive (Supabase OR-combines multiple SELECT policies).

CREATE POLICY "Users can read accepted friends achievements"
  ON public."UserAchievement"
  FOR SELECT
  TO authenticated
  USING (
    auth_id IN (
      SELECT pp.auth_id
      FROM public."PublicProfile" pp
      INNER JOIN public."Friend" f
        ON (
          (f.request_sent_by = auth.email() AND f.request_sent_to = pp.user_email)
          OR
          (f.request_sent_to = auth.email() AND f.request_sent_by = pp.user_email)
        )
      WHERE f.status = 'accepted'
        AND pp.auth_id IS NOT NULL
    )
  );

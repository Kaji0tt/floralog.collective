-- Migration: add get_user_friends_public RPC
-- Allows viewing the accepted friends list of any user, bypassing the friend_select_participant
-- RLS policy that restricts Friend rows to the requesting user's own records.
-- Only returns non-sensitive fields (no internal IDs beyond what is already public).

CREATE OR REPLACE FUNCTION public.get_user_friends_public(p_user_auth_id uuid)
RETURNS TABLE (
  id           text,
  request_sent_by text,
  request_sent_to text,
  status       text,
  auth_id      uuid,
  created_date timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.request_sent_by,
    f.request_sent_to,
    f.status,
    f.auth_id,
    f.created_date
  FROM public."Friend" f
  JOIN public."PublicProfile" pp ON pp.auth_id = p_user_auth_id
  WHERE f.status = 'accepted'
    AND (
      lower(f.request_sent_by) = lower(coalesce(pp.user_email, ''))
      OR lower(f.request_sent_to) = lower(coalesce(pp.user_email, ''))
      OR f.auth_id = p_user_auth_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_friends_public(uuid) TO authenticated;

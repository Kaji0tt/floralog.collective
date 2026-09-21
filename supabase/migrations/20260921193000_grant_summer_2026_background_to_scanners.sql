-- Grant the Summer 2026 profile background to everyone who scanned during
-- the campaign period. The upper bound keeps 2026-09-21 fully inclusive.
-- Match by the stable player-facing reward key; the actual Rewards.id is used
-- when creating UserRewards rows.

DO $$
DECLARE
  v_reward_id text;
  v_reward_name text;
BEGIN
  SELECT reward.id, COALESCE(reward.display_name, reward.name, reward.value)
  INTO STRICT v_reward_id, v_reward_name
  FROM public."Rewards" AS reward
  WHERE reward.id IN (
       'profile_bg_background_sommer2026',
       'reward_profile_bg_sommer2026',
       'reward_profile_bg_background_sommer2026'
     )
     OR reward.name = 'profile_bg_background_sommer2026'
     OR reward.value = 'profile_bg_background_sommer2026';

  UPDATE public."Rewards"
  SET shop_hidden = true
  WHERE id = v_reward_id;

  INSERT INTO public."UserRewards" (
    auth_id,
    reward_id,
    reward_name,
    user_email,
    user_name,
    unlocked_date
  )
  SELECT
    profile.auth_id,
    v_reward_id,
    v_reward_name,
    profile.user_email,
    COALESCE(NULLIF(trim(profile.display_name), ''), NULLIF(trim(profile.full_name), '')),
    now()
  FROM public."PublicProfile" AS profile
  WHERE profile.auth_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."UserPlantDiscovery" AS discovery
      WHERE discovery.auth_id = profile.auth_id
        AND discovery.discovered_date >= '2026-06-21T00:00:00+00:00'
        AND discovery.discovered_date < '2026-09-22T00:00:00+00:00'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public."UserRewards" AS existing
      WHERE existing.auth_id = profile.auth_id
        AND existing.reward_id = v_reward_id
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
-- Backfill legacy selected profile backgrounds to the current background rewards.
-- Legacy bg_bush.png has no current counterpart, so it maps to water here.
-- Change the 'bush' row below before running if a different product mapping is intended.

BEGIN;

WITH legacy_to_current (legacy_key, current_key) AS (
  VALUES
    ('urban', 'urban'),
    ('forest', 'forest'),
    ('flowers', 'flowers'),
    ('bush', 'water')
),
legacy_profiles AS (
  SELECT
    profile.auth_id,
    profile.user_email,
    COALESCE(profile.display_name, profile.full_name, profile.user_email) AS user_name,
    mapping.current_key
  FROM public."PublicProfile" AS profile
  JOIN legacy_to_current AS mapping
    ON lower(trim(profile.background_image_url)) ~ (
      '/bg_' || mapping.legacy_key || '\\.(png|jpe?g|webp)([?#].*)?$'
    )
  WHERE profile.auth_id IS NOT NULL
),
current_rewards AS (
  SELECT
    mapping.current_key,
    reward.id AS reward_id,
    COALESCE(
      CASE
        WHEN trim(reward.value) ~* '^https?://' THEN trim(reward.value)
        ELSE NULL
      END,
      'https://blauzahn.eu/floralog/bg_' || mapping.current_key || '.png'
    ) AS background_url,
    reward.display_name,
    reward.name
  FROM legacy_to_current AS mapping
  JOIN public."Rewards" AS reward
    ON lower(trim(reward.name)) = 'profile_bg_background_' || mapping.current_key
    OR lower(trim(reward.value)) = 'profile_bg_background_' || mapping.current_key
    OR lower(trim(reward.id)) = 'reward_profile_bg_background_' || mapping.current_key
  WHERE reward.type = 'background'
),
matched_profiles AS (
  SELECT
    profile.auth_id,
    profile.user_email,
    profile.user_name,
    profile.current_key,
    reward.reward_id,
    reward.background_url,
    reward.display_name,
    reward.name
  FROM legacy_profiles AS profile
  JOIN current_rewards AS reward USING (current_key)
),
inserted_rewards AS (
  INSERT INTO public."UserRewards" (
    reward_id,
    reward_name,
    user_email,
    user_name,
    auth_id,
    unlocked_date
  )
  SELECT
    matched.reward_id,
    COALESCE(matched.display_name, matched.name, 'Profil-Hintergrund'),
    matched.user_email,
    matched.user_name,
    matched.auth_id,
    now()
  FROM matched_profiles AS matched
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."UserRewards" AS existing
    WHERE existing.auth_id = matched.auth_id
      AND existing.reward_id = matched.reward_id
  )
  RETURNING auth_id, reward_id
)
UPDATE public."PublicProfile" AS profile
SET
  background_image_url = matched.background_url,
  updated_date = now()
FROM matched_profiles AS matched
WHERE profile.auth_id = matched.auth_id;

COMMIT;

-- Add shop_hidden flag to Rewards table.
-- When true the reward is hidden from the shop UI and cannot be purchased.
-- Used by syncLogoAssets to mark rewards for legacy/retired assets.
ALTER TABLE public."Rewards"
  ADD COLUMN IF NOT EXISTS shop_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public."Rewards".shop_hidden IS
  'When true, the reward is hidden from the shop and purchases are blocked. Set automatically when the linked R2 asset is moved to legacy.';

NOTIFY pgrst, 'reload schema';

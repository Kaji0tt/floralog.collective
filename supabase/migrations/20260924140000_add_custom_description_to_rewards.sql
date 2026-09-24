-- Optional manually maintained copy for explaining a reward in the shop/customization menu.
ALTER TABLE public."Rewards"
  ADD COLUMN IF NOT EXISTS custom_description text;

COMMENT ON COLUMN public."Rewards".custom_description IS
  'Optional description shown in the shop and customization menu.';

NOTIFY pgrst, 'reload schema';
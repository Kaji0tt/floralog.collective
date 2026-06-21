-- Add legacy flag to LogoAsset table.
-- Legacy assets (face/plant) are still usable by users who already own them,
-- but they no longer appear in the Florabot shop for purchase or unlock.
-- To retire an asset, move it from custom_logo/ to custom_logo/legacy/ in R2.
alter table public."LogoAsset"
  add column if not exists legacy boolean not null default false;

comment on column public."LogoAsset".legacy is
  'When true the asset is retired from the shop. Already-owned instances remain selectable but new purchases/unlocks are blocked.';

notify pgrst, 'reload schema';

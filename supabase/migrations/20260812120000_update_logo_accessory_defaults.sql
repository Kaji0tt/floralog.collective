-- Switch PublicProfile default logo accessories to the new curated "default" starter set.
-- border_original/face_original are retired to legacy; existing profiles are NOT backfilled,
-- only new rows created after this migration receive the new defaults.
ALTER TABLE "PublicProfile"
  ALTER COLUMN selected_face_asset SET DEFAULT 'face_default';

ALTER TABLE "PublicProfile"
  ALTER COLUMN selected_border_asset SET DEFAULT 'border_default';

NOTIFY pgrst, 'reload schema';

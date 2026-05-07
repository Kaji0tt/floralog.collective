-- Migration: Catalog table for logo assets synced from Cloudflare R2.

CREATE TABLE IF NOT EXISTS "LogoAsset" (
  asset_id text PRIMARY KEY,
  asset_type text NOT NULL CHECK (asset_type IN ('face', 'plant', 'border')),
  file_name text NOT NULL,
  r2_key text NOT NULL,
  public_url text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  default_unlocked boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'r2',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS logo_asset_r2_key_idx ON "LogoAsset" (r2_key);
CREATE INDEX IF NOT EXISTS logo_asset_type_active_idx ON "LogoAsset" (asset_type, active);

ALTER TABLE "LogoAsset" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logo_asset_select_authenticated" ON "LogoAsset";
CREATE POLICY "logo_asset_select_authenticated"
ON "LogoAsset"
FOR SELECT
TO authenticated
USING (active = true);

NOTIFY pgrst, 'reload schema';

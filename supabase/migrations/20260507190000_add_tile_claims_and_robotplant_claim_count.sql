-- Add tile claim ownership table and claimed tile counter on RobotPlant

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RobotPlant'
      AND column_name = 'claimed_tiles_count'
  ) THEN
    ALTER TABLE public."RobotPlant"
      ADD COLUMN claimed_tiles_count integer NOT NULL DEFAULT 0;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public."TileClaim" (
  tile_x integer NOT NULL,
  tile_y integer NOT NULL,
  owner_auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_scan_count integer NOT NULL DEFAULT 0 CHECK (owner_scan_count >= 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tile_x, tile_y)
);

CREATE INDEX IF NOT EXISTS idx_tileclaim_owner_auth_id
  ON public."TileClaim" (owner_auth_id);

CREATE INDEX IF NOT EXISTS idx_tileclaim_updated_at
  ON public."TileClaim" (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at_tile_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_tile_claim ON public."TileClaim";
CREATE TRIGGER trg_set_updated_at_tile_claim
BEFORE UPDATE ON public."TileClaim"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_tile_claim();

ALTER TABLE public."TileClaim" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tileclaim_select_authenticated" ON public."TileClaim";
CREATE POLICY "tileclaim_select_authenticated"
  ON public."TileClaim"
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tileclaim_admin_manage" ON public."TileClaim";
CREATE POLICY "tileclaim_admin_manage"
  ON public."TileClaim"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."PublicProfile" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."PublicProfile" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';

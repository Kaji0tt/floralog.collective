--
-- PostgreSQL database dump
--

\restrict A8QAeOa6buJaiHIatXnD3g7ZEaoZuZmVS66ojfvIzgrf3SpewmziiOdDxOuvLrH

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507120000', '{"-- Migration: Add local_tracking preference to PublicProfile
-- Used for local map visibility. Defaults to true and backfills from legacy
-- weekly_tracking when that column still exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ''PublicProfile'' AND column_name = ''local_tracking''
  ) THEN
    ALTER TABLE \"PublicProfile\"
      ADD COLUMN local_tracking boolean NOT NULL DEFAULT true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ''PublicProfile'' AND column_name = ''weekly_tracking''
  ) THEN
    EXECUTE ''
      UPDATE \"PublicProfile\"
      SET local_tracking = COALESCE(weekly_tracking, true)
      WHERE local_tracking IS DISTINCT FROM COALESCE(weekly_tracking, true)
    '';
  END IF;
END;
$$","NOTIFY pgrst, ''reload schema''"}', 'add_local_tracking_to_public_profile');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507140000', '{"-- Allow all authenticated users to read discoveries from users who have local_tracking enabled.
-- Supabase OR-combines multiple SELECT policies, so this is additive to the existing
-- \"userplantdiscovery_select_own\" and \"read_own_and_friends_discoveries\" policies.

drop policy if exists \"discovery_select_local_tracking\" on public.\"UserPlantDiscovery\"","create policy \"discovery_select_local_tracking\"
  on public.\"UserPlantDiscovery\"
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.\"PublicProfile\" pp
      where pp.auth_id = \"UserPlantDiscovery\".auth_id
        and pp.local_tracking is not false
    )
  )","notify pgrst, ''reload schema''"}', 'add_discovery_local_tracking_rls');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507152000', '{"-- Migration: Add equipped logo accessory slots to PublicProfile
-- Defaults are enabled for all existing and future users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ''PublicProfile'' AND column_name = ''selected_face_asset''
  ) THEN
    ALTER TABLE \"PublicProfile\"
      ADD COLUMN selected_face_asset text NOT NULL DEFAULT ''face_original'';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ''PublicProfile'' AND column_name = ''selected_plant_asset''
  ) THEN
    ALTER TABLE \"PublicProfile\"
      ADD COLUMN selected_plant_asset text NOT NULL DEFAULT ''plant_leaf'';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ''PublicProfile'' AND column_name = ''selected_border_asset''
  ) THEN
    ALTER TABLE \"PublicProfile\"
      ADD COLUMN selected_border_asset text NOT NULL DEFAULT ''border_original'';
  END IF;

  UPDATE \"PublicProfile\"
  SET selected_face_asset = ''face_original''
  WHERE selected_face_asset IS NULL OR btrim(selected_face_asset) = '''';

  UPDATE \"PublicProfile\"
  SET selected_plant_asset = ''plant_leaf''
  WHERE selected_plant_asset IS NULL OR btrim(selected_plant_asset) = '''';

  UPDATE \"PublicProfile\"
  SET selected_border_asset = ''border_original''
  WHERE selected_border_asset IS NULL OR btrim(selected_border_asset) = '''';
END;
$$","NOTIFY pgrst, ''reload schema''"}', 'add_logo_accessories_to_public_profile');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507170000', '{"-- Migration: Catalog table for logo assets synced from Cloudflare R2.

CREATE TABLE IF NOT EXISTS \"LogoAsset\" (
  asset_id text PRIMARY KEY,
  asset_type text NOT NULL CHECK (asset_type IN (''face'', ''plant'', ''border'')),
  file_name text NOT NULL,
  r2_key text NOT NULL,
  public_url text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  default_unlocked boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT ''r2'',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)","CREATE UNIQUE INDEX IF NOT EXISTS logo_asset_r2_key_idx ON \"LogoAsset\" (r2_key)","CREATE INDEX IF NOT EXISTS logo_asset_type_active_idx ON \"LogoAsset\" (asset_type, active)","ALTER TABLE \"LogoAsset\" ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"logo_asset_select_authenticated\" ON \"LogoAsset\"","CREATE POLICY \"logo_asset_select_authenticated\"
ON \"LogoAsset\"
FOR SELECT
TO authenticated
USING (active = true)","NOTIFY pgrst, ''reload schema''"}', 'create_logo_asset_catalog');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507180000', '{"-- Add selected_border_color column to \"PublicProfile\" for hex color tinting of the border accessory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ''PublicProfile'' AND column_name = ''selected_border_color''
  ) THEN
    ALTER TABLE \"PublicProfile\"
      ADD COLUMN selected_border_color text DEFAULT NULL;
  END IF;
END $$"}', 'add_border_color_to_public_profile');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507190000', '{"-- Add tile claim ownership table and claimed tile counter on RobotPlant

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ''public''
      AND table_name = ''RobotPlant''
      AND column_name = ''claimed_tiles_count''
  ) THEN
    ALTER TABLE public.\"RobotPlant\"
      ADD COLUMN claimed_tiles_count integer NOT NULL DEFAULT 0;
  END IF;
END;
$$","CREATE TABLE IF NOT EXISTS public.\"TileClaim\" (
  tile_x integer NOT NULL,
  tile_y integer NOT NULL,
  owner_auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_scan_count integer NOT NULL DEFAULT 0 CHECK (owner_scan_count >= 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tile_x, tile_y)
)","CREATE INDEX IF NOT EXISTS idx_tileclaim_owner_auth_id
  ON public.\"TileClaim\" (owner_auth_id)","CREATE INDEX IF NOT EXISTS idx_tileclaim_updated_at
  ON public.\"TileClaim\" (updated_at DESC)","CREATE OR REPLACE FUNCTION public.set_updated_at_tile_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$","DROP TRIGGER IF EXISTS trg_set_updated_at_tile_claim ON public.\"TileClaim\"","CREATE TRIGGER trg_set_updated_at_tile_claim
BEFORE UPDATE ON public.\"TileClaim\"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_tile_claim()","ALTER TABLE public.\"TileClaim\" ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"tileclaim_select_authenticated\" ON public.\"TileClaim\"","CREATE POLICY \"tileclaim_select_authenticated\"
  ON public.\"TileClaim\"
  FOR SELECT
  TO authenticated
  USING (true)","DROP POLICY IF EXISTS \"tileclaim_admin_manage\" ON public.\"TileClaim\"","CREATE POLICY \"tileclaim_admin_manage\"
  ON public.\"TileClaim\"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.\"PublicProfile\" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = ''admin''
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.\"PublicProfile\" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = ''admin''
    )
  )","NOTIFY pgrst, ''reload schema''"}', 'add_tile_claims_and_robotplant_claim_count');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260507191000', '{"-- Backfill tile claims from existing UserPlantDiscovery rows.
-- Rules mirrored from runtime logic:
-- - Tile becomes claimable at >= 4 scans by one user
-- - On initial claim only unique top owner is inserted (ties remain unclaimed)
-- - Existing TileClaim rows are not overwritten

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions","WITH parsed_discoveries AS (
  SELECT
    upd.auth_id,
    extensions.ST_Transform(
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(
          split_part(upd.discovery_location, '','', 2)::double precision,
          split_part(upd.discovery_location, '','', 1)::double precision
        ),
        4326
      ),
      3035
    ) AS metric_geom
  FROM public.\"UserPlantDiscovery\" upd
  WHERE upd.auth_id IS NOT NULL
    AND upd.discovery_location IS NOT NULL
    AND position('','' IN upd.discovery_location) > 0
),
scan_counts_per_tile AS (
  SELECT
    floor(extensions.ST_X(metric_geom) / 100.0)::integer AS tile_x,
    floor(extensions.ST_Y(metric_geom) / 100.0)::integer AS tile_y,
    auth_id AS owner_auth_id,
    count(*)::integer AS owner_scan_count
  FROM parsed_discoveries
  GROUP BY 1, 2, 3
),
ranked_tile_owners_base AS (
  SELECT
    sct.tile_x,
    sct.tile_y,
    sct.owner_auth_id,
    sct.owner_scan_count,
    rank() OVER (
      PARTITION BY sct.tile_x, sct.tile_y
      ORDER BY sct.owner_scan_count DESC
    ) AS score_rank,
    max(sct.owner_scan_count) OVER (PARTITION BY sct.tile_x, sct.tile_y) AS max_owner_scan_count
  FROM scan_counts_per_tile sct
),
ranked_tile_owners AS (
  SELECT
    rtob.tile_x,
    rtob.tile_y,
    rtob.owner_auth_id,
    rtob.owner_scan_count,
    rtob.score_rank,
    sum(
      CASE
        WHEN rtob.owner_scan_count = rtob.max_owner_scan_count THEN 1
        ELSE 0
      END
    ) OVER (PARTITION BY rtob.tile_x, rtob.tile_y) AS top_owner_tie_count
  FROM ranked_tile_owners_base rtob
),
claimable_tiles AS (
  SELECT
    rto.tile_x,
    rto.tile_y,
    rto.owner_auth_id,
    rto.owner_scan_count,
    now() AS claimed_at,
    now() AS updated_at
  FROM ranked_tile_owners rto
  WHERE rto.score_rank = 1
    AND rto.owner_scan_count >= 4
    AND rto.top_owner_tie_count = 1
)
INSERT INTO public.\"TileClaim\" (
  tile_x,
  tile_y,
  owner_auth_id,
  owner_scan_count,
  claimed_at,
  updated_at
)
SELECT
  ct.tile_x,
  ct.tile_y,
  ct.owner_auth_id,
  ct.owner_scan_count,
  ct.claimed_at,
  ct.updated_at
FROM claimable_tiles ct
LEFT JOIN public.\"TileClaim\" existing
  ON existing.tile_x = ct.tile_x
 AND existing.tile_y = ct.tile_y
WHERE existing.tile_x IS NULL","-- Recompute claimed tile counters for users with RobotPlant rows.
WITH claim_counts AS (
  SELECT
    tc.owner_auth_id AS auth_id,
    count(*)::integer AS claimed_tiles_count
  FROM public.\"TileClaim\" tc
  GROUP BY tc.owner_auth_id
)
UPDATE public.\"RobotPlant\" rp
SET claimed_tiles_count = coalesce(cc.claimed_tiles_count, 0)
FROM claim_counts cc
WHERE rp.auth_id = cc.auth_id","UPDATE public.\"RobotPlant\" rp
SET claimed_tiles_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.\"TileClaim\" tc
  WHERE tc.owner_auth_id = rp.auth_id
)","NOTIFY pgrst, ''reload schema''"}', 'backfill_tile_claims_from_existing_scans');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20260508090000', '{"-- Global scan leaderboard RPC (bypasses discovery friend/public-profile RLS)
-- Returns aggregated scan counts per user for authenticated clients.

create or replace function public.get_global_scan_leaderboard()
returns table (
  auth_id uuid,
  user_email text,
  display_name text,
  full_name text,
  scan_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
    pp.display_name,
    pp.full_name,
    count(*)::bigint as scan_count
  from public.\"UserPlantDiscovery\" upd
  left join public.\"PublicProfile\" pp
    on pp.auth_id = upd.auth_id
  where upd.auth_id is not null
  group by
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having count(*) > 0
  order by count(*) desc;
$$","revoke all on function public.get_global_scan_leaderboard() from public","grant execute on function public.get_global_scan_leaderboard() to authenticated"}', 'add_global_scan_leaderboard_function');


--
-- PostgreSQL database dump complete
--

\unrestrict A8QAeOa6buJaiHIatXnD3g7ZEaoZuZmVS66ojfvIzgrf3SpewmziiOdDxOuvLrH


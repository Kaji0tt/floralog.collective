-- Backfill tile claims from existing UserPlantDiscovery rows.
-- Rules mirrored from runtime logic:
-- - Tile becomes claimable at >= 4 scans by one user
-- - On initial claim only unique top owner is inserted (ties remain unclaimed)
-- - Existing TileClaim rows are not overwritten

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

WITH parsed_discoveries AS (
  SELECT
    upd.auth_id,
    extensions.ST_Transform(
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(
          split_part(upd.discovery_location, ',', 2)::double precision,
          split_part(upd.discovery_location, ',', 1)::double precision
        ),
        4326
      ),
      3035
    ) AS metric_geom
  FROM public."UserPlantDiscovery" upd
  WHERE upd.auth_id IS NOT NULL
    AND upd.discovery_location IS NOT NULL
    AND position(',' IN upd.discovery_location) > 0
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
INSERT INTO public."TileClaim" (
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
LEFT JOIN public."TileClaim" existing
  ON existing.tile_x = ct.tile_x
 AND existing.tile_y = ct.tile_y
WHERE existing.tile_x IS NULL;

-- Recompute claimed tile counters for users with RobotPlant rows.
WITH claim_counts AS (
  SELECT
    tc.owner_auth_id AS auth_id,
    count(*)::integer AS claimed_tiles_count
  FROM public."TileClaim" tc
  GROUP BY tc.owner_auth_id
)
UPDATE public."RobotPlant" rp
SET claimed_tiles_count = coalesce(cc.claimed_tiles_count, 0)
FROM claim_counts cc
WHERE rp.auth_id = cc.auth_id;

UPDATE public."RobotPlant" rp
SET claimed_tiles_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public."TileClaim" tc
  WHERE tc.owner_auth_id = rp.auth_id
);

NOTIFY pgrst, 'reload schema';

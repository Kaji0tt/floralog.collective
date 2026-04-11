-- 030_fix_osm_tile_value_pk.sql
-- BUGFIX: Add zone_type to PRIMARY KEY for OSMTileValue
-- (Allows multiple zones per tile, which is the correct data model)

-- Drop old table with wrong PK
DROP TABLE IF EXISTS public."OSMTileValue" CASCADE;

-- Recreate with CORRECT primary key
CREATE TABLE IF NOT EXISTS public."OSMTileValue" (
  chunk_id UUID NOT NULL REFERENCES public."OSMTileChunkLite"(id) ON DELETE CASCADE,
  tile_local_x SMALLINT NOT NULL,
  tile_local_y SMALLINT NOT NULL,
  zone_type SMALLINT NOT NULL,  -- 0-5, refers to zone_type_enum position
  zone_value SMALLINT NOT NULL,  -- 0-255 (quantized from m2)
  PRIMARY KEY (chunk_id, tile_local_x, tile_local_y, zone_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_osm_tile_value_chunk_id
  ON public."OSMTileValue"(chunk_id);

CREATE INDEX IF NOT EXISTS idx_osm_tile_value_zone_type
  ON public."OSMTileValue"(zone_type);

CREATE INDEX IF NOT EXISTS idx_osm_tile_value_chunk_zone
  ON public."OSMTileValue"(chunk_id, zone_type);

COMMENT ON TABLE public."OSMTileValue" IS 'Tile zone data: local coordinates, quantized zone type (0-5), quantized zone area (0-255 scale). Multiple zones per tile supported.';

-- 029_create_osm_tile_lite_schema.sql
-- Slim OSM tile storage: relative coordinates, quantized zones, relational split
-- Target: ~3-4 bytes per tile instead of 10-15KB per chunk

-- Zone type enum (0-5)
-- 0 = forest, 1 = water, 2 = meadow, 3 = urban, 4 = beach, 5 = wetlands
CREATE TYPE zone_type_enum AS ENUM ('forest', 'water', 'meadow', 'urban', 'beach', 'wetlands');

-- Chunk metadata: minimal
CREATE TABLE IF NOT EXISTS public."OSMTileChunkLite" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version TEXT NOT NULL,
  chunk_x INTEGER NOT NULL,
  chunk_y INTEGER NOT NULL,
  tile_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one chunk per coordinate set per version
CREATE UNIQUE INDEX IF NOT EXISTS idx_osm_chunk_lite_unique
  ON public."OSMTileChunkLite"(dataset_version, chunk_x, chunk_y);

-- B-Tree index for efficient range queries
CREATE INDEX IF NOT EXISTS idx_osm_chunk_lite_version
  ON public."OSMTileChunkLite"(dataset_version);

CREATE INDEX IF NOT EXISTS idx_osm_chunk_lite_coords
  ON public."OSMTileChunkLite"(dataset_version, chunk_x, chunk_y);

-- Tile values: relational format, one row per tile with data
-- Quantized zone values: 0-255 (SMALLINT is 2 bytes, but allows 0-32767)
-- local coordinates: 0-9 (for 10x10 tile chunk) or 0-99 (for future larger chunks)
CREATE TABLE IF NOT EXISTS public."OSMTileValue" (
  chunk_id UUID NOT NULL REFERENCES public."OSMTileChunkLite"(id) ON DELETE CASCADE,
  tile_local_x SMALLINT NOT NULL,
  tile_local_y SMALLINT NOT NULL,
  zone_type SMALLINT NOT NULL,  -- 0-5, refers to zone_type_enum position
  zone_value SMALLINT NOT NULL,  -- 0-255 (quantized from m2)
  PRIMARY KEY (chunk_id, tile_local_x, tile_local_y)
);

-- Index for efficient lookups by chunk
CREATE INDEX IF NOT EXISTS idx_osm_tile_value_chunk_id
  ON public."OSMTileValue"(chunk_id);

-- Index for lookups by zone type (for analysis/filtering)
CREATE INDEX IF NOT EXISTS idx_osm_tile_value_zone_type
  ON public."OSMTileValue"(zone_type);

-- No RLS needed yet (backend-only data import)
-- Can add authenticated read access if needed later

COMMENT ON TABLE public."OSMTileChunkLite" IS 'Chunk metadata: dataset_version, grid coordinates, minimal overhead';
COMMENT ON TABLE public."OSMTileValue" IS 'Tile zone data: local coordinates, quantized zone type (0-5), quantized zone area (0-255 scale)';
COMMENT ON COLUMN public."OSMTileValue".zone_type IS 'Enum: 0=forest, 1=water, 2=meadow, 3=urban, 4=beach, 5=wetlands';
COMMENT ON COLUMN public."OSMTileValue".zone_value IS 'Quantized area: 0-255 scale (multiply by max_area_m2 / 255 to denormalize)';

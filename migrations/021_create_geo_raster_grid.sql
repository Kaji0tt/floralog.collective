-- 021_create_geo_raster_grid.sql
-- Phase 4: Raster-Based Geo Classification System
-- Pre-computed 0.5km² grid cells with OSM-derived theme classification
-- Eliminates live Overpass API calls, guarantees <100ms response times

-- ============================================================
-- 1) GeoRasterCell: Core raster grid table
-- ============================================================
-- Each cell represents a 0.5km² grid square (~707m per side)
-- Theme is pre-computed from OSM data based on land usage tags
create table if not exists public."GeoRasterCell" (
  id uuid primary key default gen_random_uuid(),
  
  -- Grid identification
  grid_id text not null unique, -- format: "{grid_lat_idx}_{grid_lng_idx}"
  grid_lat_idx integer not null,
  grid_lng_idx integer not null,
  
  -- Center coordinates of this cell
  center_lat numeric(9, 6) not null,
  center_lng numeric(9, 6) not null,
  geometry geometry(Point, 4326) not null, -- ST_Point(center_lng, center_lat)
  
  -- Theme derived from OSM data
  theme text not null check (theme in ('forest', 'water', 'urban', 'meadow')),
  
  -- Classification confidence (0.0 - 1.0)
  -- 1.0 = very certain (primary tag matches)
  -- 0.5-0.8 = moderate confidence (secondary or inferred)
  -- 0.3-0.5 = low confidence (mixed or ambiguous)
  theme_confidence numeric(3, 2) not null default 0.8,
  
  -- OSM source info (for debugging/transparency)
  dominant_osm_tags jsonb, -- e.g. {"natural": "forest", "landuse": "forest"}
  osm_element_count integer default 0, -- number of OSM elements contributing to this cell
  nearest_osm_element_distance_m integer default null, -- distance to nearest contributing OSM element
  
  -- Administrative regions (optional, for future filtering)
  country_code varchar(2) default null,
  admin_level_4 text default null, -- state/region
  
  -- Version control
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_osm_update_date date default null, -- when OSM data was last refreshed
  
  -- Boolean flags
  is_valid boolean not null default true, -- false if cell data is stale or questionable
  flagged_for_review boolean not null default false -- manual review flag
);

-- Indices for fast spatial and lookup queries
create index if not exists idx_geo_raster_grid_id on public."GeoRasterCell"(grid_id);
create index if not exists idx_geo_raster_theme on public."GeoRasterCell"(theme);
create index if not exists idx_geo_raster_geometry on public."GeoRasterCell" using gist(geometry);
create index if not exists idx_geo_raster_grid_coords on public."GeoRasterCell"(grid_lat_idx, grid_lng_idx);
create index if not exists idx_geo_raster_confidence on public."GeoRasterCell"(theme, theme_confidence desc);
create index if not exists idx_geo_raster_valid_theme on public."GeoRasterCell"(is_valid, theme);

-- ============================================================
-- 2) GeoRasterCellView: Fast radius lookup
-- ============================================================
-- This view will be used for fast ~5km radius lookups
-- Returns cells within a bounding box + distance check
-- Note: Function-based approach in queries is often faster

-- ============================================================
-- 3) RasterCellQueryLog: Track query performance
-- ============================================================
create table if not exists public."RasterCellQueryLog" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  query_date date not null,
  search_lat numeric(9, 6) not null,
  search_lng numeric(9, 6) not null,
  search_radius_m integer not null default 5000,
  cells_found integer not null,
  cells_by_theme jsonb, -- {"forest": 3, "water": 1, ...}
  query_duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_raster_query_log_auth_date 
  on public."RasterCellQueryLog"(auth_id, query_date);

-- ============================================================
-- 4) RLS Policies (read-only for users)
-- ============================================================
alter table public."GeoRasterCell" enable row level security;
alter table public."RasterCellQueryLog" enable row level security;

-- GeoRasterCell readable by all authenticated users
create policy "geo_raster_cell_select_public"
  on public."GeoRasterCell"
  for select
  to authenticated
  using (is_valid = true);

-- Query log only own records visible
create policy "raster_query_log_select_own"
  on public."RasterCellQueryLog"
  for select
  to authenticated
  using (auth.uid() = auth_id);

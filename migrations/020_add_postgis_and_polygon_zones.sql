-- 020_add_postgis_and_polygon_zones.sql
-- Phase 3: PostGIS Extension und Polygon-/Geometrie-Support für echte Zonen

create extension if not exists postgis;

-- ============================================================
-- 1) RobotPlantZone erweitern um Geometrie und Meta
-- ============================================================
alter table public."RobotPlantZone"
  add column if not exists geometry geometry(Geometry, 4326),
  add column if not exists geometry_type text,
  add column if not exists osm_source text,
  add column if not exists osm_id text,
  add column if not exists source_polygon_confidence numeric(4,3) default 1.0,
  add column if not exists clipped_from_polygon boolean default false,
  add column if not exists clipped_buffer_m integer default 50,
  add column if not exists source_area_m2 integer,
  add column if not exists playable_area_m2 integer,
  add column if not exists day_generated date;

-- Indizes für Geometrie und Queries
create index if not exists idx_robotplant_zone_geometry 
  on public."RobotPlantZone" 
  using gist(geometry);

create index if not exists idx_robotplant_zone_day_theme 
  on public."RobotPlantZone"(day_generated, theme);

-- ============================================================
-- 2) OSM-Kandidaten Basis (optional: vorerst nur zur Referenz)
-- ============================================================
-- Für künftige Skalierung: gecachte OSM-Features speichern
create table if not exists public."RobotPlantOSMCache" (
  id uuid primary key default gen_random_uuid(),
  theme text not null,
  osm_id text not null,
  osm_type text not null, -- 'way', 'relation'
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  geometry geometry(Geometry, 4326),
  area_m2 integer,
  confidence numeric(4,3) not null default 1.0,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(theme, osm_id)
);

create index if not exists idx_osm_cache_theme_area 
  on public."RobotPlantOSMCache"(theme, area_m2 desc);

-- ============================================================
-- 3) Zone-Generation Log (observability)
-- ============================================================
create table if not exists public."RobotPlantZoneGenerationLog" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  day_key date not null,
  search_radius_m integer,
  candidate_count_by_theme jsonb, -- {"forest": 5, "water": 2, ...}
  selected_zone_count integer,
  osm_cache_hits integer default 0,
  osm_live_queries integer default 0,
  osm_errors integer default 0,
  clipping_stats jsonb, -- {"clipped_count": 2, "rejected_count": 1}
  total_duration_ms integer,
  created_at timestamptz not null default now(),
  unique(auth_id, day_key)
);

create index if not exists idx_zone_gen_log_auth_day 
  on public."RobotPlantZoneGenerationLog"(auth_id, day_key);

-- ============================================================
-- 4) RLS Extension
-- ============================================================
alter table public."RobotPlantOSMCache" enable row level security;
alter table public."RobotPlantZoneGenerationLog" enable row level security;

-- OSM cache readable by all authenticated, no writes from client
create policy "osm_cache_select_public"
  on public."RobotPlantOSMCache"
  for select
  to authenticated
  using (true);

-- Zone generation log only own records visible
create policy "zone_gen_log_select_own"
  on public."RobotPlantZoneGenerationLog"
  for select
  to authenticated
  using (auth.uid() = auth_id);

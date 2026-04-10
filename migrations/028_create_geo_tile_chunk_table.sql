-- 028_create_geo_tile_chunk_table.sql
-- Stores upload-ready 1km chunk payloads built from 100m OSM tiles.

create table if not exists public."GeoTileChunk" (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  chunk_id text not null,
  chunk_x integer not null,
  chunk_y integer not null,
  tile_size_m integer not null default 100,
  chunk_size_tiles integer not null default 10,
  tile_count integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dataset_version, chunk_id)
);

create index if not exists idx_geo_tile_chunk_version
  on public."GeoTileChunk"(dataset_version);

create index if not exists idx_geo_tile_chunk_coords
  on public."GeoTileChunk"(dataset_version, chunk_x, chunk_y);

create index if not exists idx_geo_tile_chunk_payload_gin
  on public."GeoTileChunk" using gin (payload);

alter table public."GeoTileChunk" enable row level security;

create policy "geo_tile_chunk_select_authenticated"
  on public."GeoTileChunk"
  for select
  to authenticated
  using (true);

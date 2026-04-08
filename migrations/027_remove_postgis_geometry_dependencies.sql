-- 027_remove_postgis_geometry_dependencies.sql
-- Remove PostGIS-based geometry columns/indices now that circle-only zone logic is used.

-- 1) Drop spatial indexes that depend on geometry types.
drop index if exists public.idx_robotplant_zone_geometry;
drop index if exists public.idx_geo_raster_geometry;

-- 2) Drop geometry columns from tables that were introduced for PostGIS workflows.
alter table if exists public."RobotPlantZone"
  drop column if exists geometry;

alter table if exists public."RobotPlantOSMCache"
  drop column if exists geometry;

alter table if exists public."GeoRasterCell"
  drop column if exists geometry;

-- 3) Remove PostGIS extension after all dependent columns are gone.
drop extension if exists postgis;

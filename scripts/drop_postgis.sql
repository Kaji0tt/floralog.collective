drop index if exists public.idx_robotplant_zone_geometry;
drop index if exists public.idx_geo_raster_geometry;

alter table if exists public."RobotPlantZone" drop column if exists geometry;
alter table if exists public."RobotPlantOSMCache" drop column if exists geometry;
alter table if exists public."GeoRasterCell" drop column if exists geometry;

drop extension if exists postgis;

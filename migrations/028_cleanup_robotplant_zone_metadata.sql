-- 028_cleanup_robotplant_zone_metadata.sql
-- Remove obsolete metadata columns from RobotPlantZone after PostGIS/polygon rollback.

alter table if exists public."RobotPlantZone"
  drop column if exists geometry_type,
  drop column if exists osm_source,
  drop column if exists osm_id,
  drop column if exists source_polygon_confidence,
  drop column if exists clipped_from_polygon,
  drop column if exists clipped_buffer_m,
  drop column if exists source_area_m2,
  drop column if exists playable_area_m2;

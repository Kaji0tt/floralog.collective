-- Rename the player-facing tile claim contract to areas while preserving all claim data.
ALTER TABLE public."TileClaim" RENAME TO "AreaClaim";
ALTER TABLE public."AreaClaim" RENAME COLUMN tile_x TO area_x;
ALTER TABLE public."AreaClaim" RENAME COLUMN tile_y TO area_y;
ALTER TABLE public."RobotPlant" RENAME COLUMN claimed_tiles_count TO claimed_areas_count;
ALTER TABLE public."OSMTileChunkLite" RENAME TO "OSMAreaChunkLite";
ALTER TABLE public."OSMAreaChunkLite" RENAME COLUMN tile_count TO area_count;
ALTER TABLE public."OSMTileValue" RENAME TO "OSMAreaValue";
ALTER TABLE public."OSMAreaValue" RENAME COLUMN tile_local_x TO area_local_x;
ALTER TABLE public."OSMAreaValue" RENAME COLUMN tile_local_y TO area_local_y;

ALTER INDEX IF EXISTS public.idx_tileclaim_owner_auth_id RENAME TO idx_areaclaim_owner_auth_id;
ALTER INDEX IF EXISTS public.idx_tileclaim_updated_at RENAME TO idx_areaclaim_updated_at;
ALTER INDEX IF EXISTS public.idx_osm_tile_value_chunk_id RENAME TO idx_osm_area_value_chunk_id;
ALTER INDEX IF EXISTS public.idx_osm_tile_value_zone_type RENAME TO idx_osm_area_value_zone_type;
ALTER INDEX IF EXISTS public.idx_osm_tile_value_chunk_zone RENAME TO idx_osm_area_value_chunk_zone;
ALTER TABLE public."AreaClaim" RENAME CONSTRAINT tileclaim_claim_group_name_length TO areaclaim_claim_group_name_length;
ALTER TABLE public."OSMAreaValue" RENAME CONSTRAINT "OSMTileValue_pkey" TO "OSMAreaValue_pkey";
ALTER TABLE public."OSMAreaValue" RENAME CONSTRAINT "OSMTileValue_chunk_id_fkey" TO "OSMAreaValue_chunk_id_fkey";
ALTER POLICY "tileclaim_select_authenticated" ON public."AreaClaim" RENAME TO "areaclaim_select_authenticated";
ALTER POLICY "tileclaim_admin_manage" ON public."AreaClaim" RENAME TO "areaclaim_admin_manage";
ALTER TRIGGER trg_set_updated_at_tile_claim ON public."AreaClaim" RENAME TO trg_set_updated_at_area_claim;
ALTER FUNCTION public.set_updated_at_tile_claim() RENAME TO set_updated_at_area_claim;

NOTIFY pgrst, 'reload schema';

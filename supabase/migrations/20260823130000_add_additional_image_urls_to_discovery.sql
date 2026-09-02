-- 20260823130000_add_additional_image_urls_to_discovery.sql
-- Persists the extra photos (2nd/3rd) a player sends to PlantNet alongside the
-- primary image_url, so the collection can show every photo used to identify a plant.

alter table public."UserPlantDiscovery"
  add column if not exists additional_image_urls text[] not null default '{}'::text[];

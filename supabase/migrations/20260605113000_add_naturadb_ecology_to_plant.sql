-- Add NaturaDB ecology fields to Plant
-- All fields are nullable to allow graceful fallback when NaturaDB has no data.

alter table public."Plant"
  add column if not exists wild_bees_count integer,
  add column if not exists butterflies_count integer,
  add column if not exists caterpillars_count integer,
  add column if not exists hoverflies_count integer,
  add column if not exists beetles_count integer,
  add column if not exists red_list_threat text,
  add column if not exists red_list_population text,
  add column if not exists nectar_value text,
  add column if not exists pollen_value text,
  add column if not exists naturadb_url text,
  add column if not exists naturadb_synced_at timestamptz;
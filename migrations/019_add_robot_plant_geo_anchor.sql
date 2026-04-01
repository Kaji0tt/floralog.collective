-- 019_add_robot_plant_geo_anchor.sql
-- Phase 3: Datensparsame Positionsanker fuer taegliche Zonen-Generierung

alter table public."RobotPlant"
  add column if not exists last_valid_geo_lat numeric(8,3),
  add column if not exists last_valid_geo_lng numeric(8,3),
  add column if not exists last_valid_geo_at timestamptz;

create index if not exists idx_robotplant_last_valid_geo_at
  on public."RobotPlant"(last_valid_geo_at desc);

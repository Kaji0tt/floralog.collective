-- 031_add_reroll_count_to_zonegen_log.sql
-- Track multi-reroll budget per user per day in the zone generation log.
-- rerolls_granted_today: pre-decay snapshot of how many rerolls the user gets today (1 base + energy bonus)
-- reroll_count: how many times the user has already regenerated zones today

alter table public."RobotPlantZoneGenerationLog"
  add column if not exists rerolls_granted_today integer not null default 1,
  add column if not exists reroll_count integer not null default 0;

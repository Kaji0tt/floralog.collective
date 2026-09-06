-- 20260906120000_scan_streak_initial_jokers.sql
-- Scan-Streak: every streak now starts with 3 grace days (Joker) instead of
-- earning the first one on day 3. Boundary days (day 8, 15, 22, ...) grant 2.

alter table public."RobotPlant"
  alter column scan_streak_joker_count set default 3;

update public."RobotPlant"
  set scan_streak_joker_count = 3
  where coalesce(scan_streak_joker_count, 0) < 3;

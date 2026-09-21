-- 20260921193500_add_scan_streak_grace_days_downtime.sql
-- Compensate players for the login/season maintenance downtime by granting
-- 2 extra Scan-Streak Joker (grace days) to everyone with an active streak,
-- instead of special-casing the streak date logic for the downtime window.

update public."RobotPlant"
  set scan_streak_joker_count = scan_streak_joker_count + 2
  where streak_days > 0;

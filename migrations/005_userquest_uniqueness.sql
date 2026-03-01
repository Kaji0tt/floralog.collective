-- 005_userquest_uniqueness.sql
-- Ensure that each quest is only created once per user.
-- Run this in Supabase before deploying the updated code.

-- Regular quests: one row per (auth_id, quest_id)
CREATE UNIQUE INDEX IF NOT EXISTS userquest_auth_quest_unique
  ON "UserQuest" (auth_id, quest_id)
  WHERE auth_id IS NOT NULL AND quest_id IS NOT NULL;

-- Weekly quests: one row per (auth_id, weekly_quest_id, active_week)
CREATE UNIQUE INDEX IF NOT EXISTS userweeklyquest_auth_quest_week_unique
  ON "UserWeeklyQuest" (auth_id, weekly_quest_id, active_week)
  WHERE auth_id IS NOT NULL AND weekly_quest_id IS NOT NULL AND active_week IS NOT NULL;

-- Monthly quests: one row per (auth_id, monthly_quest_id, active_month)
CREATE UNIQUE INDEX IF NOT EXISTS usermonthlyquest_auth_quest_month_unique
  ON "UserMonthlyQuest" (auth_id, monthly_quest_id, active_month)
  WHERE auth_id IS NOT NULL AND monthly_quest_id IS NOT NULL AND active_month IS NOT NULL;

-- Collection quests: one row per (auth_id, collection_quest_id)
CREATE UNIQUE INDEX IF NOT EXISTS usercollectionquest_auth_collection_unique
  ON "UserCollectionQuest" (auth_id, collection_quest_id)
  WHERE auth_id IS NOT NULL AND collection_quest_id IS NOT NULL;

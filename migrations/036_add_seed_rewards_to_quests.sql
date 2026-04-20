-- 036_add_seed_rewards_to_quests.sql
-- Adds seed rewards for regular/weekly/monthly quests.
-- Backfills existing quests with fixed values:
--   Quest        -> 500
--   WeeklyQuest  -> 1500
--   MonthlyQuest -> 1000

ALTER TABLE public."Quest"
  ADD COLUMN IF NOT EXISTS seed_reward integer;

ALTER TABLE public."WeeklyQuest"
  ADD COLUMN IF NOT EXISTS seed_reward integer;

ALTER TABLE public."MonthlyQuest"
  ADD COLUMN IF NOT EXISTS seed_reward integer;

-- Existing quests requested by product:
UPDATE public."Quest"
SET seed_reward = 500;

UPDATE public."WeeklyQuest"
SET seed_reward = 1500;

UPDATE public."MonthlyQuest"
SET seed_reward = 1000;

-- Defaults for newly created quests.
ALTER TABLE public."Quest"
  ALTER COLUMN seed_reward SET DEFAULT 500;

ALTER TABLE public."WeeklyQuest"
  ALTER COLUMN seed_reward SET DEFAULT 1500;

ALTER TABLE public."MonthlyQuest"
  ALTER COLUMN seed_reward SET DEFAULT 1000;

ALTER TABLE public."Quest"
  ALTER COLUMN seed_reward SET NOT NULL;

ALTER TABLE public."WeeklyQuest"
  ALTER COLUMN seed_reward SET NOT NULL;

ALTER TABLE public."MonthlyQuest"
  ALTER COLUMN seed_reward SET NOT NULL;

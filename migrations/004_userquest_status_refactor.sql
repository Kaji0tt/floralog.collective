-- 004_userquest_status_refactor.sql
-- Introduce unified status-based quest model and denormalized quest_name
-- NOTE: Run this migration in Supabase before deploying the updated code.

-- 1) Add new columns to UserQuest
ALTER TABLE "UserQuest"
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quest_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Add new columns to UserWeeklyQuest
ALTER TABLE "UserWeeklyQuest"
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quest_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3) Add new columns to UserMonthlyQuest
ALTER TABLE "UserMonthlyQuest"
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quest_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 4) Create CollectionQuest and UserCollectionQuest tables if they do not exist yet

CREATE TABLE IF NOT EXISTS "CollectionQuest" (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  -- Array of plant IDs this collection quest targets
  target_plants text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_date text,
  updated_date text,
  created_by text
);

CREATE TABLE IF NOT EXISTS "UserCollectionQuest" (
  id text PRIMARY KEY,
  auth_id uuid,
  collection_quest_id text REFERENCES "CollectionQuest"(id) ON DELETE CASCADE,
  -- Status model and timestamps (new)
  status text,
  accepted_at timestamptz,
  completed_at timestamptz,
  redeemed_at timestamptz,
  quest_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Legacy style fields used by existing code
  accepted text,
  redeemed text,
  completed text,
  accepted_date text,
  completed_date text,
  redeemed_date text,
  discovered_plants text[] DEFAULT '{}',
  created_date text,
  updated_date text,
  created_by text,
  created_by_id text
);

-- 4b) Add new status/quest_name columns to UserCollectionQuest (for existing tables)
ALTER TABLE "UserCollectionQuest"
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quest_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5) Backfill status for existing rows based on legacy booleans
-- Mapping precedence: redeemed > completed > accepted

-- Regular quests
UPDATE "UserQuest" uq
SET status = CASE
    WHEN uq.redeemed::text = 'true' THEN 'redeemed'
    WHEN uq.completed::text = 'true' THEN 'completed'
    WHEN uq.accepted::text = 'true' THEN 'active'
    ELSE uq.status
  END,
  accepted_at = COALESCE(uq.accepted_at, uq.created_at),
  completed_at = uq.completed_at,
  redeemed_at = uq.redeemed_at,
  updated_at = now()
WHERE uq.status IS NULL
   OR uq.status = '';

-- Weekly quests
UPDATE "UserWeeklyQuest" uq
SET status = CASE
    WHEN uq.redeemed::text = 'true' THEN 'redeemed'
    WHEN uq.completed::text = 'true' THEN 'completed'
    WHEN uq.accepted::text = 'true' THEN 'active'
    ELSE uq.status
  END,
  accepted_at = COALESCE(uq.accepted_at, uq.created_at),
  completed_at = uq.completed_at,
  redeemed_at = uq.redeemed_at,
  updated_at = now()
WHERE uq.status IS NULL
   OR uq.status = '';

-- Monthly quests
UPDATE "UserMonthlyQuest" uq
SET status = CASE
    WHEN uq.redeemed::text = 'true' THEN 'redeemed'
    WHEN uq.completed::text = 'true' THEN 'completed'
    WHEN uq.accepted::text = 'true' THEN 'active'
    ELSE uq.status
  END,
  accepted_at = COALESCE(uq.accepted_at, uq.created_at),
  completed_at = uq.completed_at,
  redeemed_at = uq.redeemed_at,
  updated_at = now()
WHERE uq.status IS NULL
   OR uq.status = '';

-- Collection quests
UPDATE "UserCollectionQuest" uq
SET status = CASE
    WHEN uq.redeemed::text = 'true' THEN 'redeemed'
    WHEN uq.completed::text = 'true' THEN 'completed'
    WHEN uq.accepted::text = 'true' THEN 'active'
    ELSE uq.status
  END,
  accepted_at = COALESCE(uq.accepted_at, uq.created_at),
  completed_at = uq.completed_at,
  redeemed_at = uq.redeemed_at,
  updated_at = now()
WHERE uq.status IS NULL
   OR uq.status = '';

-- 6) Optionally backfill quest_name from current quest tables.
-- This is conservative and will only set quest_name where a matching quest row exists.

UPDATE "UserQuest" uq
SET quest_name = COALESCE(uq.quest_name, q.quest_number::text, q.title)
FROM "Quest" q
WHERE uq.quest_id = q.id
  AND uq.quest_id IS NOT NULL
  AND uq.quest_name IS NULL;

UPDATE "UserWeeklyQuest" uwq
SET quest_name = COALESCE(uwq.quest_name, q.quest_number::text, q.title)
FROM "WeeklyQuest" q
WHERE uwq.weekly_quest_id = q.id
  AND uwq.weekly_quest_id IS NOT NULL
  AND uwq.quest_name IS NULL;

UPDATE "UserMonthlyQuest" umq
SET quest_name = COALESCE(umq.quest_name, q.quest_number::text, q.title)
FROM "MonthlyQuest" q
WHERE umq.monthly_quest_id = q.id
  AND umq.monthly_quest_id IS NOT NULL
  AND umq.quest_name IS NULL;

UPDATE "UserCollectionQuest" ucq
SET quest_name = COALESCE(ucq.quest_name, q.title)
FROM "CollectionQuest" q
WHERE ucq.collection_quest_id = q.id
  AND ucq.collection_quest_id IS NOT NULL
  AND ucq.quest_name IS NULL;

-- NOTE: Dropping legacy columns (accepted, redeemed, completed, *_date, created_by_id)
-- is intentionally NOT done here to allow a safe transition period.

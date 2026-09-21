-- Season 2: Phase B – Geo-Zone Lootbox model and claim log
-- Purpose: separate weighted lootbox definitions from global Rewards catalog,
-- while keeping a retry-safe claim history for each zone completion.

CREATE TABLE IF NOT EXISTS public."ZoneLootboxPool" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_theme text NULL,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ZoneLootboxEntry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public."ZoneLootboxPool"(id) ON DELETE CASCADE,
  reward_id text NOT NULL REFERENCES public."Rewards"(id) ON DELETE RESTRICT,
  weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  duplicate_seed_value integer NOT NULL DEFAULT 0 CHECK (duplicate_seed_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ZoneLootboxClaim" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_id uuid NOT NULL REFERENCES public."ZoneLootboxPool"(id) ON DELETE CASCADE,
  claim_key text NOT NULL,
  reward_id text NULL REFERENCES public."Rewards"(id) ON DELETE RESTRICT,
  reward_status text NOT NULL DEFAULT 'granted' CHECK (reward_status IN ('granted', 'duplicate_compensated')),
  duplicate_seed_value integer NOT NULL DEFAULT 0 CHECK (duplicate_seed_value >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_id, claim_key)
);

CREATE INDEX IF NOT EXISTS idx_zone_lootbox_pool_theme
  ON public."ZoneLootboxPool" (zone_theme, is_active);

CREATE INDEX IF NOT EXISTS idx_zone_lootbox_entry_pool
  ON public."ZoneLootboxEntry" (pool_id, weight DESC);

CREATE INDEX IF NOT EXISTS idx_zone_lootbox_claim_auth
  ON public."ZoneLootboxClaim" (auth_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at_zone_lootbox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_zone_lootbox_pool ON public."ZoneLootboxPool";
CREATE TRIGGER trg_set_updated_at_zone_lootbox_pool
BEFORE UPDATE ON public."ZoneLootboxPool"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_zone_lootbox();

DROP TRIGGER IF EXISTS trg_set_updated_at_zone_lootbox_entry ON public."ZoneLootboxEntry";
CREATE TRIGGER trg_set_updated_at_zone_lootbox_entry
BEFORE UPDATE ON public."ZoneLootboxEntry"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_zone_lootbox();

ALTER TABLE public."ZoneLootboxPool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ZoneLootboxEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ZoneLootboxClaim" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zone_lootbox_pool_read_authenticated" ON public."ZoneLootboxPool";
CREATE POLICY "zone_lootbox_pool_read_authenticated"
  ON public."ZoneLootboxPool"
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "zone_lootbox_entry_read_authenticated" ON public."ZoneLootboxEntry";
CREATE POLICY "zone_lootbox_entry_read_authenticated"
  ON public."ZoneLootboxEntry"
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "zone_lootbox_claim_read_own" ON public."ZoneLootboxClaim";
CREATE POLICY "zone_lootbox_claim_read_own"
  ON public."ZoneLootboxClaim"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS "zone_lootbox_claim_insert_own" ON public."ZoneLootboxClaim";
CREATE POLICY "zone_lootbox_claim_insert_own"
  ON public."ZoneLootboxClaim"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "zone_lootbox_claim_update_own" ON public."ZoneLootboxClaim";
CREATE POLICY "zone_lootbox_claim_update_own"
  ON public."ZoneLootboxClaim"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

NOTIFY pgrst, 'reload schema';

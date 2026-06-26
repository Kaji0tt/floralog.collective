-- Migration: add robot plant pet-friend feature
-- Creates a log table + SECURITY DEFINER RPC for petting a friend's robot plant.

-- 1. Pet log table
CREATE TABLE IF NOT EXISTS public."RobotPlantPetLog" (
  id            bigserial PRIMARY KEY,
  actor_auth_id uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  friend_auth_id uuid       NOT NULL,
  pet_date      date        NOT NULL DEFAULT CURRENT_DATE,
  petted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_robot_plant_pet_log_actor_friend_date
  ON public."RobotPlantPetLog" (actor_auth_id, friend_auth_id, pet_date);

-- RLS: each user can only read/insert their own pet log rows
ALTER TABLE public."RobotPlantPetLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pet_log_select_own"
  ON public."RobotPlantPetLog" FOR SELECT
  USING (actor_auth_id = auth.uid());

CREATE POLICY "pet_log_insert_own"
  ON public."RobotPlantPetLog" FOR INSERT
  WITH CHECK (actor_auth_id = auth.uid());

-- 2. RPC: robot_plant_pet_friend
--    Increments a random attribute of the friend's RobotPlant by 3 (capped at 100).
--    Enforces max 3 pets per actor per friend per calendar day.
--    Returns: { attribute, new_value, pets_today } or { error, pets_today? }
CREATE OR REPLACE FUNCTION public.robot_plant_pet_friend(
  p_friend_auth_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_auth_id  uuid;
  v_today          date := CURRENT_DATE;
  v_pets_today     int;
  v_attribute      text;
  v_current_energy numeric;
  v_current_dq     numeric;
  v_current_care   numeric;
  v_new_value      numeric;
  v_rnd            float;
BEGIN
  v_actor_auth_id := auth.uid();
  IF v_actor_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Cannot pet yourself
  IF v_actor_auth_id = p_friend_auth_id THEN
    RETURN jsonb_build_object('error', 'cannot_pet_self');
  END IF;

  -- Count how many times actor has petted this friend today
  SELECT COUNT(*) INTO v_pets_today
  FROM public."RobotPlantPetLog"
  WHERE actor_auth_id = v_actor_auth_id
    AND friend_auth_id = p_friend_auth_id
    AND pet_date = v_today;

  IF v_pets_today >= 1 THEN
    RETURN jsonb_build_object('error', 'daily_limit_reached', 'pets_today', v_pets_today);
  END IF;

  -- Load friend's current robot plant
  SELECT energy, data_quality, care
  INTO v_current_energy, v_current_dq, v_current_care
  FROM public."RobotPlant"
  WHERE auth_id = p_friend_auth_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'friend_robot_plant_not_found');
  END IF;

  -- Pick a random attribute to boost
  v_rnd := random();
  IF v_rnd < 0.333 THEN
    v_attribute := 'energy';
    v_new_value := LEAST(100, COALESCE(v_current_energy, 0) + 3);
    UPDATE public."RobotPlant" SET energy = v_new_value WHERE auth_id = p_friend_auth_id;
  ELSIF v_rnd < 0.666 THEN
    v_attribute := 'data_quality';
    v_new_value := LEAST(100, COALESCE(v_current_dq, 0) + 3);
    UPDATE public."RobotPlant" SET data_quality = v_new_value WHERE auth_id = p_friend_auth_id;
  ELSE
    v_attribute := 'care';
    v_new_value := LEAST(100, COALESCE(v_current_care, 0) + 3);
    UPDATE public."RobotPlant" SET care = v_new_value WHERE auth_id = p_friend_auth_id;
  END IF;

  -- Log the pet
  INSERT INTO public."RobotPlantPetLog" (actor_auth_id, friend_auth_id, pet_date)
  VALUES (v_actor_auth_id, p_friend_auth_id, v_today);

  RETURN jsonb_build_object(
    'attribute', v_attribute,
    'new_value', v_new_value,
    'pets_today', v_pets_today + 1
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.robot_plant_pet_friend(uuid) TO authenticated;

-- 3. RPC: get_pet_friend_count_today
--    Returns how many times the current user has petted a specific friend today.
CREATE OR REPLACE FUNCTION public.get_pet_friend_count_today(
  p_friend_auth_id uuid
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public."RobotPlantPetLog"
  WHERE actor_auth_id = auth.uid()
    AND friend_auth_id = p_friend_auth_id
    AND pet_date = CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.get_pet_friend_count_today(uuid) TO authenticated;

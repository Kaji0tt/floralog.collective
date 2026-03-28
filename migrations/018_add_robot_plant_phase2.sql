-- 018_add_robot_plant_phase2.sql
-- Phase 2: Robot Plant data model, wallet ledger, RLS, idempotent server-side payout RPC

create extension if not exists pgcrypto;

----------------------------------------------------------
-- 1) Robot Plant state (one row per user)
----------------------------------------------------------
create table if not exists public."RobotPlant" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  energy integer not null default 70 check (energy between 0 and 100),
  data_quality integer not null default 65 check (data_quality between 0 and 100),
  care integer not null default 72 check (care between 0 and 100),
  streak_days integer not null default 0 check (streak_days >= 0),
  wallet_balance integer not null default 0 check (wallet_balance >= 0),
  last_maintenance_at timestamptz,
  last_decay_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_robotplant_auth_id on public."RobotPlant"(auth_id);

----------------------------------------------------------
-- 2) Wallet ledger (append-only booking log)
----------------------------------------------------------
create table if not exists public."RobotPlantWalletLedger" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  currency_code text not null default 'seed',
  direction text not null default 'credit' check (direction in ('credit', 'debit')),
  amount integer not null check (amount >= 0),
  event_source text not null,
  event_reference text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (auth_id, event_source, event_reference)
);

create index if not exists idx_robotplant_ledger_auth_id_created_at
  on public."RobotPlantWalletLedger"(auth_id, created_at desc);
create index if not exists idx_robotplant_ledger_event
  on public."RobotPlantWalletLedger"(event_source, event_reference);

----------------------------------------------------------
-- 3) Zones and per-user zone state
----------------------------------------------------------
create table if not exists public."RobotPlantZone" (
  id uuid primary key default gen_random_uuid(),
  zone_key text not null unique,
  title text not null,
  theme text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m integer not null check (radius_m > 0),
  zone_bonus_multiplier numeric(6,3) not null default 1.000,
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_robotplant_zone_active on public."RobotPlantZone"(is_active);

create table if not exists public."RobotPlantUserZoneState" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  zone_id uuid not null references public."RobotPlantZone"(id) on delete cascade,
  day_key date not null,
  scans_in_zone integer not null default 0 check (scans_in_zone >= 0),
  unique_species_count integer not null default 0 check (unique_species_count >= 0),
  last_scan_at timestamptz,
  created_at timestamptz not null default now(),
  unique (auth_id, zone_id, day_key)
);

create index if not exists idx_robotplant_userzonestate_auth_day
  on public."RobotPlantUserZoneState"(auth_id, day_key desc);

----------------------------------------------------------
-- 4) Daily challenge definitions and user progress
----------------------------------------------------------
create table if not exists public."RobotPlantDailyChallenge" (
  id uuid primary key default gen_random_uuid(),
  challenge_key text not null unique,
  title text not null,
  description text not null,
  challenge_type text not null,
  target_count integer not null default 1 check (target_count > 0),
  target_zone_theme text,
  reward_base integer not null default 0 check (reward_base >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_robotplant_dailychallenge_active
  on public."RobotPlantDailyChallenge"(is_active);

create table if not exists public."RobotPlantUserDailyChallenge" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public."RobotPlantDailyChallenge"(id) on delete cascade,
  challenge_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'claimed')),
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (auth_id, challenge_id, challenge_date)
);

create index if not exists idx_robotplant_userdaily_auth_date
  on public."RobotPlantUserDailyChallenge"(auth_id, challenge_date desc);

----------------------------------------------------------
-- 5) Shop, inventory, active effects
----------------------------------------------------------
create table if not exists public."RobotPlantShopItem" (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  title text not null,
  description text,
  item_type text not null,
  seed_cost integer not null check (seed_cost >= 0),
  effect_value numeric(8,3),
  duration_hours integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_robotplant_shopitem_active
  on public."RobotPlantShopItem"(is_active);

create table if not exists public."RobotPlantUserInventory" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public."RobotPlantShopItem"(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_id, item_id)
);

create index if not exists idx_robotplant_inventory_auth on public."RobotPlantUserInventory"(auth_id);

create table if not exists public."RobotPlantActiveEffect" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public."RobotPlantShopItem"(id) on delete set null,
  effect_type text not null,
  effect_value numeric(8,3) not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_event_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_robotplant_effect_auth_expires
  on public."RobotPlantActiveEffect"(auth_id, expires_at);

----------------------------------------------------------
-- 6) Updated-at trigger
----------------------------------------------------------
create or replace function public.set_updated_at_robot_plant()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_robotplant_updated_at on public."RobotPlant";
create trigger trg_robotplant_updated_at
before update on public."RobotPlant"
for each row execute function public.set_updated_at_robot_plant();

drop trigger if exists trg_robotplant_inventory_updated_at on public."RobotPlantUserInventory";
create trigger trg_robotplant_inventory_updated_at
before update on public."RobotPlantUserInventory"
for each row execute function public.set_updated_at_robot_plant();

----------------------------------------------------------
-- 7) RLS
----------------------------------------------------------
alter table public."RobotPlant" enable row level security;
alter table public."RobotPlantWalletLedger" enable row level security;
alter table public."RobotPlantZone" enable row level security;
alter table public."RobotPlantUserZoneState" enable row level security;
alter table public."RobotPlantDailyChallenge" enable row level security;
alter table public."RobotPlantUserDailyChallenge" enable row level security;
alter table public."RobotPlantShopItem" enable row level security;
alter table public."RobotPlantUserInventory" enable row level security;
alter table public."RobotPlantActiveEffect" enable row level security;

create policy "robotplant_select_own"
  on public."RobotPlant"
  for select
  to authenticated
  using (auth.uid() = auth_id);

create policy "robotplant_insert_own"
  on public."RobotPlant"
  for insert
  to authenticated
  with check (auth.uid() = auth_id);

create policy "robotplant_update_own"
  on public."RobotPlant"
  for update
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

create policy "robotplant_ledger_select_own"
  on public."RobotPlantWalletLedger"
  for select
  to authenticated
  using (auth.uid() = auth_id);

create policy "robotplant_userzonestate_select_own"
  on public."RobotPlantUserZoneState"
  for select
  to authenticated
  using (auth.uid() = auth_id);

create policy "robotplant_userzonestate_manage_own"
  on public."RobotPlantUserZoneState"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

create policy "robotplant_dailychallenge_select_active"
  on public."RobotPlantDailyChallenge"
  for select
  to authenticated
  using (is_active = true);

create policy "robotplant_userdaily_select_own"
  on public."RobotPlantUserDailyChallenge"
  for select
  to authenticated
  using (auth.uid() = auth_id);

create policy "robotplant_userdaily_manage_own"
  on public."RobotPlantUserDailyChallenge"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

create policy "robotplant_shopitem_select_active"
  on public."RobotPlantShopItem"
  for select
  to authenticated
  using (is_active = true);

create policy "robotplant_inventory_select_own"
  on public."RobotPlantUserInventory"
  for select
  to authenticated
  using (auth.uid() = auth_id);

create policy "robotplant_inventory_manage_own"
  on public."RobotPlantUserInventory"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

create policy "robotplant_effect_select_own"
  on public."RobotPlantActiveEffect"
  for select
  to authenticated
  using (auth.uid() = auth_id);

----------------------------------------------------------
-- 8) Atomic payout RPC (server-side)
----------------------------------------------------------
create or replace function public.robot_plant_grant_reward(
  p_auth_id uuid,
  p_event_source text,
  p_event_reference text,
  p_amount integer,
  p_energy_delta integer default 0,
  p_data_quality_delta integer default 0,
  p_care_delta integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  ledger_id uuid,
  new_balance integer,
  energy integer,
  data_quality integer,
  care integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_id uuid;
  v_inserted integer;
  v_robotplant public."RobotPlant"%rowtype;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;
  if coalesce(length(trim(p_event_source)), 0) = 0 then
    raise exception 'p_event_source is required';
  end if;
  if coalesce(length(trim(p_event_reference)), 0) = 0 then
    raise exception 'p_event_reference is required';
  end if;
  if p_amount < 0 then
    raise exception 'p_amount must be >= 0';
  end if;

  insert into public."RobotPlant" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  insert into public."RobotPlantWalletLedger" (
    auth_id,
    currency_code,
    direction,
    amount,
    event_source,
    event_reference,
    metadata
  )
  values (
    p_auth_id,
    'seed',
    case when p_amount = 0 then 'credit' else 'credit' end,
    p_amount,
    p_event_source,
    p_event_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (auth_id, event_source, event_reference) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
      into v_robotplant
      from public."RobotPlant"
      where auth_id = p_auth_id
      limit 1;

    return query
    select
      false as applied,
      null::uuid as ledger_id,
      v_robotplant.wallet_balance,
      v_robotplant.energy,
      v_robotplant.data_quality,
      v_robotplant.care;
    return;
  end if;

  update public."RobotPlant"
  set
    wallet_balance = greatest(0, wallet_balance + p_amount),
    energy = least(100, greatest(0, energy + p_energy_delta)),
    data_quality = least(100, greatest(0, data_quality + p_data_quality_delta)),
    care = least(100, greatest(0, care + p_care_delta)),
    updated_at = now()
  where auth_id = p_auth_id
  returning * into v_robotplant;

  return query
  select
    true as applied,
    v_ledger_id,
    v_robotplant.wallet_balance,
    v_robotplant.energy,
    v_robotplant.data_quality,
    v_robotplant.care;
end;
$$;

grant execute on function public.robot_plant_grant_reward(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  jsonb
) to authenticated, service_role;

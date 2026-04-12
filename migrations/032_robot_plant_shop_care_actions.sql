-- 032_robot_plant_shop_care_actions.sql
-- Adds shop seed data and server-side actions for purchase, item activation, and watering.

----------------------------------------------------------
-- 1) Shop seed data (fertilizers + placeholders)
----------------------------------------------------------
insert into public."RobotPlantShopItem" (
  item_key,
  title,
  description,
  item_type,
  seed_cost,
  effect_value,
  duration_hours,
  is_active
)
values
  (
    'fertilizer_basic',
    'Duenger',
    'Reduziert taeglichen Verfall kurzfristig.',
    'fertilizer',
    45,
    0.15,
    12,
    true
  ),
  (
    'fertilizer_longterm',
    'Langzeitduenger',
    'Reduziert taeglichen Verfall fuer einen laengeren Zeitraum.',
    'fertilizer',
    90,
    0.25,
    24,
    true
  ),
  (
    'accessory_placeholder',
    'Accessoire-Slot (Platzhalter)',
    'V1 Platzhalter fuer zukuenftige Pflanzen-Accessoires.',
    'accessory',
    40,
    null,
    null,
    true
  ),
  (
    'background_placeholder',
    'Hintergrund-Slot (Platzhalter)',
    'V1 Platzhalter fuer zukuenftige Hintergruende.',
    'background',
    40,
    null,
    null,
    true
  )
on conflict (item_key)
do update set
  title = excluded.title,
  description = excluded.description,
  item_type = excluded.item_type,
  seed_cost = excluded.seed_cost,
  effect_value = excluded.effect_value,
  duration_hours = excluded.duration_hours,
  is_active = excluded.is_active;

----------------------------------------------------------
-- 2) Daily watering tracker
----------------------------------------------------------
create table if not exists public."RobotPlantDailyCareAction" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  day_key date not null,
  watering_count integer not null default 0 check (watering_count >= 0 and watering_count <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_id, day_key)
);

create index if not exists idx_robotplant_dailycare_auth_day
  on public."RobotPlantDailyCareAction"(auth_id, day_key desc);

alter table public."RobotPlantDailyCareAction" enable row level security;

create policy "robotplant_dailycare_select_own"
  on public."RobotPlantDailyCareAction"
  for select
  to authenticated
  using (auth.uid() = auth_id);

create policy "robotplant_dailycare_manage_own"
  on public."RobotPlantDailyCareAction"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

drop trigger if exists trg_robotplant_dailycare_updated_at on public."RobotPlantDailyCareAction";
create trigger trg_robotplant_dailycare_updated_at
before update on public."RobotPlantDailyCareAction"
for each row execute function public.set_updated_at_robot_plant();

----------------------------------------------------------
-- 3) Missing write policy for active effects
----------------------------------------------------------
create policy "robotplant_effect_manage_own"
  on public."RobotPlantActiveEffect"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

----------------------------------------------------------
-- 4) Atomic purchase RPC
----------------------------------------------------------
create or replace function public.robot_plant_purchase_item(
  p_auth_id uuid,
  p_item_id uuid,
  p_quantity integer default 1,
  p_event_reference text default null
)
returns table (
  applied boolean,
  error_code text,
  ledger_id uuid,
  inventory_id uuid,
  new_balance integer,
  new_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public."RobotPlantShopItem"%rowtype;
  v_robotplant public."RobotPlant"%rowtype;
  v_total_cost integer;
  v_ledger_id uuid;
  v_inventory_id uuid;
  v_inventory_qty integer;
  v_event_reference text;
  v_inserted integer;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;
  if p_item_id is null then
    raise exception 'p_item_id is required';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'p_quantity must be > 0';
  end if;

  select *
    into v_item
    from public."RobotPlantShopItem"
   where id = p_item_id
     and is_active = true
   limit 1;

  if not found then
    return query select false, 'item_not_found'::text, null::uuid, null::uuid, null::integer, null::integer;
    return;
  end if;

  insert into public."RobotPlant" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  select *
    into v_robotplant
    from public."RobotPlant"
   where auth_id = p_auth_id
   for update;

  v_total_cost := v_item.seed_cost * p_quantity;

  if v_robotplant.wallet_balance < v_total_cost then
    return query select false, 'insufficient_balance'::text, null::uuid, null::uuid, v_robotplant.wallet_balance, null::integer;
    return;
  end if;

  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('purchase-', p_item_id::text, '-', date_trunc('second', now())::text));

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
    'debit',
    v_total_cost,
    'shop_purchase',
    v_event_reference,
    jsonb_build_object(
      'item_id', p_item_id,
      'item_key', v_item.item_key,
      'quantity', p_quantity,
      'unit_cost', v_item.seed_cost,
      'total_cost', v_total_cost
    )
  )
  on conflict (auth_id, event_source, event_reference) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select quantity
      into v_inventory_qty
      from public."RobotPlantUserInventory"
     where auth_id = p_auth_id
       and item_id = p_item_id
     limit 1;

    return query
    select false, 'duplicate_event_reference'::text, null::uuid, null::uuid, v_robotplant.wallet_balance, coalesce(v_inventory_qty, 0);
    return;
  end if;

  update public."RobotPlant"
     set wallet_balance = wallet_balance - v_total_cost,
         updated_at = now()
   where auth_id = p_auth_id
   returning * into v_robotplant;

  insert into public."RobotPlantUserInventory" (
    auth_id,
    item_id,
    quantity
  )
  values (
    p_auth_id,
    p_item_id,
    p_quantity
  )
  on conflict (auth_id, item_id)
  do update set
    quantity = public."RobotPlantUserInventory".quantity + excluded.quantity,
    updated_at = now()
  returning id, quantity into v_inventory_id, v_inventory_qty;

  return query
  select true, null::text, v_ledger_id, v_inventory_id, v_robotplant.wallet_balance, v_inventory_qty;
end;
$$;

grant execute on function public.robot_plant_purchase_item(uuid, uuid, integer, text) to authenticated;

----------------------------------------------------------
-- 5) Atomic item activation RPC
----------------------------------------------------------
create or replace function public.robot_plant_use_inventory_item(
  p_auth_id uuid,
  p_item_id uuid,
  p_event_reference text default null
)
returns table (
  applied boolean,
  error_code text,
  remaining_quantity integer,
  effect_type text,
  effect_value numeric,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public."RobotPlantUserInventory"%rowtype;
  v_item public."RobotPlantShopItem"%rowtype;
  v_event_reference text;
  v_effect_expiry timestamptz;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;
  if p_item_id is null then
    raise exception 'p_item_id is required';
  end if;

  select *
    into v_item
    from public."RobotPlantShopItem"
   where id = p_item_id
     and is_active = true
   limit 1;

  if not found then
    return query select false, 'item_not_found'::text, null::integer, null::text, null::numeric, null::timestamptz;
    return;
  end if;

  select *
    into v_inventory
    from public."RobotPlantUserInventory"
   where auth_id = p_auth_id
     and item_id = p_item_id
   for update;

  if not found or coalesce(v_inventory.quantity, 0) <= 0 then
    return query select false, 'inventory_empty'::text, 0, null::text, null::numeric, null::timestamptz;
    return;
  end if;

  if v_item.effect_value is null or v_item.duration_hours is null then
    return query select false, 'item_has_no_effect'::text, v_inventory.quantity, null::text, null::numeric, null::timestamptz;
    return;
  end if;

  update public."RobotPlantUserInventory"
     set quantity = quantity - 1,
         updated_at = now()
   where id = v_inventory.id
   returning * into v_inventory;

  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('use-', p_item_id::text, '-', date_trunc('second', now())::text));
  v_effect_expiry := now() + make_interval(hours => v_item.duration_hours);

  insert into public."RobotPlantActiveEffect" (
    auth_id,
    item_id,
    effect_type,
    effect_value,
    expires_at,
    source_event_reference
  )
  values (
    p_auth_id,
    p_item_id,
    case
      when v_item.item_type = 'fertilizer' then 'decay_reduction'
      else 'generic'
    end,
    v_item.effect_value,
    v_effect_expiry,
    v_event_reference
  );

  return query
  select true, null::text, v_inventory.quantity, case when v_item.item_type = 'fertilizer' then 'decay_reduction' else 'generic' end, v_item.effect_value, v_effect_expiry;
end;
$$;

grant execute on function public.robot_plant_use_inventory_item(uuid, uuid, text) to authenticated;

----------------------------------------------------------
-- 6) Watering RPC (3/day: +3, +2, +1)
----------------------------------------------------------
create or replace function public.robot_plant_water_plant(
  p_auth_id uuid,
  p_event_reference text default null
)
returns table (
  applied boolean,
  error_code text,
  care_delta integer,
  remaining_waters_today integer,
  watering_count_today integer,
  new_care integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_daily_row public."RobotPlantDailyCareAction"%rowtype;
  v_robotplant public."RobotPlant"%rowtype;
  v_next_count integer;
  v_care_delta integer;
  v_event_reference text;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  insert into public."RobotPlant" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  select *
    into v_daily_row
    from public."RobotPlantDailyCareAction"
   where auth_id = p_auth_id
     and day_key = v_today
   for update;

  if not found then
    insert into public."RobotPlantDailyCareAction" (
      auth_id,
      day_key,
      watering_count
    )
    values (
      p_auth_id,
      v_today,
      0
    )
    returning * into v_daily_row;
  end if;

  if v_daily_row.watering_count >= 3 then
    select * into v_robotplant
      from public."RobotPlant"
     where auth_id = p_auth_id
     limit 1;

    return query
    select false, 'daily_limit_reached'::text, 0, 0, v_daily_row.watering_count, v_robotplant.care;
    return;
  end if;

  v_next_count := v_daily_row.watering_count + 1;
  v_care_delta := case
    when v_next_count = 1 then 3
    when v_next_count = 2 then 2
    else 1
  end;

  update public."RobotPlantDailyCareAction"
     set watering_count = v_next_count,
         updated_at = now()
   where id = v_daily_row.id
   returning * into v_daily_row;

  update public."RobotPlant"
     set care = least(100, care + v_care_delta),
         last_maintenance_at = now(),
         updated_at = now()
   where auth_id = p_auth_id
   returning * into v_robotplant;

  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('water-', date_trunc('second', now())::text));

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
    'credit',
    0,
    'water_plant',
    v_event_reference,
    jsonb_build_object(
      'care_delta', v_care_delta,
      'watering_count_today', v_next_count
    )
  )
  on conflict (auth_id, event_source, event_reference) do nothing;

  return query
  select true, null::text, v_care_delta, (3 - v_next_count), v_next_count, v_robotplant.care;
end;
$$;

grant execute on function public.robot_plant_water_plant(uuid, text) to authenticated;

--
-- PostgreSQL database dump
--

\restrict MzDJPUEDFDJLR0cQLN5Ickx9bN8S60wTgNTJYpJ0CVBXtcd0Om7Vb6XtIZY2iKs

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


--
-- Name: zone_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.zone_type_enum AS ENUM (
    'forest',
    'water',
    'meadow',
    'urban',
    'beach',
    'wetlands'
);


--
-- Name: claim_daily_login_sparks(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_daily_login_sparks(p_auth_id uuid, p_event_reference text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(applied boolean, awarded_amount integer, streak_days integer, sparks_balance integer, claim_date date)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := current_date;
  v_yesterday date := (current_date - interval '1 day')::date;
  v_state public."UserEngagementState"%rowtype;
  v_wallet_result record;
  v_event_reference text;
  v_streak integer;
  v_award integer;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  insert into public."UserEngagementState" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  select *
    into v_state
    from public."UserEngagementState"
    where auth_id = p_auth_id
    for update;

  if v_state.last_daily_login_claim_date = v_today then
    insert into public."UserWallet" (auth_id)
    values (p_auth_id)
    on conflict (auth_id) do nothing;

    return query
    select
      false,
      0,
      coalesce(v_state.login_streak_days, 0),
      (select uw.sparks_balance from public."UserWallet" uw where uw.auth_id = p_auth_id),
      v_today;
    return;
  end if;

  if v_state.last_login_date = v_yesterday then
    v_streak := least(coalesce(v_state.login_streak_days, 0) + 1, 3);
  else
    v_streak := 1;
  end if;

  v_award := v_streak;
  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('daily-login:', v_today::text));

  select *
    into v_wallet_result
    from public.wallet_grant_currency(
      p_auth_id,
      'sparks',
      'daily_login_spark',
      v_event_reference,
      v_award,
      'credit',
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'streak_days', v_streak,
        'claim_date', v_today
      )
    );

  update public."UserEngagementState"
  set
    last_login_date = v_today,
    last_daily_login_claim_date = v_today,
    login_streak_days = v_streak,
    updated_at = now()
  where auth_id = p_auth_id;

  return query
  select
    coalesce(v_wallet_result.applied, false),
    case when coalesce(v_wallet_result.applied, false) then v_award else 0 end,
    v_streak,
    coalesce(v_wallet_result.sparks_balance, 0),
    v_today;
end;
$$;


--
-- Name: decrement_collection_followers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_collection_followers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public."Collection"
  set followers_count = greatest(coalesce(followers_count, 0) - 1, 0)
  where id = old.collection_id;

  return old;
end;
$$;


--
-- Name: get_community_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_community_stats() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'active_researchers_this_month',
    (
      select count(distinct auth_id)
      from public."UserPlantDiscovery"
      where discovered_date::timestamptz >= date_trunc('month', now())
        and auth_id is not null
    ),
    'total_species',
    (
      select count(*) from public."PlantGenus"
    ),
    'total_scans',
    (
      select count(*) from public."UserPlantDiscovery"
    )
  );
$$;


--
-- Name: get_global_scan_leaderboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_global_scan_leaderboard() RETURNS TABLE(auth_id uuid, user_email text, display_name text, full_name text, scan_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
    pp.display_name,
    pp.full_name,
    count(*)::bigint as scan_count
  from public."UserPlantDiscovery" upd
  left join public."PublicProfile" pp
    on pp.auth_id = upd.auth_id
  where upd.auth_id is not null
  group by
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having count(*) > 0
  order by count(*) desc;
$$;


--
-- Name: get_highest_scan_results_leaderboard(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_highest_scan_results_leaderboard(p_limit integer DEFAULT 50) RETURNS TABLE(auth_id uuid, user_email text, display_name text, full_name text, reward_amount integer, event_source text, event_reference text, awarded_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scan_rewards as (
    select
      l.auth_id,
      lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
      pp.display_name,
      pp.full_name,
      l.amount::integer as reward_amount,
      l.event_source,
      l.event_reference,
      l.created_at as awarded_at,
      row_number() over (
        partition by l.auth_id
        order by l.amount desc, l.created_at desc
      ) as rn
    from public."RobotPlantWalletLedger" l
    left join public."PublicProfile" pp
      on pp.auth_id = l.auth_id
    left join public."UserPlantDiscovery" upd
      on upd.id::text = l.event_reference
    where l.auth_id is not null
      and l.currency_code = 'seed'
      and l.direction = 'credit'
      and l.amount > 0
      and l.event_source in ('scan', 'new_scan', 'new_global_scan')
  )
  select
    auth_id,
    user_email,
    display_name,
    full_name,
    reward_amount,
    event_source,
    event_reference,
    awarded_at
  from scan_rewards
  where rn = 1
  order by reward_amount desc, awarded_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;


--
-- Name: increment_collection_followers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_collection_followers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public."Collection"
  set followers_count = coalesce(followers_count, 0) + 1
  where id = new.collection_id;

  return new;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: robot_plant_grant_reward(uuid, text, text, integer, integer, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_grant_reward(p_auth_id uuid, p_event_source text, p_event_reference text, p_amount integer, p_energy_delta integer DEFAULT 0, p_data_quality_delta integer DEFAULT 0, p_care_delta integer DEFAULT 0, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(applied boolean, ledger_id uuid, new_balance integer, new_energy integer, new_data_quality integer, new_care integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    'credit',
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
    energy        = least(100, greatest(0, energy        + p_energy_delta)),
    data_quality  = least(100, greatest(0, data_quality  + p_data_quality_delta)),
    care          = least(100, greatest(0, care          + p_care_delta)),
    updated_at    = now()
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


--
-- Name: robot_plant_purchase_item(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_purchase_item(p_auth_id uuid, p_item_id uuid, p_quantity integer DEFAULT 1, p_event_reference text DEFAULT NULL::text) RETURNS TABLE(applied boolean, error_code text, ledger_id uuid, inventory_id uuid, new_balance integer, new_quantity integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: robot_plant_use_inventory_item(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_use_inventory_item(p_auth_id uuid, p_item_id uuid, p_event_reference text DEFAULT NULL::text) RETURNS TABLE(applied boolean, error_code text, remaining_quantity integer, effect_type text, effect_value numeric, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  if v_item.item_type = 'fertilizer' then
    delete from public."RobotPlantActiveEffect" ae
     where ae.auth_id = p_auth_id
       and ae.effect_type = 'decay_reduction'
       and ae.expires_at >= now();
  end if;

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


--
-- Name: robot_plant_water_plant(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_water_plant(p_auth_id uuid, p_event_reference text DEFAULT NULL::text) RETURNS TABLE(applied boolean, error_code text, care_delta integer, remaining_waters_today integer, watering_count_today integer, new_care integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: set_collectionitem_readable_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_collectionitem_readable_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_collection_title text;
  v_plant_name text;
  v_genus_name text;
begin
  select c.title
    into v_collection_title
  from public."Collection" c
  where c.id = new.collection_id;

  if new.plant_id is not null then
    select p.species_name
      into v_plant_name
    from public."Plant" p
    where p.id = new.plant_id;
  else
    v_plant_name := null;
  end if;

  if new.genus_id is not null then
    select pg.genus_name
      into v_genus_name
    from public."PlantGenus" pg
    where pg.id = new.genus_id;
  elsif new.plant_id is not null then
    select pg.genus_name
      into v_genus_name
    from public."Plant" p
    join public."PlantGenus" pg
      on pg.category = p.genus_category
     and pg.category_dex_number = p.genus_number
    where p.id = new.plant_id;
  else
    v_genus_name := null;
  end if;

  new.collection_title := v_collection_title;
  new.plant_name := v_plant_name;
  new.genus_name := v_genus_name;

  return new;
end;
$$;


--
-- Name: set_plant_quiz_slot_roll_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_plant_quiz_slot_roll_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at_robot_plant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_robot_plant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at_tile_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_tile_claim() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at_wallet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_wallet() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_collectionitem_from_plant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_collectionitem_from_plant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (
    new.species_name is distinct from old.species_name
    or new.genus_category is distinct from old.genus_category
    or new.genus_number is distinct from old.genus_number
  ) then
    update public."CollectionItem" ci
    set
      plant_name = new.species_name,
      genus_name = coalesce(
        (
          select pg.genus_name
          from public."PlantGenus" pg
          where pg.id = ci.genus_id
        ),
        (
          select pg.genus_name
          from public."PlantGenus" pg
          where pg.category = new.genus_category
            and pg.category_dex_number = new.genus_number
          limit 1
        )
      )
    where ci.plant_id = new.id;
  end if;

  return new;
end;
$$;


--
-- Name: sync_collectionitem_from_plantgenus(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_collectionitem_from_plantgenus() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.genus_name is distinct from old.genus_name then
    update public."CollectionItem"
    set genus_name = new.genus_name
    where genus_id = new.id;

    update public."CollectionItem" ci
    set genus_name = new.genus_name
    from public."Plant" p
    where ci.plant_id = p.id
      and ci.genus_id is null
      and p.genus_category = new.category
      and p.genus_number = new.category_dex_number;
  end if;

  return new;
end;
$$;


--
-- Name: sync_collectionitem_titles_from_collection(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_collectionitem_titles_from_collection() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.title is distinct from old.title then
    update public."CollectionItem"
    set collection_title = new.title
    where collection_id = new.id;
  end if;
  return new;
end;
$$;


--
-- Name: wallet_grant_currency(uuid, text, text, text, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_grant_currency(p_auth_id uuid, p_currency_code text, p_event_source text, p_event_reference text, p_amount integer, p_direction text DEFAULT 'credit'::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(applied boolean, ledger_id uuid, seeds_progress integer, sparks_balance integer, amber_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ledger_id uuid;
  v_inserted integer;
  v_wallet public."UserWallet"%rowtype;
  v_sign integer;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  if coalesce(length(trim(p_currency_code)), 0) = 0 then
    raise exception 'p_currency_code is required';
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

  if p_currency_code not in ('seeds_progress', 'sparks', 'amber') then
    raise exception 'unsupported currency_code %', p_currency_code;
  end if;

  if p_direction not in ('credit', 'debit') then
    raise exception 'p_direction must be credit or debit';
  end if;

  v_sign := case when p_direction = 'credit' then 1 else -1 end;

  insert into public."UserWallet" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  insert into public."UserWalletLedger" (
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
    p_currency_code,
    p_direction,
    p_amount,
    p_event_source,
    p_event_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (auth_id, event_source, event_reference, currency_code) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
      into v_wallet
      from public."UserWallet"
      where auth_id = p_auth_id
      limit 1;

    return query
    select
      false,
      null::uuid,
      v_wallet.seeds_progress,
      v_wallet.sparks_balance,
      v_wallet.amber_balance;
    return;
  end if;

  update public."UserWallet" as uw
  set
    seeds_progress = case
      when p_currency_code = 'seeds_progress' then greatest(0, uw.seeds_progress + (v_sign * p_amount))
      else uw.seeds_progress
    end,
    sparks_balance = case
      when p_currency_code = 'sparks' then greatest(0, uw.sparks_balance + (v_sign * p_amount))
      else uw.sparks_balance
    end,
    amber_balance = case
      when p_currency_code = 'amber' then greatest(0, uw.amber_balance + (v_sign * p_amount))
      else uw.amber_balance
    end,
    updated_at = now()
  where uw.auth_id = p_auth_id
  returning * into v_wallet;

  return query
  select
    true,
    v_ledger_id,
    v_wallet.seeds_progress,
    v_wallet.sparks_balance,
    v_wallet.amber_balance;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Achievements" (
    achievement_number bigint,
    title text,
    description text,
    icon_emoji text,
    rarity text,
    requirement text,
    reward_name text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text
);


--
-- Name: TABLE "Achievements"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Achievements" IS 'Achievements that are unlockable by events and unlock rewards, mainly titles.';


--
-- Name: ClassroomParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassroomParticipant" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    participant_code text NOT NULL,
    join_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ClassroomParticipantProgress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassroomParticipantProgress" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participant_id uuid NOT NULL,
    collection_item_id uuid NOT NULL,
    scan_id text,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Collection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Collection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    background_image_url text,
    background_color text,
    is_public boolean DEFAULT false NOT NULL,
    is_classroom boolean DEFAULT false NOT NULL,
    show_participant_codes boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    followers_count integer DEFAULT 0 NOT NULL
);


--
-- Name: CollectionItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CollectionItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    genus_id text,
    plant_id text,
    category text,
    sort_order integer,
    note text,
    collection_title text,
    genus_name text,
    plant_name text
);


--
-- Name: CollectionQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CollectionQuest" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    target_plants text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_date text,
    updated_date text,
    created_by text
);


--
-- Name: Friend; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Friend" (
    request_sent_by text,
    request_sent_to text,
    status text,
    added_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    is_sample boolean,
    auth_id uuid
);


--
-- Name: TABLE "Friend"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Friend" IS 'Sent friendrequest, theire state and the relationships between users';


--
-- Name: GeoRasterCell; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GeoRasterCell" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grid_id text NOT NULL,
    grid_lat_idx integer NOT NULL,
    grid_lng_idx integer NOT NULL,
    center_lat numeric(9,6) NOT NULL,
    center_lng numeric(9,6) NOT NULL,
    theme text NOT NULL,
    theme_confidence numeric(3,2) DEFAULT 0.8 NOT NULL,
    dominant_osm_tags jsonb,
    osm_element_count integer DEFAULT 0,
    nearest_osm_element_distance_m integer,
    country_code character varying(2) DEFAULT NULL::character varying,
    admin_level_4 text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_osm_update_date date,
    is_valid boolean DEFAULT true NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    theme_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    theme_anchor_points jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "GeoRasterCell_theme_check" CHECK ((theme = ANY (ARRAY['forest'::text, 'water'::text, 'urban'::text, 'meadow'::text])))
);


--
-- Name: LogoAsset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LogoAsset" (
    asset_id text NOT NULL,
    asset_type text NOT NULL,
    file_name text NOT NULL,
    r2_key text NOT NULL,
    public_url text NOT NULL,
    display_name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    default_unlocked boolean DEFAULT false NOT NULL,
    source text DEFAULT 'r2'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "LogoAsset_asset_type_check" CHECK ((asset_type = ANY (ARRAY['face'::text, 'plant'::text, 'border'::text])))
);


--
-- Name: MonthlyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MonthlyQuest" (
    quest_number bigint,
    title text,
    description text,
    requirement text,
    category text,
    required_discoveries bigint,
    target_genus_name text,
    target_species_name text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    seed_reward integer DEFAULT 1000 NOT NULL
);


--
-- Name: TABLE "MonthlyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."MonthlyQuest" IS 'Monthly Quest Data, ID starting with 10X';


--
-- Name: News; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."News" (
    title text,
    text text,
    created_date timestamp with time zone,
    old_id text,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE "News"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."News" IS 'News-Channel, displaying information thats meant to be spread among the users.';


--
-- Name: OSMTileChunkLite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OSMTileChunkLite" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dataset_version text NOT NULL,
    chunk_x integer NOT NULL,
    chunk_y integer NOT NULL,
    tile_count smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE "OSMTileChunkLite"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."OSMTileChunkLite" IS 'Chunk metadata: dataset_version, grid coordinates, minimal overhead';


--
-- Name: OSMTileValue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OSMTileValue" (
    chunk_id uuid NOT NULL,
    tile_local_x smallint NOT NULL,
    tile_local_y smallint NOT NULL,
    zone_type smallint NOT NULL,
    zone_value smallint NOT NULL
);


--
-- Name: TABLE "OSMTileValue"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."OSMTileValue" IS 'Tile zone data: local coordinates, quantized zone type (0-5), quantized zone area (0-255 scale). Multiple zones per tile supported.';


--
-- Name: Plant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plant" (
    id text NOT NULL,
    genus_category character varying NOT NULL,
    genus_number bigint,
    species_name text,
    scientific_name text,
    description text,
    identification_features text,
    fun_fact text,
    rarity text,
    created_date timestamp without time zone,
    updated_date timestamp without time zone,
    created_by_id text,
    native_region text
);


--
-- Name: TABLE "Plant"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Plant" IS 'Stores all Plants of Floralog';


--
-- Name: PlantGenus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantGenus" (
    category_dex_number bigint,
    genus_name text,
    scientific_genus text,
    category text,
    family text,
    description text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    rarity text,
    icon_url text
);


--
-- Name: TABLE "PlantGenus"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."PlantGenus" IS 'Genus information for all plants in floralog';


--
-- Name: PlantQuiz; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantQuiz" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    source_discovery_id text NOT NULL,
    correct_plant_id text NOT NULL,
    option_plant_ids jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    wrong_attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    scheduled_slot_date date NOT NULL,
    scheduled_slot_type text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    reward_seeds integer,
    reward_data_quality integer,
    notification_sent_at timestamp with time zone,
    CONSTRAINT "PlantQuiz_max_attempts_check" CHECK ((max_attempts = 3)),
    CONSTRAINT "PlantQuiz_scheduled_slot_type_check" CHECK ((scheduled_slot_type = ANY (ARRAY['midday'::text, 'evening'::text]))),
    CONSTRAINT "PlantQuiz_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'expired'::text]))),
    CONSTRAINT "PlantQuiz_wrong_attempts_check" CHECK (((wrong_attempts >= 0) AND (wrong_attempts <= 3))),
    CONSTRAINT plant_quiz_option_array CHECK (((jsonb_typeof(option_plant_ids) = 'array'::text) AND (jsonb_array_length(option_plant_ids) = 3)))
);


--
-- Name: PlantQuizExcludedDiscovery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantQuizExcludedDiscovery" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    discovery_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: PlantQuizSlotRoll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantQuizSlotRoll" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_date date NOT NULL,
    slot_type text NOT NULL,
    run_key text NOT NULL,
    random_minute integer NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    executed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PlantQuizSlotRoll_random_minute_check" CHECK (((random_minute >= 0) AND (random_minute <= 59))),
    CONSTRAINT "PlantQuizSlotRoll_slot_type_check" CHECK ((slot_type = ANY (ARRAY['midday'::text, 'evening'::text])))
);


--
-- Name: PublicProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PublicProfile" (
    id text NOT NULL,
    user_email text NOT NULL,
    display_name text,
    full_name text,
    title text,
    selected_title text,
    avatar_url text,
    background_image_url text,
    background_color text,
    favorite_plant_id text,
    donor_status boolean,
    created_date timestamp without time zone,
    updated_date timestamp without time zone,
    created_by_id character varying,
    created_by character varying,
    auth_id uuid,
    role text,
    push_subscription text,
    fcm_token text,
    public_profile boolean DEFAULT true NOT NULL,
    local_tracking boolean DEFAULT true NOT NULL,
    selected_face_asset text DEFAULT 'face_original'::text NOT NULL,
    selected_plant_asset text DEFAULT 'plant_leaf'::text NOT NULL,
    selected_border_asset text DEFAULT 'border_original'::text NOT NULL,
    selected_border_color text,
    global_explorer_visibility boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE "PublicProfile"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."PublicProfile" IS 'The Public-Profiles of the Users of this App';


--
-- Name: COLUMN "PublicProfile".auth_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."PublicProfile".auth_id IS 'Authentication ID, Unique';


--
-- Name: Quest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Quest" (
    quest_number bigint,
    title text,
    description text,
    requirement text,
    xp_reward bigint,
    category text,
    difficulty text,
    required_discoveries bigint,
    unlocked_at_level bigint,
    prerequisite_quest_number bigint,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    reward_name text,
    targets text,
    targets_operator text,
    seed_reward integer DEFAULT 500 NOT NULL
);


--
-- Name: TABLE "Quest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Quest" IS 'Refers to single quests. Currently it is unclear how created quests know about theire "target species" or "target genus", since these fields are empty.';


--
-- Name: RasterCellQueryLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RasterCellQueryLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    query_date date NOT NULL,
    search_lat numeric(9,6) NOT NULL,
    search_lng numeric(9,6) NOT NULL,
    search_radius_m integer DEFAULT 5000 NOT NULL,
    cells_found integer NOT NULL,
    cells_by_theme jsonb,
    query_duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Referral; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Referral" (
    referrer_email text,
    referred_email text,
    status text,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "Referral"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Referral" IS 'Used to store connections between new and old users.';


--
-- Name: Rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Rewards" (
    name text,
    display_name text,
    type text,
    value text,
    color text,
    image_url text,
    requires_weekly_quests text,
    requires_monthly_quests text,
    requires_gifts text,
    requires_donor text,
    requires_referrals text,
    requires_rare_plants text,
    requires_quest text,
    random_event text,
    random_chance text,
    id text DEFAULT 'encode(gen_random_bytes(12), ''''hex'''')'::text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    requires_zone_theme text,
    requires_referred_seeds_progress integer,
    requires_plant_genus_id text,
    requires_plant_species_id text,
    spark_price integer,
    amber_price integer,
    CONSTRAINT rewards_amber_price_non_negative CHECK (((amber_price IS NULL) OR (amber_price >= 0))),
    CONSTRAINT rewards_spark_price_non_negative CHECK (((spark_price IS NULL) OR (spark_price >= 0)))
);


--
-- Name: TABLE "Rewards"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Rewards" IS 'Rewards which may be unlocked on different conditions, e.g. completion of quest ID, donation, random events and scans of certain plants.';


--
-- Name: RobotPlant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlant" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    energy integer DEFAULT 70 NOT NULL,
    data_quality integer DEFAULT 65 NOT NULL,
    care integer DEFAULT 72 NOT NULL,
    streak_days integer DEFAULT 0 NOT NULL,
    wallet_balance integer DEFAULT 0 NOT NULL,
    last_maintenance_at timestamp with time zone,
    last_decay_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_valid_geo_lat numeric(8,3),
    last_valid_geo_lng numeric(8,3),
    last_valid_geo_at timestamp with time zone,
    claimed_tiles_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT "RobotPlant_care_check" CHECK (((care >= 0) AND (care <= 100))),
    CONSTRAINT "RobotPlant_data_quality_check" CHECK (((data_quality >= 0) AND (data_quality <= 100))),
    CONSTRAINT "RobotPlant_energy_check" CHECK (((energy >= 0) AND (energy <= 100))),
    CONSTRAINT "RobotPlant_streak_days_check" CHECK ((streak_days >= 0)),
    CONSTRAINT "RobotPlant_wallet_balance_check" CHECK ((wallet_balance >= 0))
);


--
-- Name: RobotPlantActiveEffect; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantActiveEffect" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    item_id uuid,
    effect_type text NOT NULL,
    effect_value numeric(8,3) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    source_event_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: RobotPlantDailyCareAction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantDailyCareAction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    day_key date NOT NULL,
    watering_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantDailyCareAction_watering_count_check" CHECK (((watering_count >= 0) AND (watering_count <= 3)))
);


--
-- Name: RobotPlantDailyChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantDailyChallenge" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    challenge_type text NOT NULL,
    target_count integer DEFAULT 1 NOT NULL,
    target_zone_theme text,
    reward_base integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantDailyChallenge_reward_base_check" CHECK ((reward_base >= 0)),
    CONSTRAINT "RobotPlantDailyChallenge_target_count_check" CHECK ((target_count > 0))
);


--
-- Name: RobotPlantOSMCache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantOSMCache" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme text NOT NULL,
    osm_id text NOT NULL,
    osm_type text NOT NULL,
    lat numeric(9,6) NOT NULL,
    lng numeric(9,6) NOT NULL,
    area_m2 integer,
    confidence numeric(4,3) DEFAULT 1.0 NOT NULL,
    last_checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: RobotPlantShopItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantShopItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_key text NOT NULL,
    title text NOT NULL,
    description text,
    item_type text NOT NULL,
    seed_cost integer NOT NULL,
    effect_value numeric(8,3),
    duration_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantShopItem_seed_cost_check" CHECK ((seed_cost >= 0))
);


--
-- Name: RobotPlantUserDailyChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantUserDailyChallenge" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    challenge_date date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantUserDailyChallenge_progress_check" CHECK ((progress >= 0)),
    CONSTRAINT "RobotPlantUserDailyChallenge_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'claimed'::text])))
);


--
-- Name: RobotPlantUserInventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantUserInventory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantUserInventory_quantity_check" CHECK ((quantity >= 0))
);


--
-- Name: RobotPlantUserZoneState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantUserZoneState" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    day_key date NOT NULL,
    scans_in_zone integer DEFAULT 0 NOT NULL,
    unique_species_count integer DEFAULT 0 NOT NULL,
    last_scan_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantUserZoneState_scans_in_zone_check" CHECK ((scans_in_zone >= 0)),
    CONSTRAINT "RobotPlantUserZoneState_unique_species_count_check" CHECK ((unique_species_count >= 0))
);


--
-- Name: RobotPlantWalletLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantWalletLedger" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    currency_code text DEFAULT 'seed'::text NOT NULL,
    direction text DEFAULT 'credit'::text NOT NULL,
    amount integer NOT NULL,
    event_source text NOT NULL,
    event_reference text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantWalletLedger_amount_check" CHECK ((amount >= 0)),
    CONSTRAINT "RobotPlantWalletLedger_direction_check" CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: RobotPlantZone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantZone" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_key text NOT NULL,
    title text NOT NULL,
    theme text NOT NULL,
    center_lat double precision NOT NULL,
    center_lng double precision NOT NULL,
    radius_m integer NOT NULL,
    zone_bonus_multiplier numeric(6,3) DEFAULT 1.000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    day_generated date,
    CONSTRAINT "RobotPlantZone_radius_m_check" CHECK ((radius_m > 0))
);


--
-- Name: RobotPlantZoneGenerationLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantZoneGenerationLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    day_key date NOT NULL,
    search_radius_m integer,
    candidate_count_by_theme jsonb,
    selected_zone_count integer,
    osm_cache_hits integer DEFAULT 0,
    osm_live_queries integer DEFAULT 0,
    osm_errors integer DEFAULT 0,
    clipping_stats jsonb,
    total_duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rerolls_granted_today integer DEFAULT 1 NOT NULL,
    reroll_count integer DEFAULT 0 NOT NULL
);


--
-- Name: ScanLike; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScanLike" (
    discovery_id text,
    liked_by text,
    liked_date timestamp with time zone,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "ScanLike"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."ScanLike" IS 'Scans that are shared among the community (e.g. WeeklyScan) might get liked by other members.';


--
-- Name: SharedScan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SharedScan" (
    discovery_id text,
    plant_id text,
    shared_by text,
    shared_to text,
    shared_date timestamp with time zone,
    image_url text,
    discovery_location text,
    viewed boolean,
    viewed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id_from uuid,
    auth_id_to uuid
);


--
-- Name: TABLE "SharedScan"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."SharedScan" IS 'Scans might be shared with other users and friends. Send a rose to your loved ones!';


--
-- Name: TileClaim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TileClaim" (
    tile_x integer NOT NULL,
    tile_y integer NOT NULL,
    owner_auth_id uuid NOT NULL,
    owner_scan_count integer DEFAULT 0 NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_group_name text,
    CONSTRAINT "TileClaim_owner_scan_count_check" CHECK ((owner_scan_count >= 0)),
    CONSTRAINT tileclaim_claim_group_name_length CHECK (((claim_group_name IS NULL) OR ((char_length(claim_group_name) >= 3) AND (char_length(claim_group_name) <= 48))))
);


--
-- Name: UserAchievement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAchievement" (
    achievement_id text,
    unlocked_date timestamp with time zone,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "UserAchievement"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserAchievement" IS 'The Achievements the users of Floralog unlocked.';


--
-- Name: UserCollection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCollection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserCollectionQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCollectionQuest" (
    id text NOT NULL,
    auth_id uuid,
    collection_quest_id text,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    accepted text,
    redeemed text,
    completed text,
    accepted_date text,
    completed_date text,
    redeemed_date text,
    discovered_plants text[] DEFAULT '{}'::text[],
    created_date text,
    updated_date text,
    created_by text,
    created_by_id text
);


--
-- Name: UserCollectionQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCollectionQuest_backup_2026_02_28" (
    id text,
    auth_id uuid,
    collection_quest_id text,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    accepted text,
    redeemed text,
    completed text,
    accepted_date text,
    completed_date text,
    redeemed_date text,
    discovered_plants text[],
    created_date text,
    updated_date text,
    created_by text,
    created_by_id text
);


--
-- Name: UserEngagementState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserEngagementState" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    last_login_date date,
    login_streak_days integer DEFAULT 0 NOT NULL,
    last_daily_login_claim_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserEngagementState_login_streak_days_check" CHECK ((login_streak_days >= 0))
);


--
-- Name: UserMonthlyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserMonthlyQuest" (
    monthly_quest_id text,
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    completed boolean,
    active_month text,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_date timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE "UserMonthlyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserMonthlyQuest" IS 'MonthlyQuests that are currently active for users.';


--
-- Name: UserMonthlyQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserMonthlyQuest_backup_2026_02_28" (
    monthly_quest_id text,
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    completed boolean,
    active_month text,
    completed_date text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: UserNotification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserNotification" (
    user_email text,
    notification_type text,
    related_quest_id text,
    seen boolean,
    message text,
    title text,
    description text,
    action_url text,
    priority text,
    display_location text,
    id text DEFAULT extensions.gen_random_bytes(12) NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "UserNotification"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserNotification" IS 'Motivational notifications that are sent to users';


--
-- Name: COLUMN "UserNotification".auth_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."UserNotification".auth_id IS 'User ID';


--
-- Name: UserPlantDiscovery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPlantDiscovery" (
    plant_id text,
    discovered_date timestamp with time zone,
    discovery_location text,
    discovery_notes text,
    image_url text,
    is_front_image boolean,
    is_species_front_image boolean,
    id text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text) NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    "user" text,
    auth_id uuid
);


--
-- Name: TABLE "UserPlantDiscovery"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserPlantDiscovery" IS 'Information about all scans done by the users to connect them to theire profiles.';


--
-- Name: UserQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserQuest" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    quest_id text,
    completed boolean,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_date timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE "UserQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserQuest" IS 'Reference between Quests and Users';


--
-- Name: COLUMN "UserQuest".auth_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."UserQuest".auth_id IS 'Auth ID, unique connection to user';


--
-- Name: UserQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserQuest_backup_2026_02_28" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    quest_id text,
    completed boolean,
    completed_date text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: UserRewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserRewards" (
    reward_id text,
    reward_name text,
    user_email text,
    user_name text,
    unlocked_date timestamp with time zone,
    id text DEFAULT ROW(extensions.gen_random_bytes(12)) NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "UserRewards"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserRewards" IS 'Connection between users and unlocked rewards';


--
-- Name: UserWallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWallet" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    seeds_progress integer DEFAULT 0 NOT NULL,
    sparks_balance integer DEFAULT 0 NOT NULL,
    amber_balance integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserWallet_amber_balance_check" CHECK ((amber_balance >= 0)),
    CONSTRAINT "UserWallet_seeds_progress_check" CHECK ((seeds_progress >= 0)),
    CONSTRAINT "UserWallet_sparks_balance_check" CHECK ((sparks_balance >= 0))
);


--
-- Name: UserWalletLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWalletLedger" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    currency_code text NOT NULL,
    direction text DEFAULT 'credit'::text NOT NULL,
    amount integer NOT NULL,
    event_source text NOT NULL,
    event_reference text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserWalletLedger_amount_check" CHECK ((amount >= 0)),
    CONSTRAINT "UserWalletLedger_currency_code_check" CHECK ((currency_code = ANY (ARRAY['seeds_progress'::text, 'sparks'::text, 'amber'::text]))),
    CONSTRAINT "UserWalletLedger_direction_check" CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: UserWeeklyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWeeklyQuest" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    active_week text,
    completed boolean,
    weekly_quest_id text,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_date timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE "UserWeeklyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserWeeklyQuest" IS 'Connection between weekly quests and users.';


--
-- Name: UserWeeklyQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWeeklyQuest_backup_2026_02_28" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    active_week text,
    completed boolean,
    weekly_quest_id text,
    completed_date text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: WeeklyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WeeklyQuest" (
    quest_number bigint,
    title text,
    description text,
    requirement text,
    category text,
    required_discoveries bigint,
    target_genus_name text,
    target_species_name text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    seed_reward integer DEFAULT 1500 NOT NULL
);


--
-- Name: TABLE "WeeklyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."WeeklyQuest" IS 'Data about Weekly Quests that have been created, starting with 2xx';


--
-- Name: baseUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."baseUser" (
    title text,
    display_name text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    email text,
    full_name text,
    disabled text,
    is_verified boolean,
    app_id text,
    user_role text,
    role text,
    _app_role text,
    background_image_url text,
    background_color text,
    donor_status text,
    weekly_bg1_unlocked text,
    avatar_url text,
    selected_title text,
    favorite_category text,
    favorite_plant_id text,
    weekly_bg2_unlocked text,
    donor text,
    gift_bg_unlocked text,
    auth_id uuid
);

ALTER TABLE ONLY public."baseUser" FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE "baseUser"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."baseUser" IS 'Old Base44 Auth list. Following has to be doublechecked: Why does User-Table has information regarding certain reward unlocks? Is the "title" column being used?';


--
-- Name: Achievements Achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Achievements"
    ADD CONSTRAINT "Achievements_pkey" PRIMARY KEY (id);


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_participant_id_collection_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_participant_id_collection_item_key" UNIQUE (participant_id, collection_item_id);


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_pkey" PRIMARY KEY (id);


--
-- Name: ClassroomParticipant ClassroomParticipant_join_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipant"
    ADD CONSTRAINT "ClassroomParticipant_join_token_key" UNIQUE (join_token);


--
-- Name: ClassroomParticipant ClassroomParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipant"
    ADD CONSTRAINT "ClassroomParticipant_pkey" PRIMARY KEY (id);


--
-- Name: CollectionItem CollectionItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_pkey" PRIMARY KEY (id);


--
-- Name: CollectionQuest CollectionQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionQuest"
    ADD CONSTRAINT "CollectionQuest_pkey" PRIMARY KEY (id);


--
-- Name: Collection Collection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Collection"
    ADD CONSTRAINT "Collection_pkey" PRIMARY KEY (id);


--
-- Name: Collection Collection_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Collection"
    ADD CONSTRAINT "Collection_slug_key" UNIQUE (slug);


--
-- Name: Friend Friend_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Friend"
    ADD CONSTRAINT "Friend_pkey" PRIMARY KEY (id);


--
-- Name: GeoRasterCell GeoRasterCell_grid_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeoRasterCell"
    ADD CONSTRAINT "GeoRasterCell_grid_id_key" UNIQUE (grid_id);


--
-- Name: GeoRasterCell GeoRasterCell_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeoRasterCell"
    ADD CONSTRAINT "GeoRasterCell_pkey" PRIMARY KEY (id);


--
-- Name: LogoAsset LogoAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LogoAsset"
    ADD CONSTRAINT "LogoAsset_pkey" PRIMARY KEY (asset_id);


--
-- Name: News News_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."News"
    ADD CONSTRAINT "News_pkey" PRIMARY KEY (id);


--
-- Name: OSMTileChunkLite OSMTileChunkLite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OSMTileChunkLite"
    ADD CONSTRAINT "OSMTileChunkLite_pkey" PRIMARY KEY (id);


--
-- Name: OSMTileValue OSMTileValue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OSMTileValue"
    ADD CONSTRAINT "OSMTileValue_pkey" PRIMARY KEY (chunk_id, tile_local_x, tile_local_y, zone_type);


--
-- Name: PlantGenus PlantGenus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantGenus"
    ADD CONSTRAINT "PlantGenus_pkey" PRIMARY KEY (id);


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_auth_id_discovery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_auth_id_discovery_id_key" UNIQUE (auth_id, discovery_id);


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_pkey" PRIMARY KEY (id);


--
-- Name: PlantQuizSlotRoll PlantQuizSlotRoll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizSlotRoll"
    ADD CONSTRAINT "PlantQuizSlotRoll_pkey" PRIMARY KEY (id);


--
-- Name: PlantQuizSlotRoll PlantQuizSlotRoll_run_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizSlotRoll"
    ADD CONSTRAINT "PlantQuizSlotRoll_run_key_key" UNIQUE (run_key);


--
-- Name: PlantQuiz PlantQuiz_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_pkey" PRIMARY KEY (id);


--
-- Name: Plant Plant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plant"
    ADD CONSTRAINT "Plant_pkey" PRIMARY KEY (id);


--
-- Name: PublicProfile PublicProfile_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "PublicProfile_auth_id_key" UNIQUE (auth_id);


--
-- Name: PublicProfile PublicProfile_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "PublicProfile_user_email_key" UNIQUE (user_email);


--
-- Name: RasterCellQueryLog RasterCellQueryLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RasterCellQueryLog"
    ADD CONSTRAINT "RasterCellQueryLog_pkey" PRIMARY KEY (id);


--
-- Name: Referral Referral_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_pkey" PRIMARY KEY (id);


--
-- Name: Rewards Rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantActiveEffect RobotPlantActiveEffect_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantActiveEffect"
    ADD CONSTRAINT "RobotPlantActiveEffect_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantDailyCareAction RobotPlantDailyCareAction_auth_id_day_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyCareAction"
    ADD CONSTRAINT "RobotPlantDailyCareAction_auth_id_day_key_key" UNIQUE (auth_id, day_key);


--
-- Name: RobotPlantDailyCareAction RobotPlantDailyCareAction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyCareAction"
    ADD CONSTRAINT "RobotPlantDailyCareAction_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantDailyChallenge RobotPlantDailyChallenge_challenge_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyChallenge"
    ADD CONSTRAINT "RobotPlantDailyChallenge_challenge_key_key" UNIQUE (challenge_key);


--
-- Name: RobotPlantDailyChallenge RobotPlantDailyChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyChallenge"
    ADD CONSTRAINT "RobotPlantDailyChallenge_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantOSMCache RobotPlantOSMCache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantOSMCache"
    ADD CONSTRAINT "RobotPlantOSMCache_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantOSMCache RobotPlantOSMCache_theme_osm_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantOSMCache"
    ADD CONSTRAINT "RobotPlantOSMCache_theme_osm_id_key" UNIQUE (theme, osm_id);


--
-- Name: RobotPlantShopItem RobotPlantShopItem_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantShopItem"
    ADD CONSTRAINT "RobotPlantShopItem_item_key_key" UNIQUE (item_key);


--
-- Name: RobotPlantShopItem RobotPlantShopItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantShopItem"
    ADD CONSTRAINT "RobotPlantShopItem_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_auth_id_challenge_id_challenge_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_auth_id_challenge_id_challenge_key" UNIQUE (auth_id, challenge_id, challenge_date);


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_auth_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_auth_id_item_id_key" UNIQUE (auth_id, item_id);


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_auth_id_zone_id_day_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_auth_id_zone_id_day_key_key" UNIQUE (auth_id, zone_id, day_key);


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantWalletLedger RobotPlantWalletLedger_auth_id_event_source_event_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantWalletLedger"
    ADD CONSTRAINT "RobotPlantWalletLedger_auth_id_event_source_event_reference_key" UNIQUE (auth_id, event_source, event_reference);


--
-- Name: RobotPlantWalletLedger RobotPlantWalletLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantWalletLedger"
    ADD CONSTRAINT "RobotPlantWalletLedger_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantZoneGenerationLog RobotPlantZoneGenerationLog_auth_id_day_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZoneGenerationLog"
    ADD CONSTRAINT "RobotPlantZoneGenerationLog_auth_id_day_key_key" UNIQUE (auth_id, day_key);


--
-- Name: RobotPlantZoneGenerationLog RobotPlantZoneGenerationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZoneGenerationLog"
    ADD CONSTRAINT "RobotPlantZoneGenerationLog_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantZone RobotPlantZone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZone"
    ADD CONSTRAINT "RobotPlantZone_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantZone RobotPlantZone_zone_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZone"
    ADD CONSTRAINT "RobotPlantZone_zone_key_key" UNIQUE (zone_key);


--
-- Name: RobotPlant RobotPlant_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlant"
    ADD CONSTRAINT "RobotPlant_auth_id_key" UNIQUE (auth_id);


--
-- Name: RobotPlant RobotPlant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlant"
    ADD CONSTRAINT "RobotPlant_pkey" PRIMARY KEY (id);


--
-- Name: ScanLike ScanLike_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScanLike"
    ADD CONSTRAINT "ScanLike_pkey" PRIMARY KEY (id);


--
-- Name: SharedScan SharedScan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SharedScan"
    ADD CONSTRAINT "SharedScan_pkey" PRIMARY KEY (id);


--
-- Name: TileClaim TileClaim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TileClaim"
    ADD CONSTRAINT "TileClaim_pkey" PRIMARY KEY (tile_x, tile_y);


--
-- Name: UserCollectionQuest UserCollectionQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollectionQuest"
    ADD CONSTRAINT "UserCollectionQuest_pkey" PRIMARY KEY (id);


--
-- Name: UserCollection UserCollection_auth_id_collection_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_auth_id_collection_id_key" UNIQUE (auth_id, collection_id);


--
-- Name: UserCollection UserCollection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_pkey" PRIMARY KEY (id);


--
-- Name: UserEngagementState UserEngagementState_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEngagementState"
    ADD CONSTRAINT "UserEngagementState_auth_id_key" UNIQUE (auth_id);


--
-- Name: UserEngagementState UserEngagementState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEngagementState"
    ADD CONSTRAINT "UserEngagementState_pkey" PRIMARY KEY (id);


--
-- Name: UserMonthlyQuest UserMonthlyQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMonthlyQuest"
    ADD CONSTRAINT "UserMonthlyQuest_pkey" PRIMARY KEY (id);


--
-- Name: UserNotification UserNotification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotification"
    ADD CONSTRAINT "UserNotification_pkey" PRIMARY KEY (id);


--
-- Name: UserPlantDiscovery UserPlantDiscovery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPlantDiscovery"
    ADD CONSTRAINT "UserPlantDiscovery_pkey" PRIMARY KEY (id);


--
-- Name: Quest UserQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quest"
    ADD CONSTRAINT "UserQuest_pkey" PRIMARY KEY (id);


--
-- Name: UserQuest UserQuest_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserQuest"
    ADD CONSTRAINT "UserQuest_pkey1" PRIMARY KEY (id);


--
-- Name: UserRewards UserRewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserRewards"
    ADD CONSTRAINT "UserRewards_pkey" PRIMARY KEY (id);


--
-- Name: UserWalletLedger UserWalletLedger_auth_id_event_source_event_reference_curre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWalletLedger"
    ADD CONSTRAINT "UserWalletLedger_auth_id_event_source_event_reference_curre_key" UNIQUE (auth_id, event_source, event_reference, currency_code);


--
-- Name: UserWalletLedger UserWalletLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWalletLedger"
    ADD CONSTRAINT "UserWalletLedger_pkey" PRIMARY KEY (id);


--
-- Name: UserWallet UserWallet_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_auth_id_key" UNIQUE (auth_id);


--
-- Name: UserWallet UserWallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_pkey" PRIMARY KEY (id);


--
-- Name: UserWeeklyQuest UserWeeklyQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWeeklyQuest"
    ADD CONSTRAINT "UserWeeklyQuest_pkey" PRIMARY KEY (id);


--
-- Name: PublicProfile User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: baseUser User_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."baseUser"
    ADD CONSTRAINT "User_pkey1" PRIMARY KEY (id);


--
-- Name: WeeklyQuest WeeklyQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeeklyQuest"
    ADD CONSTRAINT "WeeklyQuest_pkey" PRIMARY KEY (id);


--
-- Name: baseUser baseuser_auth_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."baseUser"
    ADD CONSTRAINT baseuser_auth_id_unique UNIQUE (auth_id);


--
-- Name: UserAchievement_auth_achievement_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserAchievement_auth_achievement_unique" ON public."UserAchievement" USING btree (auth_id, achievement_id);


--
-- Name: idx_baseuser_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_baseuser_auth_id ON public."baseUser" USING btree (auth_id);


--
-- Name: idx_baseuser_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_baseuser_email ON public."baseUser" USING btree (email);


--
-- Name: idx_classroom_participant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_participant_code ON public."ClassroomParticipant" USING btree (participant_code);


--
-- Name: idx_classroom_participant_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_participant_collection_id ON public."ClassroomParticipant" USING btree (collection_id);


--
-- Name: idx_collection_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_auth_id ON public."Collection" USING btree (auth_id);


--
-- Name: idx_collection_is_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_is_public ON public."Collection" USING btree (is_public);


--
-- Name: idx_collection_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_slug ON public."Collection" USING btree (slug);


--
-- Name: idx_collectionitem_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectionitem_collection_id ON public."CollectionItem" USING btree (collection_id);


--
-- Name: idx_collectionitem_genus_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectionitem_genus_id ON public."CollectionItem" USING btree (genus_id);


--
-- Name: idx_collectionitem_plant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectionitem_plant_id ON public."CollectionItem" USING btree (plant_id);


--
-- Name: idx_cpp_collection_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpp_collection_item_id ON public."ClassroomParticipantProgress" USING btree (collection_item_id);


--
-- Name: idx_cpp_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpp_participant_id ON public."ClassroomParticipantProgress" USING btree (participant_id);


--
-- Name: idx_geo_raster_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_confidence ON public."GeoRasterCell" USING btree (theme, theme_confidence DESC);


--
-- Name: idx_geo_raster_grid_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_grid_coords ON public."GeoRasterCell" USING btree (grid_lat_idx, grid_lng_idx);


--
-- Name: idx_geo_raster_grid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_grid_id ON public."GeoRasterCell" USING btree (grid_id);


--
-- Name: idx_geo_raster_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_theme ON public."GeoRasterCell" USING btree (theme);


--
-- Name: idx_geo_raster_theme_scores; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_theme_scores ON public."GeoRasterCell" USING gin (theme_scores);


--
-- Name: idx_geo_raster_valid_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_valid_theme ON public."GeoRasterCell" USING btree (is_valid, theme);


--
-- Name: idx_osm_cache_theme_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_cache_theme_area ON public."RobotPlantOSMCache" USING btree (theme, area_m2 DESC);


--
-- Name: idx_osm_chunk_lite_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_chunk_lite_coords ON public."OSMTileChunkLite" USING btree (dataset_version, chunk_x, chunk_y);


--
-- Name: idx_osm_chunk_lite_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_osm_chunk_lite_unique ON public."OSMTileChunkLite" USING btree (dataset_version, chunk_x, chunk_y);


--
-- Name: idx_osm_chunk_lite_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_chunk_lite_version ON public."OSMTileChunkLite" USING btree (dataset_version);


--
-- Name: idx_osm_tile_value_chunk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_tile_value_chunk_id ON public."OSMTileValue" USING btree (chunk_id);


--
-- Name: idx_osm_tile_value_chunk_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_tile_value_chunk_zone ON public."OSMTileValue" USING btree (chunk_id, zone_type);


--
-- Name: idx_osm_tile_value_zone_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_tile_value_zone_type ON public."OSMTileValue" USING btree (zone_type);


--
-- Name: idx_plant_quiz_auth_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plant_quiz_auth_created ON public."PlantQuiz" USING btree (auth_id, created_at DESC);


--
-- Name: idx_plant_quiz_excluded_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plant_quiz_excluded_auth ON public."PlantQuizExcludedDiscovery" USING btree (auth_id, created_at DESC);


--
-- Name: idx_plant_quiz_one_open_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_plant_quiz_one_open_per_user ON public."PlantQuiz" USING btree (auth_id) WHERE (status = 'open'::text);


--
-- Name: idx_plant_quiz_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plant_quiz_slot ON public."PlantQuiz" USING btree (scheduled_slot_date, scheduled_slot_type);


--
-- Name: idx_plant_quiz_slot_roll_unique_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_plant_quiz_slot_roll_unique_slot ON public."PlantQuizSlotRoll" USING btree (slot_date, slot_type);


--
-- Name: idx_raster_query_log_auth_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raster_query_log_auth_date ON public."RasterCellQueryLog" USING btree (auth_id, query_date);


--
-- Name: idx_rewards_requires_plant_genus_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_requires_plant_genus_id ON public."Rewards" USING btree (requires_plant_genus_id) WHERE (requires_plant_genus_id IS NOT NULL);


--
-- Name: idx_rewards_requires_plant_species_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_requires_plant_species_id ON public."Rewards" USING btree (requires_plant_species_id) WHERE (requires_plant_species_id IS NOT NULL);


--
-- Name: idx_rewards_requires_zone_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_requires_zone_theme ON public."Rewards" USING btree (requires_zone_theme) WHERE (requires_zone_theme IS NOT NULL);


--
-- Name: idx_robotplant_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_auth_id ON public."RobotPlant" USING btree (auth_id);


--
-- Name: idx_robotplant_dailycare_auth_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_dailycare_auth_day ON public."RobotPlantDailyCareAction" USING btree (auth_id, day_key DESC);


--
-- Name: idx_robotplant_dailychallenge_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_dailychallenge_active ON public."RobotPlantDailyChallenge" USING btree (is_active);


--
-- Name: idx_robotplant_effect_auth_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_effect_auth_expires ON public."RobotPlantActiveEffect" USING btree (auth_id, expires_at);


--
-- Name: idx_robotplant_inventory_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_inventory_auth ON public."RobotPlantUserInventory" USING btree (auth_id);


--
-- Name: idx_robotplant_last_valid_geo_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_last_valid_geo_at ON public."RobotPlant" USING btree (last_valid_geo_at DESC);


--
-- Name: idx_robotplant_ledger_auth_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_ledger_auth_id_created_at ON public."RobotPlantWalletLedger" USING btree (auth_id, created_at DESC);


--
-- Name: idx_robotplant_ledger_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_ledger_event ON public."RobotPlantWalletLedger" USING btree (event_source, event_reference);


--
-- Name: idx_robotplant_shopitem_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_shopitem_active ON public."RobotPlantShopItem" USING btree (is_active);


--
-- Name: idx_robotplant_userdaily_auth_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_userdaily_auth_date ON public."RobotPlantUserDailyChallenge" USING btree (auth_id, challenge_date DESC);


--
-- Name: idx_robotplant_userzonestate_auth_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_userzonestate_auth_day ON public."RobotPlantUserZoneState" USING btree (auth_id, day_key DESC);


--
-- Name: idx_robotplant_zone_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_zone_active ON public."RobotPlantZone" USING btree (is_active);


--
-- Name: idx_robotplant_zone_day_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_zone_day_theme ON public."RobotPlantZone" USING btree (day_generated, theme);


--
-- Name: idx_tileclaim_owner_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tileclaim_owner_auth_id ON public."TileClaim" USING btree (owner_auth_id);


--
-- Name: idx_tileclaim_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tileclaim_updated_at ON public."TileClaim" USING btree (updated_at DESC);


--
-- Name: idx_usercollection_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usercollection_auth_id ON public."UserCollection" USING btree (auth_id);


--
-- Name: idx_usercollection_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usercollection_collection_id ON public."UserCollection" USING btree (collection_id);


--
-- Name: idx_userengagement_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userengagement_auth_id ON public."UserEngagementState" USING btree (auth_id);


--
-- Name: idx_userwallet_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userwallet_auth_id ON public."UserWallet" USING btree (auth_id);


--
-- Name: idx_userwalletledger_auth_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userwalletledger_auth_created ON public."UserWalletLedger" USING btree (auth_id, created_at DESC);


--
-- Name: idx_userwalletledger_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userwalletledger_event ON public."UserWalletLedger" USING btree (event_source, event_reference, currency_code);


--
-- Name: idx_zone_gen_log_auth_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zone_gen_log_auth_day ON public."RobotPlantZoneGenerationLog" USING btree (auth_id, day_key);


--
-- Name: logo_asset_r2_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX logo_asset_r2_key_idx ON public."LogoAsset" USING btree (r2_key);


--
-- Name: logo_asset_type_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logo_asset_type_active_idx ON public."LogoAsset" USING btree (asset_type, active);


--
-- Name: Collection trg_collection_sync_collectionitem_title; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collection_sync_collectionitem_title AFTER UPDATE OF title ON public."Collection" FOR EACH ROW EXECUTE FUNCTION public.sync_collectionitem_titles_from_collection();


--
-- Name: CollectionItem trg_collectionitem_set_readable_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collectionitem_set_readable_fields BEFORE INSERT OR UPDATE OF collection_id, genus_id, plant_id ON public."CollectionItem" FOR EACH ROW EXECUTE FUNCTION public.set_collectionitem_readable_fields();


--
-- Name: PlantQuizSlotRoll trg_plant_quiz_slot_roll_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plant_quiz_slot_roll_updated_at BEFORE UPDATE ON public."PlantQuizSlotRoll" FOR EACH ROW EXECUTE FUNCTION public.set_plant_quiz_slot_roll_updated_at();


--
-- Name: Plant trg_plant_sync_collectionitem; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plant_sync_collectionitem AFTER UPDATE OF species_name, genus_category, genus_number ON public."Plant" FOR EACH ROW EXECUTE FUNCTION public.sync_collectionitem_from_plant();


--
-- Name: PlantGenus trg_plantgenus_sync_collectionitem; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plantgenus_sync_collectionitem AFTER UPDATE OF genus_name ON public."PlantGenus" FOR EACH ROW EXECUTE FUNCTION public.sync_collectionitem_from_plantgenus();


--
-- Name: RobotPlantDailyCareAction trg_robotplant_dailycare_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_robotplant_dailycare_updated_at BEFORE UPDATE ON public."RobotPlantDailyCareAction" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_robot_plant();


--
-- Name: RobotPlantUserInventory trg_robotplant_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_robotplant_inventory_updated_at BEFORE UPDATE ON public."RobotPlantUserInventory" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_robot_plant();


--
-- Name: RobotPlant trg_robotplant_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_robotplant_updated_at BEFORE UPDATE ON public."RobotPlant" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_robot_plant();


--
-- Name: TileClaim trg_set_updated_at_tile_claim; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_tile_claim BEFORE UPDATE ON public."TileClaim" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_tile_claim();


--
-- Name: UserCollection trg_usercollection_followers_dec; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usercollection_followers_dec AFTER DELETE ON public."UserCollection" FOR EACH ROW EXECUTE FUNCTION public.decrement_collection_followers();


--
-- Name: UserCollection trg_usercollection_followers_inc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usercollection_followers_inc AFTER INSERT ON public."UserCollection" FOR EACH ROW EXECUTE FUNCTION public.increment_collection_followers();


--
-- Name: UserEngagementState trg_userengagement_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_userengagement_updated_at BEFORE UPDATE ON public."UserEngagementState" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_wallet();


--
-- Name: UserWallet trg_userwallet_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_userwallet_updated_at BEFORE UPDATE ON public."UserWallet" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_wallet();


--
-- Name: Achievements Achievements_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Achievements"
    ADD CONSTRAINT "Achievements_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."baseUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_collection_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_collection_item_id_fkey" FOREIGN KEY (collection_item_id) REFERENCES public."CollectionItem"(id) ON DELETE CASCADE;


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES public."ClassroomParticipant"(id) ON DELETE CASCADE;


--
-- Name: ClassroomParticipant ClassroomParticipant_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipant"
    ADD CONSTRAINT "ClassroomParticipant_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."Collection"(id) ON DELETE CASCADE;


--
-- Name: CollectionItem CollectionItem_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."Collection"(id) ON DELETE CASCADE;


--
-- Name: CollectionItem CollectionItem_genus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_genus_id_fkey" FOREIGN KEY (genus_id) REFERENCES public."PlantGenus"(id) ON DELETE SET NULL;


--
-- Name: CollectionItem CollectionItem_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES public."Plant"(id) ON DELETE SET NULL;


--
-- Name: Collection Collection_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Collection"
    ADD CONSTRAINT "Collection_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Friend Friend_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Friend"
    ADD CONSTRAINT "Friend_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OSMTileValue OSMTileValue_chunk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OSMTileValue"
    ADD CONSTRAINT "OSMTileValue_chunk_id_fkey" FOREIGN KEY (chunk_id) REFERENCES public."OSMTileChunkLite"(id) ON DELETE CASCADE;


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_discovery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_discovery_id_fkey" FOREIGN KEY (discovery_id) REFERENCES public."UserPlantDiscovery"(id) ON DELETE CASCADE;


--
-- Name: PlantQuiz PlantQuiz_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: PlantQuiz PlantQuiz_correct_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_correct_plant_id_fkey" FOREIGN KEY (correct_plant_id) REFERENCES public."Plant"(id) ON DELETE RESTRICT;


--
-- Name: PlantQuiz PlantQuiz_source_discovery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_source_discovery_id_fkey" FOREIGN KEY (source_discovery_id) REFERENCES public."UserPlantDiscovery"(id) ON DELETE CASCADE;


--
-- Name: PublicProfile PublicProfile_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "PublicProfile_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RasterCellQueryLog RasterCellQueryLog_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RasterCellQueryLog"
    ADD CONSTRAINT "RasterCellQueryLog_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Referral Referral_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rewards Rewards_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."baseUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rewards Rewards_requires_plant_genus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_requires_plant_genus_id_fkey" FOREIGN KEY (requires_plant_genus_id) REFERENCES public."PlantGenus"(id) ON DELETE SET NULL;


--
-- Name: Rewards Rewards_requires_plant_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_requires_plant_species_id_fkey" FOREIGN KEY (requires_plant_species_id) REFERENCES public."Plant"(id) ON DELETE SET NULL;


--
-- Name: RobotPlantActiveEffect RobotPlantActiveEffect_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantActiveEffect"
    ADD CONSTRAINT "RobotPlantActiveEffect_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantActiveEffect RobotPlantActiveEffect_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantActiveEffect"
    ADD CONSTRAINT "RobotPlantActiveEffect_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public."RobotPlantShopItem"(id) ON DELETE SET NULL;


--
-- Name: RobotPlantDailyCareAction RobotPlantDailyCareAction_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyCareAction"
    ADD CONSTRAINT "RobotPlantDailyCareAction_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES public."RobotPlantDailyChallenge"(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public."RobotPlantShopItem"(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_zone_id_fkey" FOREIGN KEY (zone_id) REFERENCES public."RobotPlantZone"(id) ON DELETE CASCADE;


--
-- Name: RobotPlantWalletLedger RobotPlantWalletLedger_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantWalletLedger"
    ADD CONSTRAINT "RobotPlantWalletLedger_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantZoneGenerationLog RobotPlantZoneGenerationLog_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZoneGenerationLog"
    ADD CONSTRAINT "RobotPlantZoneGenerationLog_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlant RobotPlant_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlant"
    ADD CONSTRAINT "RobotPlant_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ScanLike ScanLike_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScanLike"
    ADD CONSTRAINT "ScanLike_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SharedScan SharedScan_auth_id_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SharedScan"
    ADD CONSTRAINT "SharedScan_auth_id_from_fkey" FOREIGN KEY (auth_id_from) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SharedScan SharedScan_auth_id_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SharedScan"
    ADD CONSTRAINT "SharedScan_auth_id_to_fkey" FOREIGN KEY (auth_id_to) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TileClaim TileClaim_owner_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TileClaim"
    ADD CONSTRAINT "TileClaim_owner_auth_id_fkey" FOREIGN KEY (owner_auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserAchievement UserAchievement_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAchievement"
    ADD CONSTRAINT "UserAchievement_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserCollectionQuest UserCollectionQuest_collection_quest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollectionQuest"
    ADD CONSTRAINT "UserCollectionQuest_collection_quest_id_fkey" FOREIGN KEY (collection_quest_id) REFERENCES public."CollectionQuest"(id) ON DELETE CASCADE;


--
-- Name: UserCollection UserCollection_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserCollection UserCollection_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."Collection"(id) ON DELETE CASCADE;


--
-- Name: UserEngagementState UserEngagementState_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEngagementState"
    ADD CONSTRAINT "UserEngagementState_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserMonthlyQuest UserMonthlyQuest_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMonthlyQuest"
    ADD CONSTRAINT "UserMonthlyQuest_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserNotification UserNotification_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotification"
    ADD CONSTRAINT "UserNotification_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPlantDiscovery UserPlantDiscovery_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPlantDiscovery"
    ADD CONSTRAINT "UserPlantDiscovery_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserQuest UserQuest_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserQuest"
    ADD CONSTRAINT "UserQuest_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserRewards UserRewards_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserRewards"
    ADD CONSTRAINT "UserRewards_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserWalletLedger UserWalletLedger_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWalletLedger"
    ADD CONSTRAINT "UserWalletLedger_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserWallet UserWallet_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserWeeklyQuest UserWeeklyQuest_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWeeklyQuest"
    ADD CONSTRAINT "UserWeeklyQuest_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: baseUser baseuser_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."baseUser"
    ADD CONSTRAINT baseuser_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Achievements" ENABLE ROW LEVEL SECURITY;

--
-- Name: PublicProfile Allow insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert for authenticated users" ON public."PublicProfile" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: Achievements Authenticated users can read achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read achievements" ON public."Achievements" FOR SELECT TO authenticated USING (true);


--
-- Name: UserAchievement Authenticated users can read all user achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read all user achievements" ON public."UserAchievement" FOR SELECT TO authenticated USING (true);


--
-- Name: PublicProfile Authenticated users can read public profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read public profiles" ON public."PublicProfile" FOR SELECT TO authenticated USING (true);


--
-- Name: Rewards Authenticated users can read rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read rewards" ON public."Rewards" FOR SELECT TO authenticated USING (true);


--
-- Name: ClassroomParticipant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ClassroomParticipant" ENABLE ROW LEVEL SECURITY;

--
-- Name: ClassroomParticipantProgress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ClassroomParticipantProgress" ENABLE ROW LEVEL SECURITY;

--
-- Name: Collection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Collection" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CollectionItem" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CollectionQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: Friend; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Friend" ENABLE ROW LEVEL SECURITY;

--
-- Name: GeoRasterCell; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."GeoRasterCell" ENABLE ROW LEVEL SECURITY;

--
-- Name: LogoAsset; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LogoAsset" ENABLE ROW LEVEL SECURITY;

--
-- Name: MonthlyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MonthlyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: News; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."News" ENABLE ROW LEVEL SECURITY;

--
-- Name: OSMTileChunkLite; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OSMTileChunkLite" ENABLE ROW LEVEL SECURITY;

--
-- Name: OSMTileValue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OSMTileValue" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem Owners manage collection items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage collection items" ON public."CollectionItem" TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND (auth.uid() = c.auth_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND (auth.uid() = c.auth_id)))));


--
-- Name: Collection Owners manage their collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage their collections" ON public."Collection" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: Plant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Plant" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantGenus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantGenus" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantQuiz; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantQuiz" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantQuizExcludedDiscovery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantQuizExcludedDiscovery" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantQuizSlotRoll; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantQuizSlotRoll" ENABLE ROW LEVEL SECURITY;

--
-- Name: PublicProfile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PublicProfile" ENABLE ROW LEVEL SECURITY;

--
-- Name: PublicProfile PublicProfile insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PublicProfile insert own" ON public."PublicProfile" FOR INSERT WITH CHECK ((auth.uid() = auth_id));


--
-- Name: PublicProfile PublicProfile read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PublicProfile read all" ON public."PublicProfile" FOR SELECT USING (true);


--
-- Name: PublicProfile PublicProfile update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PublicProfile update own" ON public."PublicProfile" FOR UPDATE USING ((auth.uid() = auth_id));


--
-- Name: Quest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Quest" ENABLE ROW LEVEL SECURITY;

--
-- Name: RasterCellQueryLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RasterCellQueryLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem Read items of visible collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read items of visible collections" ON public."CollectionItem" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND ((c.is_public = true) OR (auth.uid() = c.auth_id))))));


--
-- Name: Referral; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Referral" ENABLE ROW LEVEL SECURITY;

--
-- Name: Rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Rewards" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlant" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantActiveEffect; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantActiveEffect" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantDailyCareAction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantDailyCareAction" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantDailyChallenge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantDailyChallenge" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantOSMCache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantOSMCache" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantShopItem; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantShopItem" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantUserDailyChallenge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantUserDailyChallenge" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantUserInventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantUserInventory" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantUserZoneState; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantUserZoneState" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantWalletLedger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantWalletLedger" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantZone; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantZone" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantZoneGenerationLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantZoneGenerationLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: ScanLike; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ScanLike" ENABLE ROW LEVEL SECURITY;

--
-- Name: ScanLike ScanLike: authenticated delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ScanLike: authenticated delete own" ON public."ScanLike" FOR DELETE TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: ScanLike ScanLike: authenticated insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ScanLike: authenticated insert own" ON public."ScanLike" FOR INSERT TO authenticated WITH CHECK (((auth_id = auth.uid()) AND (liked_by = auth.email())));


--
-- Name: ScanLike ScanLike: authenticated read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ScanLike: authenticated read all" ON public."ScanLike" FOR SELECT TO authenticated USING (true);


--
-- Name: SharedScan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SharedScan" ENABLE ROW LEVEL SECURITY;

--
-- Name: SharedScan SharedScan insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SharedScan insert own" ON public."SharedScan" FOR INSERT WITH CHECK ((auth.uid() = auth_id_from));


--
-- Name: SharedScan SharedScan read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SharedScan read" ON public."SharedScan" FOR SELECT USING (((auth.uid() = auth_id_from) OR (auth.uid() = auth_id_to)));


--
-- Name: SharedScan SharedScan update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SharedScan update own" ON public."SharedScan" FOR UPDATE USING ((auth.uid() = auth_id_from));


--
-- Name: TileClaim; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TileClaim" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserAchievement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserAchievement" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserCollection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserCollection" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserCollectionQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserCollectionQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserCollectionQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserCollectionQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserEngagementState; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserEngagementState" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserMonthlyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserMonthlyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserMonthlyQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserMonthlyQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserNotification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserNotification" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserPlantDiscovery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserPlantDiscovery" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserRewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserRewards" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWallet" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWalletLedger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWalletLedger" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWeeklyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWeeklyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWeeklyQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWeeklyQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserNotification Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public."UserNotification" FOR DELETE TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserAchievement Users can insert their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own achievements" ON public."UserAchievement" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserNotification Users can insert their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notifications" ON public."UserNotification" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserAchievement Users can read accepted friends achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read accepted friends achievements" ON public."UserAchievement" FOR SELECT TO authenticated USING ((auth_id IN ( SELECT pp.auth_id
   FROM (public."PublicProfile" pp
     JOIN public."Friend" f ON ((((f.request_sent_by = auth.email()) AND (f.request_sent_to = pp.user_email)) OR ((f.request_sent_to = auth.email()) AND (f.request_sent_by = pp.user_email)))))
  WHERE ((f.status = 'accepted'::text) AND (pp.auth_id IS NOT NULL)))));


--
-- Name: UserAchievement Users can read their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own achievements" ON public."UserAchievement" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserNotification Users can read their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own notifications" ON public."UserNotification" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserRewards Users can read their own rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own rewards" ON public."UserRewards" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: Collection Users can read visible collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read visible collections" ON public."Collection" FOR SELECT TO authenticated USING (((is_public = true) OR (auth.uid() = auth_id)));


--
-- Name: UserAchievement Users can update their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own achievements" ON public."UserAchievement" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserNotification Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public."UserNotification" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserCollection Users manage own collection follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own collection follows" ON public."UserCollection" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserCollection Users read own collection follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own collection follows" ON public."UserCollection" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: WeeklyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."WeeklyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem anon_select_public_collection_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select_public_collection_items ON public."CollectionItem" FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND (c.is_public = true)))));


--
-- Name: Collection anon_select_public_collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select_public_collections ON public."Collection" FOR SELECT TO anon USING ((is_public = true));


--
-- Name: Plant authenticated_select_plant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_plant ON public."Plant" FOR SELECT TO authenticated USING (true);


--
-- Name: baseUser; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."baseUser" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserPlantDiscovery discovery_select_local_tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY discovery_select_local_tracking ON public."UserPlantDiscovery" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" pp
  WHERE ((pp.auth_id = "UserPlantDiscovery".auth_id) AND (pp.local_tracking IS NOT FALSE)))));


--
-- Name: Friend friend_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY friend_select_participant ON public."Friend" FOR SELECT TO authenticated USING (((lower(COALESCE(request_sent_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(COALESCE(request_sent_to, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: GeoRasterCell geo_raster_cell_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY geo_raster_cell_select_public ON public."GeoRasterCell" FOR SELECT TO authenticated USING ((is_valid = true));


--
-- Name: LogoAsset logo_asset_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logo_asset_select_authenticated ON public."LogoAsset" FOR SELECT TO authenticated USING ((active = true));


--
-- Name: MonthlyQuest monthlyquest_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monthlyquest_select_auth ON public."MonthlyQuest" FOR SELECT TO authenticated USING (true);


--
-- Name: News news_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_delete_admin ON public."News" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text)))));


--
-- Name: News news_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_insert_admin ON public."News" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text)))));


--
-- Name: News news_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_select_auth ON public."News" FOR SELECT TO authenticated USING (true);


--
-- Name: News news_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_select_authenticated ON public."News" FOR SELECT TO authenticated USING (true);


--
-- Name: News news_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_update_admin ON public."News" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text)))));


--
-- Name: RobotPlantOSMCache osm_cache_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY osm_cache_select_public ON public."RobotPlantOSMCache" FOR SELECT TO authenticated USING (true);


--
-- Name: Plant plant_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_delete_admin ON public."Plant" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: Plant plant_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_insert_admin ON public."Plant" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantQuizExcludedDiscovery plant_quiz_excluded_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_quiz_excluded_select_own ON public."PlantQuizExcludedDiscovery" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: PlantQuiz plant_quiz_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_quiz_select_own ON public."PlantQuiz" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: Plant plant_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_select_auth ON public."Plant" FOR SELECT TO authenticated USING (true);


--
-- Name: Plant plant_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_select_authenticated ON public."Plant" FOR SELECT TO authenticated USING (true);


--
-- Name: Plant plant_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_update_admin ON public."Plant" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantGenus plantgenus_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_delete_admin ON public."PlantGenus" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantGenus plantgenus_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_insert_admin ON public."PlantGenus" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantGenus plantgenus_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_select_all ON public."PlantGenus" FOR SELECT USING (true);


--
-- Name: PlantGenus plantgenus_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_select_auth ON public."PlantGenus" FOR SELECT TO authenticated USING (true);


--
-- Name: PlantGenus plantgenus_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_select_authenticated ON public."PlantGenus" FOR SELECT TO authenticated USING (true);


--
-- Name: PlantGenus plantgenus_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_update_admin ON public."PlantGenus" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PublicProfile publicprofile_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY publicprofile_select_auth ON public."PublicProfile" FOR SELECT TO authenticated USING (true);


--
-- Name: Quest quest_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quest_select_auth ON public."Quest" FOR SELECT TO authenticated USING (true);


--
-- Name: RasterCellQueryLog raster_query_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY raster_query_log_select_own ON public."RasterCellQueryLog" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserPlantDiscovery read_own_and_friends_discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_own_and_friends_discoveries ON public."UserPlantDiscovery" FOR SELECT USING (((auth.uid() = auth_id) OR (EXISTS ( WITH current_user_email AS (
         SELECT lower(pp.user_email) AS email
           FROM public."PublicProfile" pp
          WHERE (pp.auth_id = auth.uid())
         LIMIT 1
        ), discovery_owner_email AS (
         SELECT lower(pp.user_email) AS email
           FROM public."PublicProfile" pp
          WHERE (pp.auth_id = "UserPlantDiscovery".auth_id)
         LIMIT 1
        )
 SELECT 1
   FROM ((current_user_email cue
     JOIN discovery_owner_email doe ON (true))
     JOIN public."Friend" f ON ((((lower(f.request_sent_by) = cue.email) AND (lower(f.request_sent_to) = doe.email)) OR ((lower(f.request_sent_by) = doe.email) AND (lower(f.request_sent_to) = cue.email)))))
  WHERE (f.status = 'accepted'::text)))));


--
-- Name: RobotPlantDailyCareAction robotplant_dailycare_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_dailycare_manage_own ON public."RobotPlantDailyCareAction" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantDailyCareAction robotplant_dailycare_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_dailycare_select_own ON public."RobotPlantDailyCareAction" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantDailyChallenge robotplant_dailychallenge_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_dailychallenge_select_active ON public."RobotPlantDailyChallenge" FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: RobotPlantActiveEffect robotplant_effect_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_effect_manage_own ON public."RobotPlantActiveEffect" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantActiveEffect robotplant_effect_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_effect_select_own ON public."RobotPlantActiveEffect" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlant robotplant_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_insert_own ON public."RobotPlant" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserInventory robotplant_inventory_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_inventory_manage_own ON public."RobotPlantUserInventory" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserInventory robotplant_inventory_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_inventory_select_own ON public."RobotPlantUserInventory" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantWalletLedger robotplant_ledger_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_ledger_select_own ON public."RobotPlantWalletLedger" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlant robotplant_select_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_select_authenticated_all ON public."RobotPlant" FOR SELECT TO authenticated USING (true);


--
-- Name: RobotPlant robotplant_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_select_own ON public."RobotPlant" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantShopItem robotplant_shopitem_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_shopitem_select_active ON public."RobotPlantShopItem" FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: RobotPlant robotplant_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_update_own ON public."RobotPlant" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserDailyChallenge robotplant_userdaily_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userdaily_manage_own ON public."RobotPlantUserDailyChallenge" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserDailyChallenge robotplant_userdaily_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userdaily_select_own ON public."RobotPlantUserDailyChallenge" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserZoneState robotplant_userzonestate_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userzonestate_manage_own ON public."RobotPlantUserZoneState" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserZoneState robotplant_userzonestate_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userzonestate_select_own ON public."RobotPlantUserZoneState" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: ScanLike scanlike_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scanlike_select_auth ON public."ScanLike" FOR SELECT TO authenticated USING (true);


--
-- Name: UserRewards select_own_user_rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_own_user_rewards ON public."UserRewards" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: TileClaim tileclaim_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tileclaim_admin_manage ON public."TileClaim" TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" pp
  WHERE ((pp.auth_id = auth.uid()) AND (pp.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile" pp
  WHERE ((pp.auth_id = auth.uid()) AND (pp.role = 'admin'::text)))));


--
-- Name: TileClaim tileclaim_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tileclaim_select_authenticated ON public."TileClaim" FOR SELECT TO authenticated USING (true);


--
-- Name: UserEngagementState userengagement_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userengagement_select_own ON public."UserEngagementState" FOR SELECT USING ((auth.uid() = auth_id));


--
-- Name: UserMonthlyQuest usermonthlyquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usermonthlyquest_select_own ON public."UserMonthlyQuest" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserPlantDiscovery userplantdiscovery_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userplantdiscovery_select_own ON public."UserPlantDiscovery" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_delete_own ON public."UserQuest" FOR DELETE TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserMonthlyQuest userquest_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_insert_own ON public."UserMonthlyQuest" FOR INSERT WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_insert_own ON public."UserQuest" FOR INSERT TO authenticated WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserWeeklyQuest userquest_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_insert_own ON public."UserWeeklyQuest" FOR INSERT WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserMonthlyQuest userquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_select_own ON public."UserMonthlyQuest" FOR SELECT USING ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_select_own ON public."UserQuest" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserWeeklyQuest userquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_select_own ON public."UserWeeklyQuest" FOR SELECT USING ((auth_id = auth.uid()));


--
-- Name: UserMonthlyQuest userquest_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_update_own ON public."UserMonthlyQuest" FOR UPDATE USING ((auth_id = auth.uid())) WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_update_own ON public."UserQuest" FOR UPDATE TO authenticated USING ((auth_id = auth.uid())) WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserWeeklyQuest userquest_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_update_own ON public."UserWeeklyQuest" FOR UPDATE USING ((auth_id = auth.uid())) WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserPlantDiscovery users can delete own discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete own discoveries" ON public."UserPlantDiscovery" FOR DELETE TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserPlantDiscovery users can insert own discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert own discoveries" ON public."UserPlantDiscovery" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserPlantDiscovery users can update own discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update own discoveries" ON public."UserPlantDiscovery" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserWallet userwallet_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userwallet_select_own ON public."UserWallet" FOR SELECT USING ((auth.uid() = auth_id));


--
-- Name: UserWalletLedger userwalletledger_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userwalletledger_select_own ON public."UserWalletLedger" FOR SELECT USING ((auth.uid() = auth_id));


--
-- Name: UserWeeklyQuest userweeklyquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userweeklyquest_select_own ON public."UserWeeklyQuest" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: WeeklyQuest weeklyquest_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weeklyquest_select_auth ON public."WeeklyQuest" FOR SELECT TO authenticated USING (true);


--
-- Name: RobotPlantZoneGenerationLog zone_gen_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zone_gen_log_select_own ON public."RobotPlantZoneGenerationLog" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- PostgreSQL database dump complete
--

\unrestrict MzDJPUEDFDJLR0cQLN5Ickx9bN8S60wTgNTJYpJ0CVBXtcd0Om7Vb6XtIZY2iKs



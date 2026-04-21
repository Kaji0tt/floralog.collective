-- 039_fix_robot_plant_use_inventory_effect_type_ambiguity.sql
-- Fix ambiguous reference to effect_type in robot_plant_use_inventory_item.

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

grant execute on function public.robot_plant_use_inventory_item(uuid, uuid, text) to authenticated;

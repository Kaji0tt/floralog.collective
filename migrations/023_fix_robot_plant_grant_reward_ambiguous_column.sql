-- Fix ambiguous column reference "energy" in robot_plant_grant_reward RPC.
-- The RETURNS TABLE had columns named energy/data_quality/care which conflicted
-- with the same-named columns in the RobotPlant table inside the UPDATE statement.
-- Renamed to new_energy/new_data_quality/new_care to remove the ambiguity.

drop function if exists public.robot_plant_grant_reward(uuid,text,text,integer,integer,integer,integer,jsonb);

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
  new_energy integer,
  new_data_quality integer,
  new_care integer
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

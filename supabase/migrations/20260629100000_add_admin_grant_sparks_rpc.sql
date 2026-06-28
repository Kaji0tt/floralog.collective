-- Migration: add admin_grant_sparks RPC
-- Allows users with role = 'admin' in PublicProfile to credit sparks to any player.
-- Uses SECURITY DEFINER so the wallet tables are accessible; the admin check
-- is enforced at the start of the function body.

create or replace function public.admin_grant_sparks(
  p_target_auth_id uuid,
  p_event_reference text,
  p_amount integer default 10,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  ledger_id uuid,
  sparks_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_ledger_id uuid;
  v_inserted integer;
  v_wallet public."UserWallet"%rowtype;
begin
  -- Require authenticated caller
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Verify caller has admin role
  select role
    into v_caller_role
    from public."PublicProfile"
   where auth_id = auth.uid()
   limit 1;

  if lower(coalesce(v_caller_role, '')) <> 'admin' then
    raise exception 'Insufficient permissions: admin role required';
  end if;

  -- Validate inputs
  if p_target_auth_id is null then
    raise exception 'p_target_auth_id is required';
  end if;

  if coalesce(length(trim(p_event_reference)), 0) = 0 then
    raise exception 'p_event_reference is required';
  end if;

  if p_amount < 1 or p_amount > 10000 then
    raise exception 'p_amount must be between 1 and 10000';
  end if;

  -- Ensure wallet row exists
  insert into public."UserWallet" (auth_id)
  values (p_target_auth_id)
  on conflict (auth_id) do nothing;

  -- Insert ledger entry (idempotent: same event_reference is ignored)
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
    p_target_auth_id,
    'sparks',
    'credit',
    p_amount,
    'scan_of_the_week',
    p_event_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (auth_id, event_source, event_reference, currency_code) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  -- Already applied (duplicate event_reference) – return current balance
  if v_inserted = 0 then
    select *
      into v_wallet
      from public."UserWallet"
     where auth_id = p_target_auth_id
     limit 1;

    return query
    select false, null::uuid, v_wallet.sparks_balance;
    return;
  end if;

  -- Credit sparks
  update public."UserWallet"
     set sparks_balance = greatest(0, sparks_balance + p_amount),
         updated_at = now()
   where auth_id = p_target_auth_id
  returning * into v_wallet;

  return query
  select true, v_ledger_id, v_wallet.sparks_balance;
end;
$$;

-- Only authenticated users may call this; the function itself enforces admin check
grant execute on function public.admin_grant_sparks(
  uuid,
  text,
  integer,
  jsonb
) to authenticated;

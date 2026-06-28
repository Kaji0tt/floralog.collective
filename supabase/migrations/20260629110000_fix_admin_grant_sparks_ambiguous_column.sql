-- Fix: column reference "sparks_balance" is ambiguous in admin_grant_sparks.
-- The RETURNS TABLE output column "sparks_balance" conflicts with the rowtype
-- field in "return query select ...". Resolved by storing the balance in a
-- dedicated local integer variable before the return statements.

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
  v_caller_role   text;
  v_ledger_id     uuid;
  v_inserted      integer;
  v_wallet        public."UserWallet"%rowtype;
  v_sparks        integer;
begin
  -- Require authenticated caller
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Verify caller has admin role
  select pp.role
    into v_caller_role
    from public."PublicProfile" pp
   where pp.auth_id = auth.uid()
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

  -- Insert ledger entry (idempotent: same event_reference is skipped)
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
    select w.sparks_balance
      into v_sparks
      from public."UserWallet" w
     where w.auth_id = p_target_auth_id
     limit 1;

    return query select false, null::uuid, v_sparks;
    return;
  end if;

  -- Credit sparks and return new balance
  update public."UserWallet" w
     set sparks_balance = greatest(0, w.sparks_balance + p_amount),
         updated_at = now()
   where w.auth_id = p_target_auth_id
  returning w.sparks_balance into v_sparks;

  return query select true, v_ledger_id, v_sparks;
end;
$$;

grant execute on function public.admin_grant_sparks(
  uuid,
  text,
  integer,
  jsonb
) to authenticated;

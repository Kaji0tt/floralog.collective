-- Fix: column reference "seeds_progress"/"sparks_balance"/"amber_balance" is
-- ambiguous in wallet_grant_currency.
--
-- The function's RETURNS TABLE output columns (seeds_progress, sparks_balance,
-- amber_balance) share the exact same names as the columns on
-- public."UserWallet". PL/pgSQL resolves bare column references inside the
-- embedded UPDATE/SELECT statements against both the OUT parameters and the
-- table columns, which raises "column reference ... is ambiguous" (42702) as
-- soon as the wallet is actually debited/credited (i.e. whenever a purchase
-- or reward grant tries to update the balance). This is the same class of bug
-- already fixed for admin_grant_sparks in
-- 20260629110000_fix_admin_grant_sparks_ambiguous_column.sql.
--
-- This broke the shop purchase flow: purchaseAccessory calls
-- public.wallet_grant_currency(..., p_direction => 'debit', ...) to charge
-- sparks/amber, which failed with the ambiguous column error and made every
-- purchase abort with "Kauf fehlgeschlagen".
--
-- Fix: qualify every table column reference with an explicit alias and store
-- results in dedicated scalar variables instead of a rowtype so no bare
-- identifier can collide with the OUT parameter names.

create or replace function public.wallet_grant_currency(
  p_auth_id uuid,
  p_currency_code text,
  p_event_source text,
  p_event_reference text,
  p_amount integer,
  p_direction text default 'credit',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  ledger_id uuid,
  seeds_progress integer,
  sparks_balance integer,
  amber_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_id uuid;
  v_inserted integer;
  v_seeds integer;
  v_sparks integer;
  v_amber integer;
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
    select w.seeds_progress, w.sparks_balance, w.amber_balance
      into v_seeds, v_sparks, v_amber
      from public."UserWallet" w
      where w.auth_id = p_auth_id
      limit 1;

    return query
    select false, null::uuid, v_seeds, v_sparks, v_amber;
    return;
  end if;

  update public."UserWallet" w
  set
    seeds_progress = case
      when p_currency_code = 'seeds_progress' then greatest(0, w.seeds_progress + (v_sign * p_amount))
      else w.seeds_progress
    end,
    sparks_balance = case
      when p_currency_code = 'sparks' then greatest(0, w.sparks_balance + (v_sign * p_amount))
      else w.sparks_balance
    end,
    amber_balance = case
      when p_currency_code = 'amber' then greatest(0, w.amber_balance + (v_sign * p_amount))
      else w.amber_balance
    end,
    updated_at = now()
  where w.auth_id = p_auth_id
  returning w.seeds_progress, w.sparks_balance, w.amber_balance
    into v_seeds, v_sparks, v_amber;

  return query
  select true, v_ledger_id, v_seeds, v_sparks, v_amber;
end;
$$;

grant execute on function public.wallet_grant_currency(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) to authenticated, service_role;

notify pgrst, 'reload schema';

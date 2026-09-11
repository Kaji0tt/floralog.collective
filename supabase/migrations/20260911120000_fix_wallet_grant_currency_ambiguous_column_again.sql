-- Fix: 20260904020215_community_tags.sql re-created wallet_grant_currency()
-- via "create or replace" without the table alias fix from
-- 20260702160000_fix_wallet_grant_currency_ambiguous_column.sql, reintroducing
-- "column reference ... is ambiguous" (42702) on every debit/credit (e.g.
-- purchaseAccessory Spark/Bernstein debits), which aborted shop purchases.
--
-- Same fix as before: qualify every table column reference with an explicit
-- alias and store results in dedicated scalar variables instead of a rowtype,
-- and also carry over lifetime_seeds_earned which the community-tags
-- migration added.

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
    lifetime_seeds_earned = case
      when p_currency_code = 'seeds_progress' and p_direction = 'credit' then w.lifetime_seeds_earned + p_amount
      else w.lifetime_seeds_earned
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

-- 20260513110000_add_multi_currency_wallet.sql
-- Introduces multi-currency wallet for sparks and amber while keeping seeds as progression.

create extension if not exists pgcrypto;

create table if not exists public."UserWallet" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  seeds_progress integer not null default 0 check (seeds_progress >= 0),
  sparks_balance integer not null default 0 check (sparks_balance >= 0),
  amber_balance integer not null default 0 check (amber_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_userwallet_auth_id
  on public."UserWallet"(auth_id);

create table if not exists public."UserWalletLedger" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  currency_code text not null check (currency_code in ('seeds_progress', 'sparks', 'amber')),
  direction text not null default 'credit' check (direction in ('credit', 'debit')),
  amount integer not null check (amount >= 0),
  event_source text not null,
  event_reference text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (auth_id, event_source, event_reference, currency_code)
);

create index if not exists idx_userwalletledger_auth_created
  on public."UserWalletLedger"(auth_id, created_at desc);

create index if not exists idx_userwalletledger_event
  on public."UserWalletLedger"(event_source, event_reference, currency_code);

create table if not exists public."UserEngagementState" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  last_login_date date,
  login_streak_days integer not null default 0 check (login_streak_days >= 0),
  last_daily_login_claim_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_userengagement_auth_id
  on public."UserEngagementState"(auth_id);

-- Keep timestamps in sync.
create or replace function public.set_updated_at_wallet()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_userwallet_updated_at on public."UserWallet";
create trigger trg_userwallet_updated_at
before update on public."UserWallet"
for each row execute function public.set_updated_at_wallet();

drop trigger if exists trg_userengagement_updated_at on public."UserEngagementState";
create trigger trg_userengagement_updated_at
before update on public."UserEngagementState"
for each row execute function public.set_updated_at_wallet();

alter table public."UserWallet" enable row level security;
alter table public."UserWalletLedger" enable row level security;
alter table public."UserEngagementState" enable row level security;

drop policy if exists "userwallet_select_own" on public."UserWallet";
create policy "userwallet_select_own"
  on public."UserWallet"
  for select
  using (auth.uid() = auth_id);

drop policy if exists "userwalletledger_select_own" on public."UserWalletLedger";
create policy "userwalletledger_select_own"
  on public."UserWalletLedger"
  for select
  using (auth.uid() = auth_id);

drop policy if exists "userengagement_select_own" on public."UserEngagementState";
create policy "userengagement_select_own"
  on public."UserEngagementState"
  for select
  using (auth.uid() = auth_id);

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

  update public."UserWallet"
  set
    seeds_progress = case
      when p_currency_code = 'seeds_progress' then greatest(0, seeds_progress + (v_sign * p_amount))
      else seeds_progress
    end,
    sparks_balance = case
      when p_currency_code = 'sparks' then greatest(0, sparks_balance + (v_sign * p_amount))
      else sparks_balance
    end,
    amber_balance = case
      when p_currency_code = 'amber' then greatest(0, amber_balance + (v_sign * p_amount))
      else amber_balance
    end,
    updated_at = now()
  where auth_id = p_auth_id
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

grant execute on function public.wallet_grant_currency(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) to authenticated, service_role;

create or replace function public.claim_daily_login_sparks(
  p_auth_id uuid,
  p_event_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  awarded_amount integer,
  streak_days integer,
  sparks_balance integer,
  claim_date date
)
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.claim_daily_login_sparks(
  uuid,
  text,
  jsonb
) to authenticated, service_role;

-- One-time seed progression snapshot from RobotPlant wallet (if table exists).
do $$
begin
  if to_regclass('public."RobotPlant"') is not null then
    insert into public."UserWallet" (auth_id, seeds_progress)
    select rp.auth_id, greatest(0, coalesce(rp.wallet_balance, 0))
    from public."RobotPlant" rp
    where rp.auth_id is not null
    on conflict (auth_id) do update
      set seeds_progress = greatest(public."UserWallet".seeds_progress, excluded.seeds_progress),
          updated_at = now();
  end if;
end;
$$;
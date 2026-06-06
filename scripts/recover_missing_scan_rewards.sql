-- Recover missing scan seed rewards for one user.
--
-- Usage:
-- 1) Run the inspection query first.
-- 2) If results look correct, run the DO block with your desired per-scan credit.
--
-- NOTE:
-- - This script grants rewards via public.robot_plant_grant_reward to keep ledger + balance consistent.
-- - It is idempotent for the same event_source/event_reference pair.

-- 1) Inspect missing scan-ledger links for one user.
with target_user as (
  select '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid as auth_id
)
select
  d.id as discovery_id,
  d.discovered_date,
  d.plant_id,
  d.image_url
from public."UserPlantDiscovery" d
join target_user tu on tu.auth_id = d.auth_id
left join public."RobotPlantWalletLedger" l
  on l.auth_id = d.auth_id
 and l.event_reference = d.id::text
 and l.event_source in ('scan', 'new_scan', 'new_global_scan', 'recovery_missing_scan_profile')
where l.id is null
order by d.discovered_date asc nulls last;

-- 2) Recovery run (set per-scan amount before execution).
do $$
declare
  v_auth_id uuid := '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid;
  v_seed_credit_per_scan integer := 20; -- TODO: set desired compensation per missing scan
  r record;
begin
  if v_seed_credit_per_scan <= 0 then
    raise exception 'v_seed_credit_per_scan must be > 0';
  end if;

  for r in
    select d.id
    from public."UserPlantDiscovery" d
    left join public."RobotPlantWalletLedger" l
      on l.auth_id = d.auth_id
     and l.event_reference = d.id::text
     and l.event_source in ('scan', 'new_scan', 'new_global_scan', 'recovery_missing_scan_profile')
    where d.auth_id = v_auth_id
      and l.id is null
  loop
    perform *
    from public.robot_plant_grant_reward(
      v_auth_id,
      'recovery_missing_scan_profile',
      r.id::text,
      v_seed_credit_per_scan,
      0,
      0,
      0,
      jsonb_build_object(
        'reason', 'PublicProfile missing during historical scans',
        'recovery_script', 'scripts/recover_missing_scan_rewards.sql'
      )
    );
  end loop;
end;
$$;

-- 3) Authoritative balance preview from existing ledger amounts (no fixed per-scan value).
-- This treats the ledger as source of truth and excludes manual recovery sources.
with target as (
  select '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid as auth_id
), ledger_total as (
  select
    l.auth_id,
    coalesce(sum(
      case
        when l.direction = 'debit' then -l.amount
        else l.amount
      end
    ), 0)::integer as expected_wallet_balance
  from public."RobotPlantWalletLedger" l
  join target t on t.auth_id = l.auth_id
  where l.currency_code = 'seed'
    and l.event_source not in (
      'recovery_missing_scan_profile',
      'recovery_missing_scan_profile_topup_250'
    )
  group by l.auth_id
)
select
  t.auth_id,
  coalesce(rp.wallet_balance, 0) as current_wallet_balance,
  coalesce(lt.expected_wallet_balance, 0) as expected_wallet_balance,
  coalesce(lt.expected_wallet_balance, 0) - coalesce(rp.wallet_balance, 0) as delta
from target t
left join public."RobotPlant" rp on rp.auth_id = t.auth_id
left join ledger_total lt on lt.auth_id = t.auth_id;

-- 4) Apply authoritative sync: set RobotPlant.wallet_balance exactly to ledger-derived value.
do $$
declare
  v_auth_id uuid := '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid;
  v_expected_balance integer := 0;
begin
  select
    coalesce(sum(
      case
        when l.direction = 'debit' then -l.amount
        else l.amount
      end
    ), 0)::integer
  into v_expected_balance
  from public."RobotPlantWalletLedger" l
  where l.auth_id = v_auth_id
    and l.currency_code = 'seed'
    and l.event_source not in (
      'recovery_missing_scan_profile',
      'recovery_missing_scan_profile_topup_250'
    );

  insert into public."RobotPlant" (auth_id, wallet_balance, updated_at)
  values (v_auth_id, greatest(0, v_expected_balance), now())
  on conflict (auth_id) do update
  set
    wallet_balance = excluded.wallet_balance,
    updated_at = now();
end;
$$;

-- 5) Verification after sync.
with target as (
  select '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid as auth_id
), ledger_total as (
  select
    l.auth_id,
    coalesce(sum(
      case
        when l.direction = 'debit' then -l.amount
        else l.amount
      end
    ), 0)::integer as expected_wallet_balance
  from public."RobotPlantWalletLedger" l
  join target t on t.auth_id = l.auth_id
  where l.currency_code = 'seed'
    and l.event_source not in (
      'recovery_missing_scan_profile',
      'recovery_missing_scan_profile_topup_250'
    )
  group by l.auth_id
)
select
  t.auth_id,
  coalesce(rp.wallet_balance, 0) as current_wallet_balance,
  coalesce(lt.expected_wallet_balance, 0) as expected_wallet_balance,
  coalesce(lt.expected_wallet_balance, 0) - coalesce(rp.wallet_balance, 0) as delta
from target t
left join public."RobotPlant" rp on rp.auth_id = t.auth_id
left join ledger_total lt on lt.auth_id = t.auth_id;

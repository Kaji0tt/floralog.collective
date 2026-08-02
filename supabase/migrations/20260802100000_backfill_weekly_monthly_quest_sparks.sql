-- Migration: Retroactive spark grant for weekly (10) and monthly (15) quest completions
-- since season start 2026-06-22.
--
-- Weekly quests previously granted +10 seeds as bonus; they now grant +10 Funken (sparks).
-- Monthly quests already granted +15 sparks from the app since this season, but this
-- backfill ensures anyone whose monthly grant may have been missed also receives them.
--
-- Both inserts are idempotent: ON CONFLICT (auth_id, event_source, event_reference, currency_code) DO NOTHING
-- ensures no double-grants.

do $$
declare
  r record;
begin

  -- ── 1. Weekly quest completions → +10 sparks each ──────────────────────────
  for r in
    select uwq.auth_id, uwq.id as user_quest_id
      from public."UserWeeklyQuest" uwq
     where uwq.status = 'redeemed'
       and uwq.redeemed_date >= '2026-06-22T00:00:00Z'
       and uwq.auth_id is not null
  loop
    -- Ensure wallet row exists
    insert into public."UserWallet" (auth_id)
    values (r.auth_id)
    on conflict (auth_id) do nothing;

    -- Insert ledger entry (idempotent)
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
      r.auth_id,
      'sparks',
      'credit',
      10,
      'weekly_quest_redeem_spark',
      'weekly_quest_spark:' || r.user_quest_id::text,
      '{"source": "backfill", "quest_type": "weekly", "backfill_migration": "20260802100000"}'::jsonb
    )
    on conflict (auth_id, event_source, event_reference, currency_code) do nothing;

    -- Credit sparks only when the ledger row was actually inserted
    if found then
      update public."UserWallet"
         set sparks_balance = greatest(0, sparks_balance + 10),
             updated_at     = now()
       where auth_id = r.auth_id;
    end if;
  end loop;

  -- ── 2. Monthly quest completions → +15 sparks each ─────────────────────────
  for r in
    select umq.auth_id, umq.id as user_quest_id
      from public."UserMonthlyQuest" umq
     where umq.status = 'redeemed'
       and umq.redeemed_date >= '2026-06-22T00:00:00Z'
       and umq.auth_id is not null
  loop
    insert into public."UserWallet" (auth_id)
    values (r.auth_id)
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
      r.auth_id,
      'sparks',
      'credit',
      15,
      'monthly_quest_redeem_spark',
      'monthly:' || r.user_quest_id::text,
      '{"source": "backfill", "quest_type": "monthly", "backfill_migration": "20260802100000"}'::jsonb
    )
    on conflict (auth_id, event_source, event_reference, currency_code) do nothing;

    if found then
      update public."UserWallet"
         set sparks_balance = greatest(0, sparks_balance + 15),
             updated_at     = now()
       where auth_id = r.auth_id;
    end if;
  end loop;

end;
$$;

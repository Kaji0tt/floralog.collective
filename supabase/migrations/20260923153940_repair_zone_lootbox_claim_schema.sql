-- Align the live legacy claim table with the retry-safe claimZoneLootbox contract.
alter table public."ZoneLootboxClaim"
	add column if not exists claim_key text,
	add column if not exists reward_status text not null default 'granted',
	add column if not exists duplicate_seed_value integer not null default 0,
	add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public."ZoneLootboxClaim"
	alter column zone_id drop not null,
	alter column activation_key drop not null,
	alter column entry_id drop not null,
	alter column reward_id drop not null;

alter table public."ZoneLootboxClaim"
	drop constraint if exists zone_lootbox_claim_reward_status_check,
	drop constraint if exists zone_lootbox_claim_duplicate_seed_value_check;

alter table public."ZoneLootboxClaim"
	add constraint zone_lootbox_claim_reward_status_check
		check (reward_status in ('granted', 'duplicate_compensated')),
	add constraint zone_lootbox_claim_duplicate_seed_value_check
		check (duplicate_seed_value >= 0);

create unique index if not exists zone_lootbox_claim_auth_claim_key_key
	on public."ZoneLootboxClaim" (auth_id, claim_key)
	where claim_key is not null;

notify pgrst, 'reload schema';

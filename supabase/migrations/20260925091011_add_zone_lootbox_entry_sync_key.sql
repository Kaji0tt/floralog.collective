-- Currency amounts are editable, so they cannot safely identify entries across pools.
ALTER TABLE public."ZoneLootboxEntry"
	ADD COLUMN IF NOT EXISTS sync_key uuid;

WITH currency_occurrences AS (
	SELECT
		id,
		currency_code,
		selection_group,
		shared_only,
		currency_amount,
		row_number() OVER (
			PARTITION BY pool_id, currency_code, selection_group, shared_only, currency_amount
			ORDER BY id
		) AS occurrence
	FROM public."ZoneLootboxEntry"
	WHERE reward_id IS NULL
		AND currency_code IS NOT NULL
), currency_group_keys AS (
	SELECT
		currency_code,
		selection_group,
		shared_only,
		currency_amount,
		occurrence,
		(array_agg(id ORDER BY id))[1] AS sync_key
	FROM currency_occurrences
	GROUP BY currency_code, selection_group, shared_only, currency_amount, occurrence
)
UPDATE public."ZoneLootboxEntry" entry
SET sync_key = group_keys.sync_key
FROM currency_occurrences occurrences
JOIN currency_group_keys group_keys
	ON group_keys.currency_code = occurrences.currency_code
	AND group_keys.selection_group = occurrences.selection_group
	AND group_keys.shared_only = occurrences.shared_only
	AND group_keys.currency_amount IS NOT DISTINCT FROM occurrences.currency_amount
	AND group_keys.occurrence = occurrences.occurrence
WHERE entry.id = occurrences.id
	AND entry.sync_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_zone_lootbox_entry_sync_key
	ON public."ZoneLootboxEntry" (sync_key)
	WHERE sync_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';

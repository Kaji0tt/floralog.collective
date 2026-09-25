-- The update trigger created for ZoneLootboxEntry requires this column.
ALTER TABLE public."ZoneLootboxEntry"
	ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';

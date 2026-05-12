-- Allow owners to assign a visible name to connected claimed-tile groups.

ALTER TABLE public."TileClaim"
  ADD COLUMN IF NOT EXISTS claim_group_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tileclaim_claim_group_name_length'
  ) THEN
    ALTER TABLE public."TileClaim"
      ADD CONSTRAINT tileclaim_claim_group_name_length
      CHECK (
        claim_group_name IS NULL OR
        (char_length(claim_group_name) >= 3 AND char_length(claim_group_name) <= 48)
      );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

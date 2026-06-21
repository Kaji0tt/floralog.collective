DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'PublicProfile'
			AND column_name = 'bot_name'
	) THEN
		ALTER TABLE public."PublicProfile"
			ADD COLUMN bot_name text;
	END IF;
END;
$$;

COMMENT ON COLUMN public."PublicProfile".bot_name IS 'LLM-generated Florabot companion name.';

NOTIFY pgrst, 'reload schema';

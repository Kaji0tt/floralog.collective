-- Allow the LootAdmin UI to manage pools and entries without exposing writes to players.
DROP POLICY IF EXISTS "zone_lootbox_pool_admin_manage" ON public."ZoneLootboxPool";
CREATE POLICY "zone_lootbox_pool_admin_manage"
	ON public."ZoneLootboxPool"
	FOR ALL
	TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public."PublicProfile" profile
			WHERE profile.auth_id = (SELECT auth.uid())
				AND lower(coalesce(profile.role, '')) = 'admin'
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1
			FROM public."PublicProfile" profile
			WHERE profile.auth_id = (SELECT auth.uid())
				AND lower(coalesce(profile.role, '')) = 'admin'
		)
	);

DROP POLICY IF EXISTS "zone_lootbox_entry_admin_manage" ON public."ZoneLootboxEntry";
CREATE POLICY "zone_lootbox_entry_admin_manage"
	ON public."ZoneLootboxEntry"
	FOR ALL
	TO authenticated
	USING (
		EXISTS (
			SELECT 1
			FROM public."PublicProfile" profile
			WHERE profile.auth_id = (SELECT auth.uid())
				AND lower(coalesce(profile.role, '')) = 'admin'
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1
			FROM public."PublicProfile" profile
			WHERE profile.auth_id = (SELECT auth.uid())
				AND lower(coalesce(profile.role, '')) = 'admin'
		)
	);

NOTIFY pgrst, 'reload schema';

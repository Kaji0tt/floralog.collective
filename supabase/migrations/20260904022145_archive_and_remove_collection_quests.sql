-- Collection quests were never seeded, but retain any unexpected production
-- rows before removing the prepared feature completely.
create table if not exists public."CommunityTagLegacyArchive" (
	id uuid primary key default gen_random_uuid(),
	source_table text not null,
	source_id text not null,
	payload jsonb not null,
	archived_at timestamptz not null default now(),
	unique (source_table, source_id)
);

alter table public."CommunityTagLegacyArchive" enable row level security;
grant select on public."CommunityTagLegacyArchive" to authenticated;

drop policy if exists "community_tag_legacy_archive_select_admin" on public."CommunityTagLegacyArchive";
create policy "community_tag_legacy_archive_select_admin"
	on public."CommunityTagLegacyArchive" for select to authenticated
	using (
		exists (
			select 1 from public."PublicProfile" profile
			where profile.auth_id = (select auth.uid())
				and lower(coalesce(profile.role, '')) = 'admin'
		)
	);

do $$
begin
	if to_regclass('public."CollectionQuest"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'CollectionQuest', quest.id::text, to_jsonb(quest)
		from public."CollectionQuest" quest
		on conflict (source_table, source_id) do nothing;
	end if;

	if to_regclass('public."UserCollectionQuest"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'UserCollectionQuest', quest.id::text, to_jsonb(quest)
		from public."UserCollectionQuest" quest
		on conflict (source_table, source_id) do nothing;
	end if;
end;
$$;

drop table if exists public."UserCollectionQuest" cascade;
drop table if exists public."CollectionQuest" cascade;

notify pgrst, 'reload schema';

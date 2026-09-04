-- Preserve the complete curated-collection history before the UI and tables are retired.
-- CommunityTagLegacyArchive is created by the preceding collection-quest migration.
do $$
begin
	if to_regclass('public."Collection"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'Collection', collection.id::text, to_jsonb(collection)
		from public."Collection" collection
		on conflict (source_table, source_id) do nothing;
	end if;

	if to_regclass('public."CollectionItem"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'CollectionItem', item.id::text, to_jsonb(item)
		from public."CollectionItem" item
		on conflict (source_table, source_id) do nothing;
	end if;

	if to_regclass('public."UserCollection"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'UserCollection', user_collection.id::text, to_jsonb(user_collection)
		from public."UserCollection" user_collection
		on conflict (source_table, source_id) do nothing;
	end if;

	if to_regclass('public."CollectionMaintainer"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'CollectionMaintainer', maintainer.id::text, to_jsonb(maintainer)
		from public."CollectionMaintainer" maintainer
		on conflict (source_table, source_id) do nothing;
	end if;

	if to_regclass('public."CollectionItemProposal"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'CollectionItemProposal', proposal.id::text, to_jsonb(proposal)
		from public."CollectionItemProposal" proposal
		on conflict (source_table, source_id) do nothing;
	end if;
end;
$$;

-- For each target/value pair the oldest collection owns the migrated tag.
-- Gattungstags are inserted first so they remain the source of truth for all species.
with ranked_genus_items as (
	select distinct on (item.genus_id, lower(btrim(collection.title)))
		item.genus_id,
		collection.auth_id as created_by_auth_id,
		btrim(collection.title) as value,
		lower(btrim(collection.title)) as normalized_value
	from public."CollectionItem" item
	join public."Collection" collection on collection.id = item.collection_id
	where item.genus_id is not null
		and collection.auth_id is not null
		and char_length(btrim(collection.title)) between 1 and 32
	order by item.genus_id, lower(btrim(collection.title)), collection.created_at nulls last, collection.id
)
insert into public."CommunityTag" (genus_id, created_by_auth_id, value, normalized_value)
select genus_id, created_by_auth_id, value, normalized_value
from ranked_genus_items
on conflict do nothing;

-- A matching genus tag supersedes an existing direct species tag but does not
-- transfer its votes, score, author, or quality-ledger history.
update public."CommunityTag" species_tag
set
	status = 'superseded_by_genus_tag',
	superseded_by_tag_id = genus_tag.id,
	updated_at = now()
from public."Plant" plant
join public."PlantGenus" genus
	on genus.category = plant.genus_category
	and genus.category_dex_number = plant.genus_number
join public."CommunityTag" genus_tag
	on genus_tag.genus_id = genus.id
	and genus_tag.status = 'active'
where species_tag.plant_id = plant.id
	and species_tag.status = 'active'
	and genus_tag.normalized_value = species_tag.normalized_value;

with ranked_plant_items as (
	select distinct on (item.plant_id, lower(btrim(collection.title)))
		item.plant_id,
		collection.auth_id as created_by_auth_id,
		btrim(collection.title) as value,
		lower(btrim(collection.title)) as normalized_value
	from public."CollectionItem" item
	join public."Collection" collection on collection.id = item.collection_id
	where item.plant_id is not null
		and collection.auth_id is not null
		and char_length(btrim(collection.title)) between 1 and 32
	order by item.plant_id, lower(btrim(collection.title)), collection.created_at nulls last, collection.id
)
insert into public."CommunityTag" (plant_id, created_by_auth_id, value, normalized_value)
select item.plant_id, item.created_by_auth_id, item.value, item.normalized_value
from ranked_plant_items item
join public."Plant" plant on plant.id = item.plant_id
join public."PlantGenus" genus
	on genus.category = plant.genus_category
	and genus.category_dex_number = plant.genus_number
where not exists (
	select 1
	from public."CommunityTag" genus_tag
	where genus_tag.genus_id = genus.id
		and genus_tag.normalized_value = item.normalized_value
		and genus_tag.status = 'active'
)
on conflict do nothing;

notify pgrst, 'reload schema';

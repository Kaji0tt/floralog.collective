-- The preceding migration archived and migrated all collection records to
-- CommunityTag. Remove only collection-specific database objects here.
drop policy if exists "Collection select by maintainers" on public."Collection";
drop policy if exists "Collection update by maintainers" on public."Collection";
drop policy if exists "CollectionItem manage by maintainers" on public."CollectionItem";
drop policy if exists "CollectionMaintainer select visible" on public."CollectionMaintainer";
drop policy if exists "CollectionMaintainer owner manage" on public."CollectionMaintainer";
drop policy if exists "CollectionItemProposal select own_or_maintainer" on public."CollectionItemProposal";
drop policy if exists "CollectionItemProposal insert public_contribution" on public."CollectionItemProposal";
drop policy if exists "CollectionItemProposal review by maintainers" on public."CollectionItemProposal";
drop policy if exists "CollectionItemProposal delete own_pending" on public."CollectionItemProposal";

drop trigger if exists trg_collection_sync_owner_maintainer on public."Collection";
drop trigger if exists trg_collectionitemproposal_set_review_fields on public."CollectionItemProposal";
drop trigger if exists trg_collectionitemproposal_apply_approval on public."CollectionItemProposal";

drop function if exists public.apply_collectionitemproposal_approval();
drop function if exists public.set_collectionitemproposal_review_fields();
drop function if exists public.can_manage_collection_maintainers(uuid, uuid);
drop function if exists public.is_collection_maintainer(uuid, uuid);
drop function if exists public.sync_collection_owner_as_maintainer();

-- Classroom participation is part of the retired collection model. Preserve
-- it in the admin-only archive before removing its Collection foreign keys.
do $$
begin
	if to_regclass('public."ClassroomParticipantProgress"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'ClassroomParticipantProgress', progress.id::text, to_jsonb(progress)
		from public."ClassroomParticipantProgress" progress
		on conflict (source_table, source_id) do nothing;
	end if;

	if to_regclass('public."ClassroomParticipant"') is not null then
		insert into public."CommunityTagLegacyArchive" (source_table, source_id, payload)
		select 'ClassroomParticipant', participant.id::text, to_jsonb(participant)
		from public."ClassroomParticipant" participant
		on conflict (source_table, source_id) do nothing;
	end if;
end;
$$;

drop table if exists public."ClassroomParticipantProgress";
drop table if exists public."ClassroomParticipant";
drop table if exists public."CollectionItemProposal";
drop table if exists public."CollectionMaintainer";
drop table if exists public."UserCollection";
drop table if exists public."CollectionItem";
drop table if exists public."Collection";

notify pgrst, 'reload schema';

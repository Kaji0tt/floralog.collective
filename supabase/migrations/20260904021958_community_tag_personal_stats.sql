-- Read-only personal tag statistics. Detailed ledger history remains available
-- through its own RLS policy for a future statistics interface.
create or replace function public.get_community_tag_personal_stats()
returns table (
	tags_created integer,
	active_tags integer,
	received_positive_votes integer,
	received_negative_votes integer,
	quality_delta_from_tags integer
)
language sql
security invoker
set search_path = public
as $$
	select
		count(*)::integer as tags_created,
		count(*) filter (where tag.status = 'active')::integer as active_tags,
		coalesce(sum(tag.positive_votes), 0)::integer as received_positive_votes,
		coalesce(sum(tag.negative_votes), 0)::integer as received_negative_votes,
		coalesce((
			select sum(ledger.applied_quality_delta)
			from public."CommunityTagQualityLedger" ledger
			where ledger.tag_creator_auth_id = auth.uid()
		), 0)::integer as quality_delta_from_tags
	from public."CommunityTag" tag
	where tag.created_by_auth_id = auth.uid();
$$;

revoke all on function public.get_community_tag_personal_stats() from public;
grant execute on function public.get_community_tag_personal_stats() to authenticated;

notify pgrst, 'reload schema';

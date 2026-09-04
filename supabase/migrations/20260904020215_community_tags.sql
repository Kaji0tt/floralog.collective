-- Community tags replace curated collections with a vote-backed knowledge layer.
-- Scores and data-quality effects are only mutated by the RPCs below.
create extension if not exists pgcrypto;

alter table public."UserWallet"
	add column if not exists lifetime_seeds_earned integer not null default 0
	check (lifetime_seeds_earned >= 0);

update public."UserWallet" wallet
set lifetime_seeds_earned = greatest(
	wallet.lifetime_seeds_earned,
	wallet.seeds_progress,
	coalesce((
		select sum(ledger.amount)::integer
		from public."UserWalletLedger" ledger
		where ledger.auth_id = wallet.auth_id
			and ledger.currency_code = 'seeds_progress'
			and ledger.direction = 'credit'
	), 0)
);

create table if not exists public."CommunityTag" (
	id uuid primary key default gen_random_uuid(),
	plant_id text references public."Plant"(id) on delete cascade,
	genus_id text references public."PlantGenus"(id) on delete cascade,
	created_by_auth_id uuid not null references auth.users(id) on delete restrict,
	value text not null,
	normalized_value text not null,
	positive_votes integer not null default 0 check (positive_votes >= 0),
	negative_votes integer not null default 0 check (negative_votes >= 0),
	score integer not null default 0,
	status text not null default 'active'
		check (status in ('active', 'deleted_by_creator', 'hidden_by_admin', 'superseded_by_genus_tag')),
	superseded_by_tag_id uuid references public."CommunityTag"(id) on delete restrict,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	check ((plant_id is null) <> (genus_id is null)),
	check (char_length(btrim(value)) between 1 and 32),
	check (normalized_value = lower(btrim(value))),
	check (score = positive_votes - negative_votes),
	check (
		(status = 'superseded_by_genus_tag' and superseded_by_tag_id is not null)
		or (status <> 'superseded_by_genus_tag' and superseded_by_tag_id is null)
	)
);

-- Historical tags remain reserved, including tags deleted by their creator.
create unique index if not exists community_tag_plant_value_unique
	on public."CommunityTag" (plant_id, normalized_value)
	where plant_id is not null;

create unique index if not exists community_tag_genus_value_unique
	on public."CommunityTag" (genus_id, normalized_value)
	where genus_id is not null;

create index if not exists community_tag_active_plant_idx
	on public."CommunityTag" (plant_id, normalized_value)
	where status = 'active';

create index if not exists community_tag_active_genus_idx
	on public."CommunityTag" (genus_id, normalized_value)
	where status = 'active';

create table if not exists public."CommunityTagVote" (
	tag_id uuid not null references public."CommunityTag"(id) on delete cascade,
	voter_auth_id uuid not null references auth.users(id) on delete cascade,
	vote smallint not null check (vote in (-1, 1)),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (tag_id, voter_auth_id)
);

create table if not exists public."CommunityTagQualityLedger" (
	id uuid primary key default gen_random_uuid(),
	tag_id uuid not null references public."CommunityTag"(id) on delete restrict,
	voter_auth_id uuid not null references auth.users(id) on delete restrict,
	tag_creator_auth_id uuid not null references auth.users(id) on delete restrict,
	previous_vote smallint check (previous_vote in (-1, 1)),
	new_vote smallint check (new_vote in (-1, 1)),
	vote_delta integer not null check (vote_delta between -2 and 2 and vote_delta <> 0),
	applied_quality_delta integer not null,
	quality_before integer not null check (quality_before between 0 and 100),
	quality_after integer not null check (quality_after between 0 and 100),
	created_at timestamptz not null default now(),
	check (applied_quality_delta = quality_after - quality_before)
);

create index if not exists community_tag_quality_ledger_creator_idx
	on public."CommunityTagQualityLedger" (tag_creator_auth_id, created_at desc);

create table if not exists public."CommunityTagReport" (
	id uuid primary key default gen_random_uuid(),
	tag_id uuid not null references public."CommunityTag"(id) on delete cascade,
	reported_by_auth_id uuid not null references auth.users(id) on delete cascade,
	reason text not null check (char_length(btrim(reason)) between 1 and 500),
	status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
	reviewed_by_auth_id uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now(),
	unique (tag_id, reported_by_auth_id)
);

alter table public."CommunityTag" enable row level security;
alter table public."CommunityTagVote" enable row level security;
alter table public."CommunityTagQualityLedger" enable row level security;
alter table public."CommunityTagReport" enable row level security;

grant select on public."CommunityTag" to authenticated;
grant select on public."CommunityTagVote" to authenticated;
grant select on public."CommunityTagQualityLedger" to authenticated;
grant select on public."CommunityTagReport" to authenticated;

create policy "community_tag_select_visible"
	on public."CommunityTag" for select to authenticated
	using (status = 'active' or created_by_auth_id = (select auth.uid()));

create policy "community_tag_vote_select_own"
	on public."CommunityTagVote" for select to authenticated
	using (voter_auth_id = (select auth.uid()));

create policy "community_tag_quality_ledger_select_own"
	on public."CommunityTagQualityLedger" for select to authenticated
	using (tag_creator_auth_id = (select auth.uid()));

create policy "community_tag_report_select_own_or_admin"
	on public."CommunityTagReport" for select to authenticated
	using (
		reported_by_auth_id = (select auth.uid())
		or exists (
			select 1 from public."PublicProfile" profile
			where profile.auth_id = (select auth.uid())
				and lower(coalesce(profile.role, '')) = 'admin'
		)
	);

create or replace function public.wallet_grant_currency(
	p_auth_id uuid,
	p_currency_code text,
	p_event_source text,
	p_event_reference text,
	p_amount integer,
	p_direction text default 'credit',
	p_metadata jsonb default '{}'::jsonb
)
returns table (
	applied boolean,
	ledger_id uuid,
	seeds_progress integer,
	sparks_balance integer,
	amber_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
	v_ledger_id uuid;
	v_inserted integer;
	v_wallet public."UserWallet"%rowtype;
	v_sign integer;
begin
	if p_auth_id is null then raise exception 'p_auth_id is required'; end if;
	if auth.uid() is not null and auth.uid() <> p_auth_id then raise exception 'p_auth_id must match auth.uid()'; end if;
	if coalesce(length(trim(p_currency_code)), 0) = 0 then raise exception 'p_currency_code is required'; end if;
	if coalesce(length(trim(p_event_source)), 0) = 0 then raise exception 'p_event_source is required'; end if;
	if coalesce(length(trim(p_event_reference)), 0) = 0 then raise exception 'p_event_reference is required'; end if;
	if p_amount < 0 then raise exception 'p_amount must be >= 0'; end if;
	if p_currency_code not in ('seeds_progress', 'sparks', 'amber') then raise exception 'unsupported currency_code %', p_currency_code; end if;
	if p_direction not in ('credit', 'debit') then raise exception 'p_direction must be credit or debit'; end if;

	v_sign := case when p_direction = 'credit' then 1 else -1 end;
	insert into public."UserWallet" (auth_id) values (p_auth_id) on conflict (auth_id) do nothing;

	insert into public."UserWalletLedger" (auth_id, currency_code, direction, amount, event_source, event_reference, metadata)
	values (p_auth_id, p_currency_code, p_direction, p_amount, p_event_source, p_event_reference, coalesce(p_metadata, '{}'::jsonb))
	on conflict (auth_id, event_source, event_reference, currency_code) do nothing
	returning id into v_ledger_id;
	get diagnostics v_inserted = row_count;

	if v_inserted = 0 then
		select * into v_wallet from public."UserWallet" where auth_id = p_auth_id;
		return query select false, null::uuid, v_wallet.seeds_progress, v_wallet.sparks_balance, v_wallet.amber_balance;
		return;
	end if;

	update public."UserWallet"
	set
		seeds_progress = case when p_currency_code = 'seeds_progress' then greatest(0, seeds_progress + (v_sign * p_amount)) else seeds_progress end,
		lifetime_seeds_earned = case when p_currency_code = 'seeds_progress' and p_direction = 'credit' then lifetime_seeds_earned + p_amount else lifetime_seeds_earned end,
		sparks_balance = case when p_currency_code = 'sparks' then greatest(0, sparks_balance + (v_sign * p_amount)) else sparks_balance end,
		amber_balance = case when p_currency_code = 'amber' then greatest(0, amber_balance + (v_sign * p_amount)) else amber_balance end,
		updated_at = now()
	where auth_id = p_auth_id
	returning * into v_wallet;

	return query select true, v_ledger_id, v_wallet.seeds_progress, v_wallet.sparks_balance, v_wallet.amber_balance;
end;
$$;

create or replace function public.create_community_tag(
	p_plant_id text default null,
	p_genus_id text default null,
	p_value text default null
)
returns public."CommunityTag"
language plpgsql
security definer
set search_path = public
as $$
declare
	v_auth_id uuid := auth.uid();
	v_normalized_value text := lower(btrim(coalesce(p_value, '')));
	v_tag public."CommunityTag"%rowtype;
	v_genus public."PlantGenus"%rowtype;
begin
	if v_auth_id is null then raise exception 'authenticated user is required'; end if;
	if (p_plant_id is null) = (p_genus_id is null) then raise exception 'exactly one target is required'; end if;
	if char_length(v_normalized_value) not between 1 and 32 then raise exception 'tag must contain 1 to 32 characters'; end if;
	if coalesce((select lifetime_seeds_earned from public."UserWallet" where auth_id = v_auth_id), 0) < 5000 then
		raise exception '5000 lifetime seeds are required to create tags';
	end if;

	if p_plant_id is not null then
		select genus.* into v_genus
		from public."Plant" plant
		join public."PlantGenus" genus on genus.category = plant.genus_category and genus.category_dex_number = plant.genus_number
		where plant.id = p_plant_id;
		if not found then raise exception 'plant not found'; end if;
		if exists (
			select 1 from public."CommunityTag" tag
			where tag.genus_id = v_genus.id and tag.normalized_value = v_normalized_value and tag.status = 'active'
		) then raise exception 'the genus already provides this tag'; end if;
	else
		select * into v_genus from public."PlantGenus" where id = p_genus_id;
		if not found then raise exception 'genus not found'; end if;
	end if;

	insert into public."CommunityTag" (plant_id, genus_id, created_by_auth_id, value, normalized_value)
	values (p_plant_id, p_genus_id, v_auth_id, btrim(p_value), v_normalized_value)
	returning * into v_tag;

	if p_genus_id is not null then
		update public."CommunityTag" tag
		set status = 'superseded_by_genus_tag', superseded_by_tag_id = v_tag.id, updated_at = now()
		where tag.status = 'active'
			and tag.plant_id in (
				select plant.id from public."Plant" plant
				where plant.genus_category = v_genus.category and plant.genus_number = v_genus.category_dex_number
			)
			and tag.normalized_value = v_normalized_value;
	end if;

	return v_tag;
end;
$$;

create or replace function public.cast_community_tag_vote(
	p_tag_id uuid,
	p_vote smallint default null
)
returns table (
	tag_id uuid,
	positive_votes integer,
	negative_votes integer,
	score integer,
	applied_quality_delta integer,
	quality_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
	v_auth_id uuid := auth.uid();
	v_tag public."CommunityTag"%rowtype;
	v_previous_vote smallint;
	v_vote_delta integer;
	v_positive_delta integer;
	v_negative_delta integer;
	v_quality_before integer;
	v_quality_after integer;
begin
	if v_auth_id is null then raise exception 'authenticated user is required'; end if;
	if p_vote is not null and p_vote not in (-1, 1) then raise exception 'p_vote must be -1, 1, or null'; end if;
	if coalesce((select lifetime_seeds_earned from public."UserWallet" where auth_id = v_auth_id), 0) < 5000 then
		raise exception '5000 lifetime seeds are required to vote';
	end if;

	select * into v_tag from public."CommunityTag" where id = p_tag_id for update;
	if not found or v_tag.status <> 'active' then raise exception 'tag is not available for voting'; end if;
	if v_tag.created_by_auth_id = v_auth_id then raise exception 'tag creators cannot vote on their own tags'; end if;

	select vote into v_previous_vote from public."CommunityTagVote"
	where tag_id = p_tag_id and voter_auth_id = v_auth_id for update;
	v_vote_delta := coalesce(p_vote, 0) - coalesce(v_previous_vote, 0);

	if v_vote_delta = 0 then
		select data_quality into v_quality_after from public."RobotPlant" where auth_id = v_tag.created_by_auth_id;
		return query select v_tag.id, v_tag.positive_votes, v_tag.negative_votes, v_tag.score, 0, coalesce(v_quality_after, 65);
		return;
	end if;

	if p_vote is null then
		delete from public."CommunityTagVote" where tag_id = p_tag_id and voter_auth_id = v_auth_id;
	else
		insert into public."CommunityTagVote" (tag_id, voter_auth_id, vote)
		values (p_tag_id, v_auth_id, p_vote)
		on conflict (tag_id, voter_auth_id) do update set vote = excluded.vote, updated_at = now();
	end if;

	v_positive_delta := (case when p_vote = 1 then 1 else 0 end) - (case when v_previous_vote = 1 then 1 else 0 end);
	v_negative_delta := (case when p_vote = -1 then 1 else 0 end) - (case when v_previous_vote = -1 then 1 else 0 end);
	update public."CommunityTag"
	set positive_votes = positive_votes + v_positive_delta,
			negative_votes = negative_votes + v_negative_delta,
			score = score + v_vote_delta,
			updated_at = now()
	where id = p_tag_id
	returning * into v_tag;

	insert into public."RobotPlant" (auth_id) values (v_tag.created_by_auth_id) on conflict (auth_id) do nothing;
	select data_quality into v_quality_before from public."RobotPlant" where auth_id = v_tag.created_by_auth_id for update;
	update public."RobotPlant"
	set data_quality = least(100, greatest(0, data_quality + v_vote_delta)), updated_at = now()
	where auth_id = v_tag.created_by_auth_id
	returning data_quality into v_quality_after;

	insert into public."CommunityTagQualityLedger" (
		tag_id, voter_auth_id, tag_creator_auth_id, previous_vote, new_vote,
		vote_delta, applied_quality_delta, quality_before, quality_after
	) values (
		p_tag_id, v_auth_id, v_tag.created_by_auth_id, v_previous_vote, p_vote,
		v_vote_delta, v_quality_after - v_quality_before, v_quality_before, v_quality_after
	);

	return query select v_tag.id, v_tag.positive_votes, v_tag.negative_votes, v_tag.score, v_quality_after - v_quality_before, v_quality_after;
end;
$$;

create or replace function public.delete_community_tag(p_tag_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	update public."CommunityTag"
	set status = 'deleted_by_creator', deleted_at = now(), updated_at = now()
	where id = p_tag_id and created_by_auth_id = auth.uid() and status = 'active';
	if not found then raise exception 'active tag not found or not owned by current user'; end if;
end;
$$;

create or replace function public.report_community_tag(p_tag_id uuid, p_reason text)
returns public."CommunityTagReport"
language plpgsql
security definer
set search_path = public
as $$
declare
	v_report public."CommunityTagReport"%rowtype;
begin
	if auth.uid() is null then raise exception 'authenticated user is required'; end if;
	if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'report reason must contain 1 to 500 characters'; end if;
	if not exists (select 1 from public."CommunityTag" where id = p_tag_id and status = 'active') then raise exception 'tag not found'; end if;
	insert into public."CommunityTagReport" (tag_id, reported_by_auth_id, reason)
	values (p_tag_id, auth.uid(), btrim(p_reason))
	on conflict (tag_id, reported_by_auth_id) do update set reason = excluded.reason, status = 'open', reviewed_by_auth_id = null, reviewed_at = null
	returning * into v_report;
	return v_report;
end;
$$;

create or replace function public.moderate_community_tag(p_tag_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not exists (
		select 1 from public."PublicProfile" profile
		where profile.auth_id = auth.uid() and lower(coalesce(profile.role, '')) = 'admin'
	) then raise exception 'admin role is required'; end if;
	if p_status not in ('hidden_by_admin', 'deleted_by_creator') then raise exception 'invalid moderation status'; end if;
	update public."CommunityTag" set status = p_status, deleted_at = now(), updated_at = now() where id = p_tag_id;
	if not found then raise exception 'tag not found'; end if;
	update public."CommunityTagReport"
	set status = 'reviewed', reviewed_by_auth_id = auth.uid(), reviewed_at = now()
	where tag_id = p_tag_id and status = 'open';
end;
$$;

revoke all on function public.create_community_tag(text, text, text) from public;
revoke all on function public.cast_community_tag_vote(uuid, smallint) from public;
revoke all on function public.delete_community_tag(uuid) from public;
revoke all on function public.report_community_tag(uuid, text) from public;
revoke all on function public.moderate_community_tag(uuid, text) from public;
grant execute on function public.create_community_tag(text, text, text) to authenticated;
grant execute on function public.cast_community_tag_vote(uuid, smallint) to authenticated;
grant execute on function public.delete_community_tag(uuid) to authenticated;
grant execute on function public.report_community_tag(uuid, text) to authenticated;
grant execute on function public.moderate_community_tag(uuid, text) to authenticated;

notify pgrst, 'reload schema';

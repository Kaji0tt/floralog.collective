-- Community-managed public collections with maintainer roles and item proposals.

alter table if exists public."Collection"
  add column if not exists private_maintained boolean not null default false;

create table if not exists public."CollectionMaintainer" (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public."Collection"(id) on delete cascade,
  auth_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  unique (collection_id, auth_id)
);

create index if not exists idx_collectionmaintainer_collection_id
  on public."CollectionMaintainer"(collection_id);
create index if not exists idx_collectionmaintainer_auth_id
  on public."CollectionMaintainer"(auth_id);

create table if not exists public."CollectionItemProposal" (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public."Collection"(id) on delete cascade,
  genus_id text references public."PlantGenus"(id) on delete set null,
  plant_id text references public."Plant"(id) on delete set null,
  note text,
  proposed_by_auth_id uuid not null references auth.users(id) on delete cascade,
  review_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_by_auth_id uuid references auth.users(id) on delete set null,
  decision_date timestamptz,
  created_at timestamptz not null default now(),
  constraint collectionitemproposal_target_check check (
    genus_id is not null or plant_id is not null
  )
);

create index if not exists idx_collectionitemproposal_collection_id
  on public."CollectionItemProposal"(collection_id);
create index if not exists idx_collectionitemproposal_proposed_by
  on public."CollectionItemProposal"(proposed_by_auth_id);
create index if not exists idx_collectionitemproposal_status
  on public."CollectionItemProposal"(status);
create unique index if not exists idx_collectionitemproposal_pending_unique
  on public."CollectionItemProposal"(collection_id, proposed_by_auth_id, coalesce(plant_id, ''), coalesce(genus_id, ''))
  where status = 'pending';

create unique index if not exists idx_collectionitem_unique_plant
  on public."CollectionItem"(collection_id, plant_id)
  where plant_id is not null;

create unique index if not exists idx_collectionitem_unique_genus
  on public."CollectionItem"(collection_id, genus_id)
  where genus_id is not null;

create or replace function public.is_collection_maintainer(
  p_collection_id uuid,
  p_auth_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."CollectionMaintainer" cm
    where cm.collection_id = p_collection_id
      and cm.auth_id = p_auth_id
      and cm.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_collection_maintainer(uuid, uuid) from public;
grant execute on function public.is_collection_maintainer(uuid, uuid) to authenticated;

create or replace function public.can_manage_collection_maintainers(
  p_collection_id uuid,
  p_auth_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Collection" c
    where c.id = p_collection_id
      and c.auth_id = p_auth_id
  )
  or exists (
    select 1
    from public."CollectionMaintainer" cm
    where cm.collection_id = p_collection_id
      and cm.auth_id = p_auth_id
      and cm.role = 'owner'
  );
$$;

revoke all on function public.can_manage_collection_maintainers(uuid, uuid) from public;
grant execute on function public.can_manage_collection_maintainers(uuid, uuid) to authenticated;

create or replace function public.sync_collection_owner_as_maintainer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auth_id is null then
    return new;
  end if;

  insert into public."CollectionMaintainer" (collection_id, auth_id, role)
  values (new.id, new.auth_id, 'owner')
  on conflict (collection_id, auth_id)
  do update set role = 'owner';

  return new;
end;
$$;

drop trigger if exists trg_collection_sync_owner_maintainer on public."Collection";
create trigger trg_collection_sync_owner_maintainer
after insert or update of auth_id on public."Collection"
for each row
execute function public.sync_collection_owner_as_maintainer();

insert into public."CollectionMaintainer" (collection_id, auth_id, role)
select c.id, c.auth_id, 'owner'
from public."Collection" c
where c.auth_id is not null
on conflict (collection_id, auth_id)
do update set role = 'owner';

alter table public."CollectionMaintainer" enable row level security;
alter table public."CollectionItemProposal" enable row level security;

-- Ensure private collection maintainers can read their collections.
drop policy if exists "Collection select by maintainers" on public."Collection";
create policy "Collection select by maintainers"
  on public."Collection"
  for select
  to authenticated
  using (public.is_collection_maintainer(id, auth.uid()));

-- Allow maintainers to update collection settings.
drop policy if exists "Collection update by maintainers" on public."Collection";
create policy "Collection update by maintainers"
  on public."Collection"
  for update
  to authenticated
  using (public.is_collection_maintainer(id, auth.uid()))
  with check (public.is_collection_maintainer(id, auth.uid()));

-- Maintainers can manage collection items directly.
drop policy if exists "CollectionItem manage by maintainers" on public."CollectionItem";
create policy "CollectionItem manage by maintainers"
  on public."CollectionItem"
  for all
  to authenticated
  using (public.is_collection_maintainer(collection_id, auth.uid()))
  with check (public.is_collection_maintainer(collection_id, auth.uid()));

-- Maintainers table policies.
drop policy if exists "CollectionMaintainer select visible" on public."CollectionMaintainer";
create policy "CollectionMaintainer select visible"
  on public."CollectionMaintainer"
  for select
  to authenticated
  using (
    auth.uid() = auth_id
    or public.is_collection_maintainer(collection_id, auth.uid())
    or exists (
      select 1
      from public."Collection" c
      where c.id = collection_id
        and c.is_public = true
    )
  );

drop policy if exists "CollectionMaintainer owner manage" on public."CollectionMaintainer";
create policy "CollectionMaintainer owner manage"
  on public."CollectionMaintainer"
  for all
  to authenticated
  using (public.can_manage_collection_maintainers(collection_id, auth.uid()))
  with check (public.can_manage_collection_maintainers(collection_id, auth.uid()));

-- Proposal policies.
drop policy if exists "CollectionItemProposal select own_or_maintainer" on public."CollectionItemProposal";
create policy "CollectionItemProposal select own_or_maintainer"
  on public."CollectionItemProposal"
  for select
  to authenticated
  using (
    proposed_by_auth_id = auth.uid()
    or public.is_collection_maintainer(collection_id, auth.uid())
  );

drop policy if exists "CollectionItemProposal insert public_contribution" on public."CollectionItemProposal";
create policy "CollectionItemProposal insert public_contribution"
  on public."CollectionItemProposal"
  for insert
  to authenticated
  with check (
    proposed_by_auth_id = auth.uid()
    and exists (
      select 1
      from public."Collection" c
      where c.id = collection_id
        and c.is_public = true
        and (
          c.private_maintained = false
          or public.is_collection_maintainer(c.id, auth.uid())
        )
    )
  );

drop policy if exists "CollectionItemProposal review by maintainers" on public."CollectionItemProposal";
create policy "CollectionItemProposal review by maintainers"
  on public."CollectionItemProposal"
  for update
  to authenticated
  using (public.is_collection_maintainer(collection_id, auth.uid()))
  with check (public.is_collection_maintainer(collection_id, auth.uid()));

drop policy if exists "CollectionItemProposal delete own_pending" on public."CollectionItemProposal";
create policy "CollectionItemProposal delete own_pending"
  on public."CollectionItemProposal"
  for delete
  to authenticated
  using (proposed_by_auth_id = auth.uid() and status = 'pending');

create or replace function public.set_collectionitemproposal_review_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    if new.decision_date is null then
      new.decision_date = now();
    end if;
    if new.decision_by_auth_id is null then
      new.decision_by_auth_id = auth.uid();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_collectionitemproposal_set_review_fields on public."CollectionItemProposal";
create trigger trg_collectionitemproposal_set_review_fields
before update on public."CollectionItemProposal"
for each row
execute function public.set_collectionitemproposal_review_fields();

create or replace function public.apply_collectionitemproposal_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if not exists (
      select 1
      from public."CollectionItem" ci
      where ci.collection_id = new.collection_id
        and coalesce(ci.plant_id, '') = coalesce(new.plant_id, '')
        and coalesce(ci.genus_id, '') = coalesce(new.genus_id, '')
    ) then
      insert into public."CollectionItem" (
        collection_id,
        genus_id,
        plant_id,
        note
      ) values (
        new.collection_id,
        new.genus_id,
        new.plant_id,
        new.note
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_collectionitemproposal_apply_approval on public."CollectionItemProposal";
create trigger trg_collectionitemproposal_apply_approval
after update of status on public."CollectionItemProposal"
for each row
execute function public.apply_collectionitemproposal_approval();

grant select, insert, update, delete on table public."CollectionMaintainer" to authenticated;
grant select, insert, update, delete on table public."CollectionItemProposal" to authenticated;

notify pgrst, 'reload schema';

-- 20260521143000_create_user_story_table.sql
-- Central server-side tracking for story progress and seen story events.

create extension if not exists pgcrypto;

create table if not exists public."UserStory" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  user_wallet_id uuid not null unique references public."UserWallet"(id) on delete cascade,

  story_version text not null default 'v1',

  intro_seen boolean not null default false,
  intro_seen_at timestamptz,

  seen_milestone_ids jsonb not null default '[]'::jsonb,
  seen_context_bubble_keys jsonb not null default '[]'::jsonb,
  seen_overlay_ids jsonb not null default '[]'::jsonb,

  current_story_step text,
  seed_progress_at_last_eval integer not null default 0 check (seed_progress_at_last_eval >= 0),
  last_story_eval_at timestamptz,

  condition_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint userstory_seen_milestone_ids_is_array
    check (jsonb_typeof(seen_milestone_ids) = 'array'),
  constraint userstory_seen_context_bubble_keys_is_array
    check (jsonb_typeof(seen_context_bubble_keys) = 'array'),
  constraint userstory_seen_overlay_ids_is_array
    check (jsonb_typeof(seen_overlay_ids) = 'array'),
  constraint userstory_condition_state_is_object
    check (jsonb_typeof(condition_state) = 'object'),
  constraint userstory_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_userstory_auth_id
  on public."UserStory"(auth_id);

create index if not exists idx_userstory_story_version
  on public."UserStory"(story_version);

create index if not exists idx_userstory_seed_progress_at_last_eval
  on public."UserStory"(seed_progress_at_last_eval desc);

create index if not exists idx_userstory_seen_milestone_ids_gin
  on public."UserStory" using gin (seen_milestone_ids);

create index if not exists idx_userstory_seen_context_bubble_keys_gin
  on public."UserStory" using gin (seen_context_bubble_keys);

-- Keep updated_at in sync.
create or replace function public.set_updated_at_user_story()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_userstory_updated_at on public."UserStory";
create trigger trg_userstory_updated_at
before update on public."UserStory"
for each row execute function public.set_updated_at_user_story();

-- Ensure auth_id and user_wallet_id belong to the same user.
create or replace function public.validate_userstory_wallet_owner()
returns trigger
language plpgsql
as $$
declare
  v_wallet_auth_id uuid;
begin
  select uw.auth_id
    into v_wallet_auth_id
    from public."UserWallet" uw
    where uw.id = new.user_wallet_id
    limit 1;

  if v_wallet_auth_id is null then
    raise exception 'UserWallet row not found for id %', new.user_wallet_id;
  end if;

  if v_wallet_auth_id <> new.auth_id then
    raise exception 'UserStory auth_id (%) does not match UserWallet auth_id (%)', new.auth_id, v_wallet_auth_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_userstory_wallet_owner on public."UserStory";
create trigger trg_userstory_wallet_owner
before insert or update on public."UserStory"
for each row execute function public.validate_userstory_wallet_owner();

alter table public."UserStory" enable row level security;

grant select, insert, update on public."UserStory" to authenticated, service_role;

-- Read own story state.
drop policy if exists "userstory_select_own" on public."UserStory";
create policy "userstory_select_own"
  on public."UserStory"
  for select
  to authenticated
  using ((select auth.uid()) = auth_id);

-- Insert own story state.
drop policy if exists "userstory_insert_own" on public."UserStory";
create policy "userstory_insert_own"
  on public."UserStory"
  for insert
  to authenticated
  with check ((select auth.uid()) = auth_id);

-- Update own story state.
drop policy if exists "userstory_update_own" on public."UserStory";
create policy "userstory_update_own"
  on public."UserStory"
  for update
  to authenticated
  using ((select auth.uid()) = auth_id)
  with check ((select auth.uid()) = auth_id);

-- Convenience function: ensures a UserStory row exists and keeps seed snapshot synced.
create or replace function public.ensure_user_story_row(
  p_auth_id uuid,
  p_story_version text default 'v1'
)
returns public."UserStory"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public."UserWallet"%rowtype;
  v_story public."UserStory"%rowtype;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  select *
    into v_wallet
    from public."UserWallet"
    where auth_id = p_auth_id
    limit 1;

  if v_wallet.id is null then
    insert into public."UserWallet" (auth_id)
    values (p_auth_id)
    on conflict (auth_id) do update
      set updated_at = now()
    returning * into v_wallet;
  end if;

  insert into public."UserStory" (
    auth_id,
    user_wallet_id,
    story_version,
    seed_progress_at_last_eval,
    last_story_eval_at
  )
  values (
    p_auth_id,
    v_wallet.id,
    coalesce(nullif(trim(p_story_version), ''), 'v1'),
    coalesce(v_wallet.seeds_progress, 0),
    now()
  )
  on conflict (auth_id) do update
    set
      user_wallet_id = excluded.user_wallet_id,
      story_version = excluded.story_version,
      seed_progress_at_last_eval = greatest(public."UserStory".seed_progress_at_last_eval, excluded.seed_progress_at_last_eval),
      last_story_eval_at = now()
  returning * into v_story;

  return v_story;
end;
$$;

grant execute on function public.ensure_user_story_row(uuid, text) to authenticated, service_role;

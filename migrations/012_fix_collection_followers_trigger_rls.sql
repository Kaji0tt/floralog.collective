-- 012_fix_collection_followers_trigger_rls.sql
-- Ensure follower counter triggers can update Collection despite RLS.

create or replace function public.increment_collection_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."Collection"
  set followers_count = coalesce(followers_count, 0) + 1
  where id = new.collection_id;

  return new;
end;
$$;

create or replace function public.decrement_collection_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."Collection"
  set followers_count = greatest(coalesce(followers_count, 0) - 1, 0)
  where id = old.collection_id;

  return old;
end;
$$;

-- Recreate triggers to ensure they point to the latest function definitions.
drop trigger if exists trg_usercollection_followers_inc on public."UserCollection";
create trigger trg_usercollection_followers_inc
after insert on public."UserCollection"
for each row execute function public.increment_collection_followers();

drop trigger if exists trg_usercollection_followers_dec on public."UserCollection";
create trigger trg_usercollection_followers_dec
after delete on public."UserCollection"
for each row execute function public.decrement_collection_followers();

-- Repair existing counters in case previous trigger executions were blocked by RLS.
update public."Collection" c
set followers_count = coalesce(
  (
    select count(*)::integer
    from public."UserCollection" uc
    where uc.collection_id = c.id
  ),
  0
);

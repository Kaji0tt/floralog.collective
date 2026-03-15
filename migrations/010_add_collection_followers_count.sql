-- 010_add_collection_followers_count.sql
-- Follower-Zähler pro Kollektion

alter table public."Collection"
  add column if not exists followers_count integer not null default 0;

-- Bestehende Werte aus UserCollection ableiten
update public."Collection" c
set followers_count = coalesce(
  (
    select count(*)::integer
    from public."UserCollection" uc
    where uc.collection_id = c.id
  ),
  0
);

create or replace function public.increment_collection_followers()
returns trigger as $$
begin
  update public."Collection"
  set followers_count = followers_count + 1
  where id = new.collection_id;
  return new;
end;
$$ language plpgsql;

create or replace function public.decrement_collection_followers()
returns trigger as $$
begin
  update public."Collection"
  set followers_count = greatest(followers_count - 1, 0)
  where id = old.collection_id;
  return old;
end;
$$ language plpgsql;

-- Trigger bei neuen/gelöschten UserCollection-Einträgen

drop trigger if exists trg_usercollection_followers_inc on public."UserCollection";
create trigger trg_usercollection_followers_inc
after insert on public."UserCollection"
for each row execute function public.increment_collection_followers();

drop trigger if exists trg_usercollection_followers_dec on public."UserCollection";
create trigger trg_usercollection_followers_dec
after delete on public."UserCollection"
for each row execute function public.decrement_collection_followers();

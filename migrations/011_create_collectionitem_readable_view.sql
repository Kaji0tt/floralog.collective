-- 011_create_collectionitem_readable_view.sql
-- Ergänzt CollectionItem um lesbare Felder und hält diese per Trigger automatisch synchron.

drop view if exists public."CollectionItemReadable";

alter table public."CollectionItem"
  add column if not exists collection_title text,
  add column if not exists genus_name text,
  add column if not exists plant_name text;

create or replace function public.set_collectionitem_readable_fields()
returns trigger as $$
declare
  v_collection_title text;
  v_plant_name text;
  v_genus_name text;
begin
  select c.title
    into v_collection_title
  from public."Collection" c
  where c.id = new.collection_id;

  if new.plant_id is not null then
    select p.species_name
      into v_plant_name
    from public."Plant" p
    where p.id = new.plant_id;
  else
    v_plant_name := null;
  end if;

  if new.genus_id is not null then
    select pg.genus_name
      into v_genus_name
    from public."PlantGenus" pg
    where pg.id = new.genus_id;
  elsif new.plant_id is not null then
    select pg.genus_name
      into v_genus_name
    from public."Plant" p
    join public."PlantGenus" pg
      on pg.category = p.genus_category
     and pg.category_dex_number = p.genus_number
    where p.id = new.plant_id;
  else
    v_genus_name := null;
  end if;

  new.collection_title := v_collection_title;
  new.plant_name := v_plant_name;
  new.genus_name := v_genus_name;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_collectionitem_set_readable_fields on public."CollectionItem";
create trigger trg_collectionitem_set_readable_fields
before insert or update of collection_id, genus_id, plant_id
on public."CollectionItem"
for each row
execute function public.set_collectionitem_readable_fields();

-- Backfill bestehender Datensätze (führt den Trigger pro Zeile aus)
update public."CollectionItem"
set collection_id = collection_id;

create or replace function public.sync_collectionitem_titles_from_collection()
returns trigger as $$
begin
  if new.title is distinct from old.title then
    update public."CollectionItem"
    set collection_title = new.title
    where collection_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_collection_sync_collectionitem_title on public."Collection";
create trigger trg_collection_sync_collectionitem_title
after update of title on public."Collection"
for each row
execute function public.sync_collectionitem_titles_from_collection();

create or replace function public.sync_collectionitem_from_plant()
returns trigger as $$
begin
  if (
    new.species_name is distinct from old.species_name
    or new.genus_category is distinct from old.genus_category
    or new.genus_number is distinct from old.genus_number
  ) then
    update public."CollectionItem" ci
    set
      plant_name = new.species_name,
      genus_name = coalesce(
        (
          select pg.genus_name
          from public."PlantGenus" pg
          where pg.id = ci.genus_id
        ),
        (
          select pg.genus_name
          from public."PlantGenus" pg
          where pg.category = new.genus_category
            and pg.category_dex_number = new.genus_number
          limit 1
        )
      )
    where ci.plant_id = new.id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_plant_sync_collectionitem on public."Plant";
create trigger trg_plant_sync_collectionitem
after update of species_name, genus_category, genus_number on public."Plant"
for each row
execute function public.sync_collectionitem_from_plant();

create or replace function public.sync_collectionitem_from_plantgenus()
returns trigger as $$
begin
  if new.genus_name is distinct from old.genus_name then
    update public."CollectionItem"
    set genus_name = new.genus_name
    where genus_id = new.id;

    update public."CollectionItem" ci
    set genus_name = new.genus_name
    from public."Plant" p
    where ci.plant_id = p.id
      and ci.genus_id is null
      and p.genus_category = new.category
      and p.genus_number = new.category_dex_number;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_plantgenus_sync_collectionitem on public."PlantGenus";
create trigger trg_plantgenus_sync_collectionitem
after update of genus_name on public."PlantGenus"
for each row
execute function public.sync_collectionitem_from_plantgenus();

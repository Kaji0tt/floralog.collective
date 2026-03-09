-- 008_add_collections_tables.sql
-- Collections, Classroom-Teilnehmer & Fortschritt

-- WICHTIG: In diesem Projekt sind bestehende IDs (Plant, PlantGenus, UserPlantDiscovery, ...)
-- als TEXT (MongoDB-ähnliche Hex-Strings) angelegt. Neue Tabellen dürfen FKs nur dann
-- auf diese Tabellen setzen, wenn die Spalten ebenfalls TEXT sind.

----------------------------------------------------------
-- 1) Basis-Tabelle für Kollektionen
----------------------------------------------------------
create table if not exists public."Collection" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  background_image_url text,
  background_color text,
  is_public boolean not null default false,
  is_classroom boolean not null default false,
  -- Steuert, ob im Classroom die Teilnehmer-Kennungen pro Item sichtbar sind
  show_participant_codes boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_collection_auth_id on public."Collection"(auth_id);
create index if not exists idx_collection_slug on public."Collection"(slug);
create index if not exists idx_collection_is_public on public."Collection"(is_public);

alter table public."Collection" enable row level security;

-- RLS: öffentliche Kollektionen + eigene
create policy "Users can read visible collections"
  on public."Collection"
  for select
  to authenticated
  using (
    is_public = true
    or auth.uid() = auth_id
  );

-- RLS: Owner dürfen ihre Kollektionen verwalten
create policy "Owners manage their collections"
  on public."Collection"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

----------------------------------------------------------
-- 2) Items in einer Kollektion (Gattungen / Arten)
----------------------------------------------------------
create table if not exists public."CollectionItem" (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public."Collection"(id) on delete cascade,
  -- PlantGenus.id ist im bestehenden Schema TEXT, daher hier ebenfalls TEXT
  genus_id text references public."PlantGenus"(id) on delete set null,
  -- Plant.id ist ebenfalls TEXT
  plant_id text references public."Plant"(id) on delete set null,
  category text,
  sort_order integer
);

create index if not exists idx_collectionitem_collection_id on public."CollectionItem"(collection_id);
create index if not exists idx_collectionitem_genus_id on public."CollectionItem"(genus_id);
create index if not exists idx_collectionitem_plant_id on public."CollectionItem"(plant_id);

alter table public."CollectionItem" enable row level security;

-- RLS: Lesen nur, wenn zugehörige Collection sichtbar ist
create policy "Read items of visible collections"
  on public."CollectionItem"
  for select
  to authenticated
  using (
    exists (
      select 1
      from public."Collection" c
      where c.id = collection_id
        and (c.is_public = true or auth.uid() = c.auth_id)
    )
  );

-- RLS: Bearbeiten nur durch Owner der Kollektion
create policy "Owners manage collection items"
  on public."CollectionItem"
  for all
  to authenticated
  using (
    exists (
      select 1
      from public."Collection" c
      where c.id = collection_id
        and auth.uid() = c.auth_id
    )
  )
  with check (
    exists (
      select 1
      from public."Collection" c
      where c.id = collection_id
        and auth.uid() = c.auth_id
    )
  );

----------------------------------------------------------
-- 3) User folgt/abonniert Kollektionen
----------------------------------------------------------
create table if not exists public."UserCollection" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public."Collection"(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (auth_id, collection_id)
);

create index if not exists idx_usercollection_auth_id on public."UserCollection"(auth_id);
create index if not exists idx_usercollection_collection_id on public."UserCollection"(collection_id);

alter table public."UserCollection" enable row level security;

-- RLS: User sehen nur ihre eigenen Follows
create policy "Users read own collection follows"
  on public."UserCollection"
  for select
  to authenticated
  using (auth.uid() = auth_id);

-- RLS: User dürfen eigene Follows anlegen/löschen
create policy "Users manage own collection follows"
  on public."UserCollection"
  for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

----------------------------------------------------------
-- 4) Classroom-Teilnehmer (anonyme Kennungen)
----------------------------------------------------------
create table if not exists public."ClassroomParticipant" (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public."Collection"(id) on delete cascade,
  participant_code text not null,
  join_token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_classroom_participant_collection_id on public."ClassroomParticipant"(collection_id);
create index if not exists idx_classroom_participant_code on public."ClassroomParticipant"(participant_code);

alter table public."ClassroomParticipant" enable row level security;

-- Keine Policies für authenticated:
-- Zugriff ausschließlich über Edge Functions mit Service Role.

----------------------------------------------------------
-- 5) Classroom-Fortschritt (welche Kennung hat welches Item gefunden)
----------------------------------------------------------
create table if not exists public."ClassroomParticipantProgress" (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public."ClassroomParticipant"(id) on delete cascade,
  collection_item_id uuid not null references public."CollectionItem"(id) on delete cascade,
  -- IDs anderer Tabellen sind TEXT; wir speichern hier daher nur die fremde ID als TEXT,
  -- ohne FK-Constraint, um flexibel zu bleiben.
  scan_id text,
  completed_at timestamptz not null default now(),
  unique (participant_id, collection_item_id)
);

create index if not exists idx_cpp_participant_id on public."ClassroomParticipantProgress"(participant_id);
create index if not exists idx_cpp_collection_item_id on public."ClassroomParticipantProgress"(collection_item_id);

alter table public."ClassroomParticipantProgress" enable row level security;

-- Ebenfalls nur Edge Functions (Service Role), keine Policies für authenticated.

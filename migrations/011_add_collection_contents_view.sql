-- 011_add_collection_contents_view.sql
-- Erläuterung der Datenstruktur für Kollektionen und Pflanzen
--
-- HINTERGRUND
-- -----------
-- Die Frage "Wo stehen die Inhalte einer Collection in der Datenbank?" wird hier
-- beantwortet. Die Antwort lautet: in drei separaten Tabellen, die per JOIN
-- zusammengehören:
--
--   Collection          →  Metadaten der Kollektion (Titel, Beschreibung, …)
--       ↓ 1:n
--   CollectionItem      →  Verknüpfungs-/Zwischentabelle (JOIN-Tabelle)
--       ├─ plant_id     →  verweist auf Plant  (einzelne Pflanzenart)
--       └─ genus_id     →  verweist auf PlantGenus (Pflanzengattung)
--
-- CollectionItem speichert KEINE eigenen Pflanzeninformationen.
-- Es ist eine reine Verknüpfungstabelle (Junction Table), die sagt:
--   "Diese Collection enthält diese Pflanze / diese Gattung."
--
-- Die eigentlichen Pflanzeninformationen (Name, Beschreibung, Seltenheit, …)
-- liegen in den Tabellen Plant (Arten) bzw. PlantGenus (Gattungen).
--
-- BEISPIEL-ABFRAGE (alle Pflanzen einer bestimmten Collection):
--
--   SELECT p.species_name, p.scientific_name, p.rarity
--   FROM public."CollectionItem" ci
--   JOIN public."Plant" p ON p.id = ci.plant_id
--   WHERE ci.collection_id = '<collection-uuid>';
--
--   -- Für Gattungen statt Arten:
--   SELECT pg.genus_name, pg.scientific_genus, pg.family
--   FROM public."CollectionItem" ci
--   JOIN public."PlantGenus" pg ON pg.id = ci.genus_id
--   WHERE ci.collection_id = '<collection-uuid>';

----------------------------------------------------------
-- Convenience-View: kompletter Inhalt einer Collection
-- Verbindet Collection + CollectionItem + Plant + PlantGenus
-- in einer einzigen abfragbaren Relation.
----------------------------------------------------------
create or replace view public."vw_collection_contents" as
select
  -- Collection
  c.id            as collection_id,
  c.title         as collection_title,
  c.slug          as collection_slug,
  c.auth_id       as collection_owner_auth_id,
  c.is_public,

  -- CollectionItem (Zwischentabelle / Verknüpfung)
  ci.id           as item_id,
  ci.category     as item_category,
  ci.sort_order,
  ci.note         as item_note,

  -- Plant (Pflanzenart) – NULL wenn der Eintrag auf eine Gattung zeigt
  p.id            as plant_id,
  p.species_name,
  p.scientific_name,
  p.rarity        as plant_rarity,
  p.description   as plant_description,

  -- PlantGenus (Pflanzengattung) – NULL wenn der Eintrag auf eine Art zeigt
  pg.id           as genus_id,
  pg.genus_name,
  pg.scientific_genus,
  pg.category     as genus_category,
  pg.family       as genus_family,
  pg.rarity       as genus_rarity

from public."Collection"     c
join public."CollectionItem" ci on ci.collection_id = c.id
left join public."Plant"     p  on p.id = ci.plant_id
left join public."PlantGenus" pg on pg.id = ci.genus_id;

comment on view public."vw_collection_contents" is
  'Zeigt den vollständigen Inhalt jeder Collection inkl. Pflanzendetails. '
  'CollectionItem ist eine Zwischentabelle: plant_id → Plant (Arten), '
  'genus_id → PlantGenus (Gattungen). Die eigentlichen Pflanzeninfos '
  'stehen in Plant bzw. PlantGenus, nicht in CollectionItem selbst.';

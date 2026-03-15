-- 009_add_collectionitem_note.sql
-- Ergänzt CollectionItem um ein optionales Notizfeld pro Pflanzen-/Gattungs-Eintrag

alter table public."CollectionItem"
  add column if not exists note text;

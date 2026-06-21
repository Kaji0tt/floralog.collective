-- 20260617103000_add_usercollection_favorite_flag.sql
-- Adds server-side favorite support for followed collections.
--
-- IMPORTANT BACKPORT NOTE:
-- If your official/production Supabase project runs a different migration baseline,
-- this file must be applied there as well. Frontend falls back gracefully when the
-- column is missing, but favorite toggling stays disabled until this migration exists.

alter table public."UserCollection"
  add column if not exists is_favorite boolean not null default false;

comment on column public."UserCollection".is_favorite is
  'User-owned favorite flag for followed collections. Used by Home Stripe 3 ordering and collection shortcuts.';

-- Optimized read path for "my favorite collections" lookups.
create index if not exists idx_usercollection_auth_favorites
  on public."UserCollection" (auth_id, created_at desc)
  where is_favorite = true;

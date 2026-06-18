-- Add profile badge selection persistence to PublicProfile.
-- This stores up to 3 selected badge ids for Home banner rendering.

alter table public."PublicProfile"
  add column if not exists selected_badge_ids text[] not null default '{}'::text[];

comment on column public."PublicProfile".selected_badge_ids is
  'Selected profile badge ids (max 3) shown in the Home profile banner.';

update public."PublicProfile"
set selected_badge_ids = '{}'::text[]
where selected_badge_ids is null;

notify pgrst, 'reload schema';

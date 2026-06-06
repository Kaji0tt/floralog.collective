-- Manual one-time PublicProfile backfill for Pia.
-- Account: 881d8429-4ca0-4245-a7af-02fafd77df63 / p.r@glas-reimer.de

insert into public."PublicProfile" (
  id,
  auth_id,
  user_email,
  display_name,
  full_name,
  created_date,
  updated_date
)
values (
  '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid,
  '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid,
  'p.r@glas-reimer.de',
  'Pia',
  'Pia',
  now(),
  now()
)
on conflict (id) do update
set
  auth_id = excluded.auth_id,
  user_email = coalesce(nullif(public."PublicProfile".user_email, ''), excluded.user_email),
  display_name = coalesce(nullif(public."PublicProfile".display_name, ''), excluded.display_name),
  full_name = coalesce(nullif(public."PublicProfile".full_name, ''), excluded.full_name),
  updated_date = excluded.updated_date;

-- Verification
select
  id,
  auth_id,
  user_email,
  display_name,
  full_name,
  created_date,
  updated_date
from public."PublicProfile"
where auth_id = '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid;

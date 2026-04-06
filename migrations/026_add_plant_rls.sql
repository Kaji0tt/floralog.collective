-- 026_add_plant_rls.sql
-- Enable RLS on Plant table and allow admin writes

alter table public."Plant" enable row level security;

-- Read access for authenticated users
create policy "plant_select_authenticated"
  on public."Plant"
  for select
  to authenticated
  using (true);

-- Write access only for admins
create policy "plant_update_admin"
  on public."Plant"
  for update
  to authenticated
  using (
    exists (
      select 1
      from public."PublicProfile"
      where auth_id = auth.uid()
        and role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public."PublicProfile"
      where auth_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "plant_insert_admin"
  on public."Plant"
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public."PublicProfile"
      where auth_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "plant_delete_admin"
  on public."Plant"
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public."PublicProfile"
      where auth_id = auth.uid()
        and role = 'admin'
    )
  );

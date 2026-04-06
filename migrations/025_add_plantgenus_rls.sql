-- 025_add_plantgenus_rls.sql
-- Enable RLS on PlantGenus table and allow admin updates

-- Enable RLS on PlantGenus
alter table public."PlantGenus" enable row level security;

-- Anyone can select (read-only)
create policy "plantgenus_select_all"
  on public."PlantGenus"
  for select
  using (true);

-- Only admins can update
create policy "plantgenus_update_admin"
  on public."PlantGenus"
  for update
  to authenticated
  using (
    exists (
      select 1 from public."PublicProfile"
      where auth_id = auth.uid()
      and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public."PublicProfile"
      where auth_id = auth.uid()
      and role = 'admin'
    )
  );

-- Only admins can insert
create policy "plantgenus_insert_admin"
  on public."PlantGenus"
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public."PublicProfile"
      where auth_id = auth.uid()
      and role = 'admin'
    )
  );

-- Only admins can delete
create policy "plantgenus_delete_admin"
  on public."PlantGenus"
  for delete
  to authenticated
  using (
    exists (
      select 1 from public."PublicProfile"
      where auth_id = auth.uid()
      and role = 'admin'
    )
  );

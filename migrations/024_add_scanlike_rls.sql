-- Migration 024: Add RLS policies for ScanLike table
-- Authenticated users may read all likes, insert their own, and delete their own.

alter table public."ScanLike" enable row level security;

-- SELECT: every authenticated user can see all likes (needed to show like counts)
create policy "ScanLike: authenticated read all"
  on public."ScanLike"
  for select
  to authenticated
  using (true);

-- INSERT: authenticated user may only create a like where liked_by matches their email
-- and auth_id matches their auth.uid()
create policy "ScanLike: authenticated insert own"
  on public."ScanLike"
  for insert
  to authenticated
  with check (
    auth_id = auth.uid()
    and liked_by = auth.email()
  );

-- DELETE: authenticated user may only delete their own like
create policy "ScanLike: authenticated delete own"
  on public."ScanLike"
  for delete
  to authenticated
  using (
    auth_id = auth.uid()
  );

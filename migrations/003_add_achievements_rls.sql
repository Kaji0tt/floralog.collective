-- RLS Policies for Achievements and UserAchievement

-- Allow authenticated users to read all achievements
create policy "Authenticated users can read achievements"
  on public."Achievements"
  for select
  to authenticated
  using (true);

-- Allow authenticated users to read only their own UserAchievement rows
create policy "Users can read their own achievements"
  on public."UserAchievement"
  for select
  to authenticated
  using (auth.uid() = auth_id);

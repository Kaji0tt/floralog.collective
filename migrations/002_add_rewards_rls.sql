-- RLS Policies for Rewards and UserRewards

-- Allow authenticated users to read all rewards (e.g. for background selection)
create policy "Authenticated users can read rewards"
  on public."Rewards"
  for select
  to authenticated
  using (true);

-- Allow authenticated users to read only their own UserRewards rows
create policy "Users can read their own rewards"
  on public."UserRewards"
  for select
  to authenticated
  using (auth.uid() = auth_id);

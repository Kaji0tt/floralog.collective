-- Add optional discovery_id to UserRewards for exact scan-to-reward matching.
-- Also creates a SECURITY DEFINER RPC so the social explorer feed can read
-- reward-unlock data for any set of discovery IDs without hitting RLS.

-- 1. Schema change: add nullable discovery_id column
alter table public."UserRewards"
  add column if not exists discovery_id text default null;

-- 2. SECURITY DEFINER RPC ─ returns reward unlocks keyed by discovery_id
--    Intentionally scoped: only rows that have a discovery_id are returned,
--    so historic rewards (no discovery_id) are never exposed.
create or replace function public.get_explorer_reward_unlocks(
  p_discovery_ids text[]
)
returns table (
  discovery_id  text,
  reward_name   text,
  reward_id     text,
  auth_id       uuid
)
language sql
security definer
set search_path = public
as $$
  select
    r.discovery_id,
    r.reward_name,
    r.reward_id,
    r.auth_id
  from public."UserRewards" r
  where r.discovery_id = any(p_discovery_ids)
    and r.discovery_id is not null;
$$;

-- Revoke public execute, grant only to authenticated users
revoke execute on function public.get_explorer_reward_unlocks(text[]) from public;
grant  execute on function public.get_explorer_reward_unlocks(text[]) to authenticated;

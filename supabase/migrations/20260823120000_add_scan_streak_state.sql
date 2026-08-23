-- 20260823120000_add_scan_streak_state.sql
-- Reactivates RobotPlant.streak_days for the new Scan-Streak retention system
-- (replaces the old login-streak sparks claim) and adds a Joker (grace-day) bank.

alter table public."RobotPlant"
  alter column streak_days set default 0;

update public."RobotPlant"
  set streak_days = 0
  where streak_days is null;

alter table public."RobotPlant"
  alter column streak_days set not null,
  add column if not exists scan_streak_joker_count integer not null default 0 check (scan_streak_joker_count >= 0),
  add column if not exists last_streak_scan_date date;

-- Read-only status/preview for UI (login hint + reward track), never grants anything.
create or replace function public.get_scan_streak_status(p_auth_id uuid)
returns table (
  streak_days integer,
  joker_count integer,
  last_streak_scan_date date,
  today_reward_claimed boolean
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(rp.streak_days, 0),
    coalesce(rp.scan_streak_joker_count, 0),
    rp.last_streak_scan_date,
    rp.last_streak_scan_date = current_date
  from public."RobotPlant" rp
  where rp.auth_id = p_auth_id
  limit 1;
$$;

grant execute on function public.get_scan_streak_status(uuid) to authenticated, service_role;

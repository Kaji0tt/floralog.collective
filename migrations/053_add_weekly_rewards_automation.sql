-- 053_add_weekly_rewards_automation.sql
--
-- Grants execute on existing RPCs to service_role (needed by the
-- weeklyRewardsScheduler edge function which uses the service-role key).
-- Both robot_plant_grant_reward and wallet_grant_currency are already
-- SECURITY DEFINER and check `auth.uid() is not null` before enforcing
-- the auth-id match – service role always yields auth.uid() = NULL so the
-- check passes transparently.

-- Allow service_role to call the weekly leaderboard RPC
-- (authenticated already granted in migration 20260706100000_...; add
-- service_role just in case).
grant execute on function public.get_weekly_seed_leaderboard(integer, timestamptz)
  to service_role;

-- Allow service_role to call the seed-grant RPC
grant execute on function public.robot_plant_grant_reward(
  uuid, text, text, integer, integer, integer, integer, jsonb
) to service_role;

-- Allow service_role to call the wallet-grant RPC
grant execute on function public.wallet_grant_currency(
  uuid, text, text, text, integer, text, jsonb
) to service_role;

-- ── RLS: let service_role insert UserNotification for any user ────────────
-- (service_role bypasses RLS by default in Postgres/Supabase; this policy
-- is a no-op but documents intent clearly)

-- ── pg_cron job (enable if pg_cron extension is available) ────────────────
-- Schedule: every Monday at 00:05 UTC → processes the just-finished week.
--
-- NOTE: the WEEKLY_REWARDS_SCHEDULER_SECRET env var must be set in the
-- Supabase Edge Function settings before this job can run successfully.
--
-- Uncomment the block below once pg_cron is enabled in your project:
--
-- select cron.schedule(
--   'weekly-rewards-scheduler',
--   '5 0 * * 1',   -- Monday 00:05 UTC
--   $$
--   select net.http_post(
--     url    => current_setting('app.supabase_url') || '/functions/v1/weeklyRewardsScheduler',
--     headers => jsonb_build_object(
--                  'Content-Type',             'application/json',
--                  'x-weekly-rewards-secret',  current_setting('app.weekly_rewards_secret')
--                ),
--     body   => '{}'::jsonb
--   ) as request_id;
--   $$
-- );
--
-- Alternatively, configure the schedule directly in the Supabase Dashboard under
-- Edge Functions → weeklyRewardsScheduler → Schedule (cron: "5 0 * * 1")
-- and set the header x-weekly-rewards-secret in the schedule configuration.

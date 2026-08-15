-- Fix ambiguous overload resolution for get_weekly_seed_leaderboard.
--
-- Two overloads existed with the identical parameter name p_from_date but
-- different types:
--   - get_weekly_seed_leaderboard(integer, date)  (from 20260622130500)
--   - get_weekly_seed_leaderboard(integer, text)  (from 20260629120000, never dropped)
--
-- PostgREST cannot disambiguate a named-parameter RPC call between overloads
-- that only differ by argument type, especially when the value is null or a
-- plain date string. Every call with { p_limit, p_from_date } (Home,
-- FriendProfile, AchievementsPage) started failing with PGRST203
-- ("could not choose the best candidate function"). The frontend already
-- treats PGRST203 as "leaderboard unavailable" and silently renders nothing,
-- which is why the weekly/season seed leaderboard appeared to stop loading.
--
-- Fix: drop the legacy date-typed overload and keep only the text-typed one
-- that is actually used going forward.

drop function if exists public.get_weekly_seed_leaderboard(integer, date);

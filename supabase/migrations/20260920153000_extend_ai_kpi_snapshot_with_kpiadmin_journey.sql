create or replace function public.ai_get_kpi_snapshot_v2()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select public.ai_get_kpi_snapshot() as payload
  ), boundaries as (
    select now() - interval '30 days' as since_30d
  ), action_metrics as (
    select
      coalesce(sum(event.event_count), 0)::integer as action_events_30d,
      coalesce(sum(event.event_count) filter (
        where event.event_name like 'home_%'
          or event.event_name like 'bottomnav_%'
          or event.event_name like 'achievements_view_%'
          or event.event_name like 'social_tab_%'
      ), 0)::integer as navigation_events_30d,
      coalesce(
        jsonb_object_agg(event.event_name, event.event_count) filter (
          where event.event_name like 'home_%'
            or event.event_name like 'bottomnav_%'
            or event.event_name like 'achievements_view_%'
            or event.event_name like 'social_tab_%'
        ),
        '{}'::jsonb
      ) as navigation_event_counts
    from (
      select
        event_name,
        count(*)::integer as event_count
      from public."UserActionEvent"
      cross join boundaries
      where created_at >= boundaries.since_30d
      group by event_name
    ) event
  ),
  retention as (
    select
      coalesce((payload->>'dau')::numeric, 0) as dau,
      coalesce((payload->>'mau')::numeric, 0) as mau
    from base
  )
  select base.payload || jsonb_build_object(
    'stickiness_percent',
      case when retention.mau > 0
        then round((retention.dau / retention.mau) * 100, 2)
        else 0
      end,
    'action_events_30d', action_metrics.action_events_30d,
    'navigation_events_30d', action_metrics.navigation_events_30d,
    'navigation_event_counts', action_metrics.navigation_event_counts
  )
  from base
  cross join action_metrics
  cross join retention;
$$;

revoke all on function public.ai_get_kpi_snapshot_v2() from public, anon, authenticated;
grant execute on function public.ai_get_kpi_snapshot_v2() to service_role;
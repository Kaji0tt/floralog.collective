-- UserPlantDiscovery timestamp consolidation:
-- discovered_date is the single source of truth.

-- Ensure existing rows keep a usable discovery timestamp before dropping legacy fields.
do $$
declare
  has_created_date boolean;
  has_updated_date boolean;
  coalesce_expr text := 'discovered_date';
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'UserPlantDiscovery'
      and column_name = 'created_date'
  ) into has_created_date;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'UserPlantDiscovery'
      and column_name = 'updated_date'
  ) into has_updated_date;

  if has_created_date then
    coalesce_expr := coalesce_expr || ', created_date';
  end if;

  if has_updated_date then
    coalesce_expr := coalesce_expr || ', updated_date';
  end if;

  execute format(
    'update public."UserPlantDiscovery" set discovered_date = coalesce(%s, now()) where discovered_date is null',
    coalesce_expr
  );
end;
$$;

alter table public."UserPlantDiscovery"
  alter column discovered_date set default now(),
  alter column discovered_date set not null;

-- Explorer RPC must not reference legacy timestamp columns.
create or replace function public.get_explorer_discoveries(
  p_viewer_email text default null,
  p_audience text default 'all',
  p_since timestamptz default (now() - interval '30 days'),
  p_limit integer default 40,
  p_offset integer default 0
)
returns setof public."UserPlantDiscovery"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer_auth_id uuid := auth.uid();
  v_viewer_email text;
  v_fallback_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 200));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_audience text := lower(coalesce(p_audience, 'all'));
begin
  if v_viewer_auth_id is null then
    return;
  end if;

  select lower(pp.user_email)
  into v_viewer_email
  from public."PublicProfile" pp
  where pp.auth_id = v_viewer_auth_id
  limit 1;

  if v_viewer_email is null or v_viewer_email = '' then
    v_viewer_email := v_fallback_email;
  end if;

  if v_viewer_email is null or v_viewer_email = '' then
    return;
  end if;

  if v_audience not in ('all', 'friends') then
    v_audience := 'all';
  end if;

  return query
  with friends as (
    select
      case
        when lower(f.request_sent_by) = v_viewer_email then lower(f.request_sent_to)
        else lower(f.request_sent_by)
      end as friend_email
    from public."Friend" f
    where f.status = 'accepted'
      and (
        lower(f.request_sent_by) = v_viewer_email
        or lower(f.request_sent_to) = v_viewer_email
      )
  ),
  scoped_discoveries as (
    select d.*
    from public."UserPlantDiscovery" d
    where d.discovered_date >= p_since
  )
  select d.*
  from scoped_discoveries d
  left join public."PublicProfile" pp
    on lower(pp.user_email) = lower(coalesce(d.user, d.created_by))
  where
    case
      when v_audience = 'friends' then
        d.auth_id = v_viewer_auth_id
        or lower(coalesce(d.user, d.created_by)) = v_viewer_email
        or lower(coalesce(d.user, d.created_by)) in (select friend_email from friends)
      else
        d.auth_id = v_viewer_auth_id
        or lower(coalesce(d.user, d.created_by)) = v_viewer_email
        or coalesce(pp.global_explorer_visibility, true) = true
    end
  order by d.discovered_date desc nulls last, d.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.get_explorer_discoveries(text, text, timestamptz, integer, integer) from public;
grant execute on function public.get_explorer_discoveries(text, text, timestamptz, integer, integer) to authenticated;

-- Drop legacy timestamps from UserPlantDiscovery.
alter table public."UserPlantDiscovery"
  drop column if exists created_date,
  drop column if exists updated_date;

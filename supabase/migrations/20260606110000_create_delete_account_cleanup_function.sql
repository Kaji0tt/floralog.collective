-- Creates a robust cleanup helper for account deletion.
-- It removes all rows in public tables that are linked via auth_id and
-- also clears friend rows linked by legacy email columns.

create or replace function public.delete_account_data_by_auth_id(
  p_auth_id uuid,
  p_user_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_total bigint := 0;
  v_deleted_rows bigint := 0;
  v_table record;
  v_normalized_email text := nullif(lower(trim(coalesce(p_user_email, ''))), '');
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;

  for v_table in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'auth_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format('delete from %I.%I where auth_id = $1', v_table.table_schema, v_table.table_name)
      using p_auth_id;

    get diagnostics v_deleted_rows = row_count;
    v_deleted_total := v_deleted_total + coalesce(v_deleted_rows, 0);
  end loop;

  if to_regclass('public."Friend"') is not null then
    if v_normalized_email is not null then
      delete from public."Friend"
      where auth_id = p_auth_id
         or lower(coalesce(request_sent_by, '')) = v_normalized_email
         or lower(coalesce(request_sent_to, '')) = v_normalized_email;
    else
      delete from public."Friend"
      where auth_id = p_auth_id;
    end if;

    get diagnostics v_deleted_rows = row_count;
    v_deleted_total := v_deleted_total + coalesce(v_deleted_rows, 0);
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_rows', v_deleted_total,
    'auth_id', p_auth_id
  );
end;
$$;

revoke all on function public.delete_account_data_by_auth_id(uuid, text) from public;
grant execute on function public.delete_account_data_by_auth_id(uuid, text) to service_role;

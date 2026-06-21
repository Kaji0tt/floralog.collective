--
-- PostgreSQL database dump
--

\restrict BeYtOiH1DY3tmzvhy8MZ47UGYZZC3JG0pI2EGIXeWCiX2bhIwwWDBtyHQgE2b8K

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: zone_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.zone_type_enum AS ENUM (
    'forest',
    'water',
    'meadow',
    'urban',
    'beach',
    'wetlands'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: claim_daily_login_sparks(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_daily_login_sparks(p_auth_id uuid, p_event_reference text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(applied boolean, awarded_amount integer, streak_days integer, sparks_balance integer, claim_date date)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := current_date;
  v_yesterday date := (current_date - interval '1 day')::date;
  v_state public."UserEngagementState"%rowtype;
  v_wallet_result record;
  v_event_reference text;
  v_streak integer;
  v_award integer;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  insert into public."UserEngagementState" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  select *
    into v_state
    from public."UserEngagementState"
    where auth_id = p_auth_id
    for update;

  if v_state.last_daily_login_claim_date = v_today then
    insert into public."UserWallet" (auth_id)
    values (p_auth_id)
    on conflict (auth_id) do nothing;

    return query
    select
      false,
      0,
      coalesce(v_state.login_streak_days, 0),
      (select uw.sparks_balance from public."UserWallet" uw where uw.auth_id = p_auth_id),
      v_today;
    return;
  end if;

  if v_state.last_login_date = v_yesterday then
    v_streak := least(coalesce(v_state.login_streak_days, 0) + 1, 3);
  else
    v_streak := 1;
  end if;

  v_award := v_streak;
  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('daily-login:', v_today::text));

  select *
    into v_wallet_result
    from public.wallet_grant_currency(
      p_auth_id,
      'sparks',
      'daily_login_spark',
      v_event_reference,
      v_award,
      'credit',
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'streak_days', v_streak,
        'claim_date', v_today
      )
    );

  update public."UserEngagementState"
  set
    last_login_date = v_today,
    last_daily_login_claim_date = v_today,
    login_streak_days = v_streak,
    updated_at = now()
  where auth_id = p_auth_id;

  return query
  select
    coalesce(v_wallet_result.applied, false),
    case when coalesce(v_wallet_result.applied, false) then v_award else 0 end,
    v_streak,
    coalesce(v_wallet_result.sparks_balance, 0),
    v_today;
end;
$$;


--
-- Name: decrement_collection_followers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_collection_followers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public."Collection"
  set followers_count = greatest(coalesce(followers_count, 0) - 1, 0)
  where id = old.collection_id;

  return old;
end;
$$;


--
-- Name: get_community_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_community_stats() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'active_researchers_this_month',
    (
      select count(distinct auth_id)
      from public."UserPlantDiscovery"
      where discovered_date::timestamptz >= date_trunc('month', now())
        and auth_id is not null
    ),
    'total_species',
    (
      select count(*) from public."PlantGenus"
    ),
    'total_scans',
    (
      select count(*) from public."UserPlantDiscovery"
    )
  );
$$;


--
-- Name: get_global_scan_leaderboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_global_scan_leaderboard() RETURNS TABLE(auth_id uuid, user_email text, display_name text, full_name text, scan_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
    pp.display_name,
    pp.full_name,
    count(*)::bigint as scan_count
  from public."UserPlantDiscovery" upd
  left join public."PublicProfile" pp
    on pp.auth_id = upd.auth_id
  where upd.auth_id is not null
  group by
    upd.auth_id,
    lower(coalesce(pp.user_email, upd.user, upd.created_by)),
    pp.display_name,
    pp.full_name
  having count(*) > 0
  order by count(*) desc;
$$;


--
-- Name: get_highest_scan_results_leaderboard(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_highest_scan_results_leaderboard(p_limit integer DEFAULT 50) RETURNS TABLE(auth_id uuid, user_email text, display_name text, full_name text, reward_amount integer, event_source text, event_reference text, awarded_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scan_rewards as (
    select
      l.auth_id,
      lower(coalesce(pp.user_email, upd.user, upd.created_by)) as user_email,
      pp.display_name,
      pp.full_name,
      l.amount::integer as reward_amount,
      l.event_source,
      l.event_reference,
      l.created_at as awarded_at,
      row_number() over (
        partition by l.auth_id
        order by l.amount desc, l.created_at desc
      ) as rn
    from public."RobotPlantWalletLedger" l
    left join public."PublicProfile" pp
      on pp.auth_id = l.auth_id
    left join public."UserPlantDiscovery" upd
      on upd.id::text = l.event_reference
    where l.auth_id is not null
      and l.currency_code = 'seed'
      and l.direction = 'credit'
      and l.amount > 0
      and l.event_source in ('scan', 'new_scan', 'new_global_scan')
  )
  select
    auth_id,
    user_email,
    display_name,
    full_name,
    reward_amount,
    event_source,
    event_reference,
    awarded_at
  from scan_rewards
  where rn = 1
  order by reward_amount desc, awarded_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;


--
-- Name: increment_collection_followers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_collection_followers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public."Collection"
  set followers_count = coalesce(followers_count, 0) + 1
  where id = new.collection_id;

  return new;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: robot_plant_grant_reward(uuid, text, text, integer, integer, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_grant_reward(p_auth_id uuid, p_event_source text, p_event_reference text, p_amount integer, p_energy_delta integer DEFAULT 0, p_data_quality_delta integer DEFAULT 0, p_care_delta integer DEFAULT 0, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(applied boolean, ledger_id uuid, new_balance integer, new_energy integer, new_data_quality integer, new_care integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ledger_id uuid;
  v_inserted integer;
  v_robotplant public."RobotPlant"%rowtype;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;
  if coalesce(length(trim(p_event_source)), 0) = 0 then
    raise exception 'p_event_source is required';
  end if;
  if coalesce(length(trim(p_event_reference)), 0) = 0 then
    raise exception 'p_event_reference is required';
  end if;
  if p_amount < 0 then
    raise exception 'p_amount must be >= 0';
  end if;

  insert into public."RobotPlant" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  insert into public."RobotPlantWalletLedger" (
    auth_id,
    currency_code,
    direction,
    amount,
    event_source,
    event_reference,
    metadata
  )
  values (
    p_auth_id,
    'seed',
    'credit',
    p_amount,
    p_event_source,
    p_event_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (auth_id, event_source, event_reference) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
      into v_robotplant
      from public."RobotPlant"
      where auth_id = p_auth_id
      limit 1;

    return query
    select
      false as applied,
      null::uuid as ledger_id,
      v_robotplant.wallet_balance,
      v_robotplant.energy,
      v_robotplant.data_quality,
      v_robotplant.care;
    return;
  end if;

  update public."RobotPlant"
  set
    wallet_balance = greatest(0, wallet_balance + p_amount),
    energy        = least(100, greatest(0, energy        + p_energy_delta)),
    data_quality  = least(100, greatest(0, data_quality  + p_data_quality_delta)),
    care          = least(100, greatest(0, care          + p_care_delta)),
    updated_at    = now()
  where auth_id = p_auth_id
  returning * into v_robotplant;

  return query
  select
    true as applied,
    v_ledger_id,
    v_robotplant.wallet_balance,
    v_robotplant.energy,
    v_robotplant.data_quality,
    v_robotplant.care;
end;
$$;


--
-- Name: robot_plant_purchase_item(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_purchase_item(p_auth_id uuid, p_item_id uuid, p_quantity integer DEFAULT 1, p_event_reference text DEFAULT NULL::text) RETURNS TABLE(applied boolean, error_code text, ledger_id uuid, inventory_id uuid, new_balance integer, new_quantity integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_item public."RobotPlantShopItem"%rowtype;
  v_robotplant public."RobotPlant"%rowtype;
  v_total_cost integer;
  v_ledger_id uuid;
  v_inventory_id uuid;
  v_inventory_qty integer;
  v_event_reference text;
  v_inserted integer;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;
  if p_item_id is null then
    raise exception 'p_item_id is required';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'p_quantity must be > 0';
  end if;

  select *
    into v_item
    from public."RobotPlantShopItem"
   where id = p_item_id
     and is_active = true
   limit 1;

  if not found then
    return query select false, 'item_not_found'::text, null::uuid, null::uuid, null::integer, null::integer;
    return;
  end if;

  insert into public."RobotPlant" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  select *
    into v_robotplant
    from public."RobotPlant"
   where auth_id = p_auth_id
   for update;

  v_total_cost := v_item.seed_cost * p_quantity;

  if v_robotplant.wallet_balance < v_total_cost then
    return query select false, 'insufficient_balance'::text, null::uuid, null::uuid, v_robotplant.wallet_balance, null::integer;
    return;
  end if;

  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('purchase-', p_item_id::text, '-', date_trunc('second', now())::text));

  insert into public."RobotPlantWalletLedger" (
    auth_id,
    currency_code,
    direction,
    amount,
    event_source,
    event_reference,
    metadata
  )
  values (
    p_auth_id,
    'seed',
    'debit',
    v_total_cost,
    'shop_purchase',
    v_event_reference,
    jsonb_build_object(
      'item_id', p_item_id,
      'item_key', v_item.item_key,
      'quantity', p_quantity,
      'unit_cost', v_item.seed_cost,
      'total_cost', v_total_cost
    )
  )
  on conflict (auth_id, event_source, event_reference) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select quantity
      into v_inventory_qty
      from public."RobotPlantUserInventory"
     where auth_id = p_auth_id
       and item_id = p_item_id
     limit 1;

    return query
    select false, 'duplicate_event_reference'::text, null::uuid, null::uuid, v_robotplant.wallet_balance, coalesce(v_inventory_qty, 0);
    return;
  end if;

  update public."RobotPlant"
     set wallet_balance = wallet_balance - v_total_cost,
         updated_at = now()
   where auth_id = p_auth_id
   returning * into v_robotplant;

  insert into public."RobotPlantUserInventory" (
    auth_id,
    item_id,
    quantity
  )
  values (
    p_auth_id,
    p_item_id,
    p_quantity
  )
  on conflict (auth_id, item_id)
  do update set
    quantity = public."RobotPlantUserInventory".quantity + excluded.quantity,
    updated_at = now()
  returning id, quantity into v_inventory_id, v_inventory_qty;

  return query
  select true, null::text, v_ledger_id, v_inventory_id, v_robotplant.wallet_balance, v_inventory_qty;
end;
$$;


--
-- Name: robot_plant_use_inventory_item(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_use_inventory_item(p_auth_id uuid, p_item_id uuid, p_event_reference text DEFAULT NULL::text) RETURNS TABLE(applied boolean, error_code text, remaining_quantity integer, effect_type text, effect_value numeric, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_inventory public."RobotPlantUserInventory"%rowtype;
  v_item public."RobotPlantShopItem"%rowtype;
  v_event_reference text;
  v_effect_expiry timestamptz;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;
  if p_item_id is null then
    raise exception 'p_item_id is required';
  end if;

  select *
    into v_item
    from public."RobotPlantShopItem"
   where id = p_item_id
     and is_active = true
   limit 1;

  if not found then
    return query select false, 'item_not_found'::text, null::integer, null::text, null::numeric, null::timestamptz;
    return;
  end if;

  select *
    into v_inventory
    from public."RobotPlantUserInventory"
   where auth_id = p_auth_id
     and item_id = p_item_id
   for update;

  if not found or coalesce(v_inventory.quantity, 0) <= 0 then
    return query select false, 'inventory_empty'::text, 0, null::text, null::numeric, null::timestamptz;
    return;
  end if;

  if v_item.effect_value is null or v_item.duration_hours is null then
    return query select false, 'item_has_no_effect'::text, v_inventory.quantity, null::text, null::numeric, null::timestamptz;
    return;
  end if;

  update public."RobotPlantUserInventory"
     set quantity = quantity - 1,
         updated_at = now()
   where id = v_inventory.id
   returning * into v_inventory;

  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('use-', p_item_id::text, '-', date_trunc('second', now())::text));
  v_effect_expiry := now() + make_interval(hours => v_item.duration_hours);

  if v_item.item_type = 'fertilizer' then
    delete from public."RobotPlantActiveEffect" ae
     where ae.auth_id = p_auth_id
       and ae.effect_type = 'decay_reduction'
       and ae.expires_at >= now();
  end if;

  insert into public."RobotPlantActiveEffect" (
    auth_id,
    item_id,
    effect_type,
    effect_value,
    expires_at,
    source_event_reference
  )
  values (
    p_auth_id,
    p_item_id,
    case
      when v_item.item_type = 'fertilizer' then 'decay_reduction'
      else 'generic'
    end,
    v_item.effect_value,
    v_effect_expiry,
    v_event_reference
  );

  return query
  select true, null::text, v_inventory.quantity, case when v_item.item_type = 'fertilizer' then 'decay_reduction' else 'generic' end, v_item.effect_value, v_effect_expiry;
end;
$$;


--
-- Name: robot_plant_water_plant(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.robot_plant_water_plant(p_auth_id uuid, p_event_reference text DEFAULT NULL::text) RETURNS TABLE(applied boolean, error_code text, care_delta integer, remaining_waters_today integer, watering_count_today integer, new_care integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_daily_row public."RobotPlantDailyCareAction"%rowtype;
  v_robotplant public."RobotPlant"%rowtype;
  v_next_count integer;
  v_care_delta integer;
  v_event_reference text;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;
  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  insert into public."RobotPlant" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  select *
    into v_daily_row
    from public."RobotPlantDailyCareAction"
   where auth_id = p_auth_id
     and day_key = v_today
   for update;

  if not found then
    insert into public."RobotPlantDailyCareAction" (
      auth_id,
      day_key,
      watering_count
    )
    values (
      p_auth_id,
      v_today,
      0
    )
    returning * into v_daily_row;
  end if;

  if v_daily_row.watering_count >= 3 then
    select * into v_robotplant
      from public."RobotPlant"
     where auth_id = p_auth_id
     limit 1;

    return query
    select false, 'daily_limit_reached'::text, 0, 0, v_daily_row.watering_count, v_robotplant.care;
    return;
  end if;

  v_next_count := v_daily_row.watering_count + 1;
  v_care_delta := case
    when v_next_count = 1 then 3
    when v_next_count = 2 then 2
    else 1
  end;

  update public."RobotPlantDailyCareAction"
     set watering_count = v_next_count,
         updated_at = now()
   where id = v_daily_row.id
   returning * into v_daily_row;

  update public."RobotPlant"
     set care = least(100, care + v_care_delta),
         last_maintenance_at = now(),
         updated_at = now()
   where auth_id = p_auth_id
   returning * into v_robotplant;

  v_event_reference := coalesce(nullif(trim(p_event_reference), ''), concat('water-', date_trunc('second', now())::text));

  insert into public."RobotPlantWalletLedger" (
    auth_id,
    currency_code,
    direction,
    amount,
    event_source,
    event_reference,
    metadata
  )
  values (
    p_auth_id,
    'seed',
    'credit',
    0,
    'water_plant',
    v_event_reference,
    jsonb_build_object(
      'care_delta', v_care_delta,
      'watering_count_today', v_next_count
    )
  )
  on conflict (auth_id, event_source, event_reference) do nothing;

  return query
  select true, null::text, v_care_delta, (3 - v_next_count), v_next_count, v_robotplant.care;
end;
$$;


--
-- Name: set_collectionitem_readable_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_collectionitem_readable_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_collection_title text;
  v_plant_name text;
  v_genus_name text;
begin
  select c.title
    into v_collection_title
  from public."Collection" c
  where c.id = new.collection_id;

  if new.plant_id is not null then
    select p.species_name
      into v_plant_name
    from public."Plant" p
    where p.id = new.plant_id;
  else
    v_plant_name := null;
  end if;

  if new.genus_id is not null then
    select pg.genus_name
      into v_genus_name
    from public."PlantGenus" pg
    where pg.id = new.genus_id;
  elsif new.plant_id is not null then
    select pg.genus_name
      into v_genus_name
    from public."Plant" p
    join public."PlantGenus" pg
      on pg.category = p.genus_category
     and pg.category_dex_number = p.genus_number
    where p.id = new.plant_id;
  else
    v_genus_name := null;
  end if;

  new.collection_title := v_collection_title;
  new.plant_name := v_plant_name;
  new.genus_name := v_genus_name;

  return new;
end;
$$;


--
-- Name: set_plant_quiz_slot_roll_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_plant_quiz_slot_roll_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at_robot_plant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_robot_plant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at_tile_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_tile_claim() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at_wallet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_wallet() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_collectionitem_from_plant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_collectionitem_from_plant() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (
    new.species_name is distinct from old.species_name
    or new.genus_category is distinct from old.genus_category
    or new.genus_number is distinct from old.genus_number
  ) then
    update public."CollectionItem" ci
    set
      plant_name = new.species_name,
      genus_name = coalesce(
        (
          select pg.genus_name
          from public."PlantGenus" pg
          where pg.id = ci.genus_id
        ),
        (
          select pg.genus_name
          from public."PlantGenus" pg
          where pg.category = new.genus_category
            and pg.category_dex_number = new.genus_number
          limit 1
        )
      )
    where ci.plant_id = new.id;
  end if;

  return new;
end;
$$;


--
-- Name: sync_collectionitem_from_plantgenus(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_collectionitem_from_plantgenus() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.genus_name is distinct from old.genus_name then
    update public."CollectionItem"
    set genus_name = new.genus_name
    where genus_id = new.id;

    update public."CollectionItem" ci
    set genus_name = new.genus_name
    from public."Plant" p
    where ci.plant_id = p.id
      and ci.genus_id is null
      and p.genus_category = new.category
      and p.genus_number = new.category_dex_number;
  end if;

  return new;
end;
$$;


--
-- Name: sync_collectionitem_titles_from_collection(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_collectionitem_titles_from_collection() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.title is distinct from old.title then
    update public."CollectionItem"
    set collection_title = new.title
    where collection_id = new.id;
  end if;
  return new;
end;
$$;


--
-- Name: wallet_grant_currency(uuid, text, text, text, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wallet_grant_currency(p_auth_id uuid, p_currency_code text, p_event_source text, p_event_reference text, p_amount integer, p_direction text DEFAULT 'credit'::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(applied boolean, ledger_id uuid, seeds_progress integer, sparks_balance integer, amber_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ledger_id uuid;
  v_inserted integer;
  v_wallet public."UserWallet"%rowtype;
  v_sign integer;
begin
  if p_auth_id is null then
    raise exception 'p_auth_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_auth_id then
    raise exception 'p_auth_id must match auth.uid()';
  end if;

  if coalesce(length(trim(p_currency_code)), 0) = 0 then
    raise exception 'p_currency_code is required';
  end if;

  if coalesce(length(trim(p_event_source)), 0) = 0 then
    raise exception 'p_event_source is required';
  end if;

  if coalesce(length(trim(p_event_reference)), 0) = 0 then
    raise exception 'p_event_reference is required';
  end if;

  if p_amount < 0 then
    raise exception 'p_amount must be >= 0';
  end if;

  if p_currency_code not in ('seeds_progress', 'sparks', 'amber') then
    raise exception 'unsupported currency_code %', p_currency_code;
  end if;

  if p_direction not in ('credit', 'debit') then
    raise exception 'p_direction must be credit or debit';
  end if;

  v_sign := case when p_direction = 'credit' then 1 else -1 end;

  insert into public."UserWallet" (auth_id)
  values (p_auth_id)
  on conflict (auth_id) do nothing;

  insert into public."UserWalletLedger" (
    auth_id,
    currency_code,
    direction,
    amount,
    event_source,
    event_reference,
    metadata
  )
  values (
    p_auth_id,
    p_currency_code,
    p_direction,
    p_amount,
    p_event_source,
    p_event_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (auth_id, event_source, event_reference, currency_code) do nothing
  returning id into v_ledger_id;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
      into v_wallet
      from public."UserWallet"
      where auth_id = p_auth_id
      limit 1;

    return query
    select
      false,
      null::uuid,
      v_wallet.seeds_progress,
      v_wallet.sparks_balance,
      v_wallet.amber_balance;
    return;
  end if;

  update public."UserWallet" as uw
  set
    seeds_progress = case
      when p_currency_code = 'seeds_progress' then greatest(0, uw.seeds_progress + (v_sign * p_amount))
      else uw.seeds_progress
    end,
    sparks_balance = case
      when p_currency_code = 'sparks' then greatest(0, uw.sparks_balance + (v_sign * p_amount))
      else uw.sparks_balance
    end,
    amber_balance = case
      when p_currency_code = 'amber' then greatest(0, uw.amber_balance + (v_sign * p_amount))
      else uw.amber_balance
    end,
    updated_at = now()
  where uw.auth_id = p_auth_id
  returning * into v_wallet;

  return query
  select
    true,
    v_ledger_id,
    v_wallet.seeds_progress,
    v_wallet.sparks_balance,
    v_wallet.amber_balance;
end;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL AND ppt.tablename NOT LIKE '% %'),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  -- Count raw slot entries before apply_rls/subscription filter
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  -- Apply RLS and filter as before
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  -- Real rows with slot count attached
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  -- Sentinel row: always returned when no real rows exist so Elixir can
  -- always read slot_changes_count. Identified by wal IS NULL.
  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: Achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Achievements" (
    achievement_number bigint,
    title text,
    description text,
    icon_emoji text,
    rarity text,
    requirement text,
    reward_name text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text
);


--
-- Name: TABLE "Achievements"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Achievements" IS 'Achievements that are unlockable by events and unlock rewards, mainly titles.';


--
-- Name: ClassroomParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassroomParticipant" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    participant_code text NOT NULL,
    join_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ClassroomParticipantProgress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassroomParticipantProgress" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participant_id uuid NOT NULL,
    collection_item_id uuid NOT NULL,
    scan_id text,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Collection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Collection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    background_image_url text,
    background_color text,
    is_public boolean DEFAULT false NOT NULL,
    is_classroom boolean DEFAULT false NOT NULL,
    show_participant_codes boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    followers_count integer DEFAULT 0 NOT NULL
);


--
-- Name: CollectionItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CollectionItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    genus_id text,
    plant_id text,
    category text,
    sort_order integer,
    note text,
    collection_title text,
    genus_name text,
    plant_name text
);


--
-- Name: CollectionQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CollectionQuest" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    target_plants text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_date text,
    updated_date text,
    created_by text
);


--
-- Name: Friend; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Friend" (
    request_sent_by text,
    request_sent_to text,
    status text,
    added_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    is_sample boolean,
    auth_id uuid
);


--
-- Name: TABLE "Friend"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Friend" IS 'Sent friendrequest, theire state and the relationships between users';


--
-- Name: GeoRasterCell; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GeoRasterCell" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grid_id text NOT NULL,
    grid_lat_idx integer NOT NULL,
    grid_lng_idx integer NOT NULL,
    center_lat numeric(9,6) NOT NULL,
    center_lng numeric(9,6) NOT NULL,
    theme text NOT NULL,
    theme_confidence numeric(3,2) DEFAULT 0.8 NOT NULL,
    dominant_osm_tags jsonb,
    osm_element_count integer DEFAULT 0,
    nearest_osm_element_distance_m integer,
    country_code character varying(2) DEFAULT NULL::character varying,
    admin_level_4 text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_osm_update_date date,
    is_valid boolean DEFAULT true NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    theme_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    theme_anchor_points jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "GeoRasterCell_theme_check" CHECK ((theme = ANY (ARRAY['forest'::text, 'water'::text, 'urban'::text, 'meadow'::text])))
);


--
-- Name: LogoAsset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LogoAsset" (
    asset_id text NOT NULL,
    asset_type text NOT NULL,
    file_name text NOT NULL,
    r2_key text NOT NULL,
    public_url text NOT NULL,
    display_name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    default_unlocked boolean DEFAULT false NOT NULL,
    source text DEFAULT 'r2'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "LogoAsset_asset_type_check" CHECK ((asset_type = ANY (ARRAY['face'::text, 'plant'::text, 'border'::text])))
);


--
-- Name: MonthlyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MonthlyQuest" (
    quest_number bigint,
    title text,
    description text,
    requirement text,
    category text,
    required_discoveries bigint,
    target_genus_name text,
    target_species_name text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    seed_reward integer DEFAULT 1000 NOT NULL
);


--
-- Name: TABLE "MonthlyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."MonthlyQuest" IS 'Monthly Quest Data, ID starting with 10X';


--
-- Name: News; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."News" (
    title text,
    text text,
    created_date timestamp with time zone,
    old_id text,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE "News"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."News" IS 'News-Channel, displaying information thats meant to be spread among the users.';


--
-- Name: OSMTileChunkLite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OSMTileChunkLite" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dataset_version text NOT NULL,
    chunk_x integer NOT NULL,
    chunk_y integer NOT NULL,
    tile_count smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE "OSMTileChunkLite"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."OSMTileChunkLite" IS 'Chunk metadata: dataset_version, grid coordinates, minimal overhead';


--
-- Name: OSMTileValue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OSMTileValue" (
    chunk_id uuid NOT NULL,
    tile_local_x smallint NOT NULL,
    tile_local_y smallint NOT NULL,
    zone_type smallint NOT NULL,
    zone_value smallint NOT NULL
);


--
-- Name: TABLE "OSMTileValue"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."OSMTileValue" IS 'Tile zone data: local coordinates, quantized zone type (0-5), quantized zone area (0-255 scale). Multiple zones per tile supported.';


--
-- Name: Plant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plant" (
    id text NOT NULL,
    genus_category character varying NOT NULL,
    genus_number bigint,
    species_name text,
    scientific_name text,
    description text,
    identification_features text,
    fun_fact text,
    rarity text,
    created_date timestamp without time zone,
    updated_date timestamp without time zone,
    created_by_id text,
    native_region text
);


--
-- Name: TABLE "Plant"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Plant" IS 'Stores all Plants of Floralog';


--
-- Name: PlantGenus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantGenus" (
    category_dex_number bigint,
    genus_name text,
    scientific_genus text,
    category text,
    family text,
    description text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    rarity text,
    icon_url text
);


--
-- Name: TABLE "PlantGenus"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."PlantGenus" IS 'Genus information for all plants in floralog';


--
-- Name: PlantQuiz; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantQuiz" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    source_discovery_id text NOT NULL,
    correct_plant_id text NOT NULL,
    option_plant_ids jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    wrong_attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    scheduled_slot_date date NOT NULL,
    scheduled_slot_type text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    reward_seeds integer,
    reward_data_quality integer,
    notification_sent_at timestamp with time zone,
    CONSTRAINT "PlantQuiz_max_attempts_check" CHECK ((max_attempts = 3)),
    CONSTRAINT "PlantQuiz_scheduled_slot_type_check" CHECK ((scheduled_slot_type = ANY (ARRAY['midday'::text, 'evening'::text]))),
    CONSTRAINT "PlantQuiz_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'expired'::text]))),
    CONSTRAINT "PlantQuiz_wrong_attempts_check" CHECK (((wrong_attempts >= 0) AND (wrong_attempts <= 3))),
    CONSTRAINT plant_quiz_option_array CHECK (((jsonb_typeof(option_plant_ids) = 'array'::text) AND (jsonb_array_length(option_plant_ids) = 3)))
);


--
-- Name: PlantQuizExcludedDiscovery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantQuizExcludedDiscovery" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    discovery_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: PlantQuizSlotRoll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlantQuizSlotRoll" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_date date NOT NULL,
    slot_type text NOT NULL,
    run_key text NOT NULL,
    random_minute integer NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    executed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PlantQuizSlotRoll_random_minute_check" CHECK (((random_minute >= 0) AND (random_minute <= 59))),
    CONSTRAINT "PlantQuizSlotRoll_slot_type_check" CHECK ((slot_type = ANY (ARRAY['midday'::text, 'evening'::text])))
);


--
-- Name: PublicProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PublicProfile" (
    id text NOT NULL,
    user_email text NOT NULL,
    display_name text,
    full_name text,
    title text,
    selected_title text,
    avatar_url text,
    background_image_url text,
    background_color text,
    favorite_plant_id text,
    donor_status boolean,
    created_date timestamp without time zone,
    updated_date timestamp without time zone,
    created_by_id character varying,
    created_by character varying,
    auth_id uuid,
    role text,
    push_subscription text,
    fcm_token text,
    public_profile boolean DEFAULT true NOT NULL,
    local_tracking boolean DEFAULT true NOT NULL,
    selected_face_asset text DEFAULT 'face_original'::text NOT NULL,
    selected_plant_asset text DEFAULT 'plant_leaf'::text NOT NULL,
    selected_border_asset text DEFAULT 'border_original'::text NOT NULL,
    selected_border_color text,
    global_explorer_visibility boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE "PublicProfile"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."PublicProfile" IS 'The Public-Profiles of the Users of this App';


--
-- Name: COLUMN "PublicProfile".auth_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."PublicProfile".auth_id IS 'Authentication ID, Unique';


--
-- Name: Quest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Quest" (
    quest_number bigint,
    title text,
    description text,
    requirement text,
    xp_reward bigint,
    category text,
    difficulty text,
    required_discoveries bigint,
    unlocked_at_level bigint,
    prerequisite_quest_number bigint,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    reward_name text,
    targets text,
    targets_operator text,
    seed_reward integer DEFAULT 500 NOT NULL
);


--
-- Name: TABLE "Quest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Quest" IS 'Refers to single quests. Currently it is unclear how created quests know about theire "target species" or "target genus", since these fields are empty.';


--
-- Name: RasterCellQueryLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RasterCellQueryLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    query_date date NOT NULL,
    search_lat numeric(9,6) NOT NULL,
    search_lng numeric(9,6) NOT NULL,
    search_radius_m integer DEFAULT 5000 NOT NULL,
    cells_found integer NOT NULL,
    cells_by_theme jsonb,
    query_duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Referral; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Referral" (
    referrer_email text,
    referred_email text,
    status text,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "Referral"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Referral" IS 'Used to store connections between new and old users.';


--
-- Name: Rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Rewards" (
    name text,
    display_name text,
    type text,
    value text,
    color text,
    image_url text,
    requires_weekly_quests text,
    requires_monthly_quests text,
    requires_gifts text,
    requires_donor text,
    requires_referrals text,
    requires_rare_plants text,
    requires_quest text,
    random_event text,
    random_chance text,
    id text DEFAULT 'encode(gen_random_bytes(12), ''''hex'''')'::text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    requires_zone_theme text,
    requires_referred_seeds_progress integer,
    requires_plant_genus_id text,
    requires_plant_species_id text,
    spark_price integer,
    amber_price integer,
    CONSTRAINT rewards_amber_price_non_negative CHECK (((amber_price IS NULL) OR (amber_price >= 0))),
    CONSTRAINT rewards_spark_price_non_negative CHECK (((spark_price IS NULL) OR (spark_price >= 0)))
);


--
-- Name: TABLE "Rewards"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Rewards" IS 'Rewards which may be unlocked on different conditions, e.g. completion of quest ID, donation, random events and scans of certain plants.';


--
-- Name: RobotPlant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlant" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    energy integer DEFAULT 70 NOT NULL,
    data_quality integer DEFAULT 65 NOT NULL,
    care integer DEFAULT 72 NOT NULL,
    streak_days integer DEFAULT 0 NOT NULL,
    wallet_balance integer DEFAULT 0 NOT NULL,
    last_maintenance_at timestamp with time zone,
    last_decay_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_valid_geo_lat numeric(8,3),
    last_valid_geo_lng numeric(8,3),
    last_valid_geo_at timestamp with time zone,
    claimed_tiles_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT "RobotPlant_care_check" CHECK (((care >= 0) AND (care <= 100))),
    CONSTRAINT "RobotPlant_data_quality_check" CHECK (((data_quality >= 0) AND (data_quality <= 100))),
    CONSTRAINT "RobotPlant_energy_check" CHECK (((energy >= 0) AND (energy <= 100))),
    CONSTRAINT "RobotPlant_streak_days_check" CHECK ((streak_days >= 0)),
    CONSTRAINT "RobotPlant_wallet_balance_check" CHECK ((wallet_balance >= 0))
);


--
-- Name: RobotPlantActiveEffect; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantActiveEffect" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    item_id uuid,
    effect_type text NOT NULL,
    effect_value numeric(8,3) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    source_event_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: RobotPlantDailyCareAction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantDailyCareAction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    day_key date NOT NULL,
    watering_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantDailyCareAction_watering_count_check" CHECK (((watering_count >= 0) AND (watering_count <= 3)))
);


--
-- Name: RobotPlantDailyChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantDailyChallenge" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    challenge_type text NOT NULL,
    target_count integer DEFAULT 1 NOT NULL,
    target_zone_theme text,
    reward_base integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantDailyChallenge_reward_base_check" CHECK ((reward_base >= 0)),
    CONSTRAINT "RobotPlantDailyChallenge_target_count_check" CHECK ((target_count > 0))
);


--
-- Name: RobotPlantOSMCache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantOSMCache" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme text NOT NULL,
    osm_id text NOT NULL,
    osm_type text NOT NULL,
    lat numeric(9,6) NOT NULL,
    lng numeric(9,6) NOT NULL,
    area_m2 integer,
    confidence numeric(4,3) DEFAULT 1.0 NOT NULL,
    last_checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: RobotPlantShopItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantShopItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_key text NOT NULL,
    title text NOT NULL,
    description text,
    item_type text NOT NULL,
    seed_cost integer NOT NULL,
    effect_value numeric(8,3),
    duration_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantShopItem_seed_cost_check" CHECK ((seed_cost >= 0))
);


--
-- Name: RobotPlantUserDailyChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantUserDailyChallenge" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    challenge_date date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantUserDailyChallenge_progress_check" CHECK ((progress >= 0)),
    CONSTRAINT "RobotPlantUserDailyChallenge_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'claimed'::text])))
);


--
-- Name: RobotPlantUserInventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantUserInventory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantUserInventory_quantity_check" CHECK ((quantity >= 0))
);


--
-- Name: RobotPlantUserZoneState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantUserZoneState" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    day_key date NOT NULL,
    scans_in_zone integer DEFAULT 0 NOT NULL,
    unique_species_count integer DEFAULT 0 NOT NULL,
    last_scan_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantUserZoneState_scans_in_zone_check" CHECK ((scans_in_zone >= 0)),
    CONSTRAINT "RobotPlantUserZoneState_unique_species_count_check" CHECK ((unique_species_count >= 0))
);


--
-- Name: RobotPlantWalletLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantWalletLedger" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    currency_code text DEFAULT 'seed'::text NOT NULL,
    direction text DEFAULT 'credit'::text NOT NULL,
    amount integer NOT NULL,
    event_source text NOT NULL,
    event_reference text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "RobotPlantWalletLedger_amount_check" CHECK ((amount >= 0)),
    CONSTRAINT "RobotPlantWalletLedger_direction_check" CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: RobotPlantZone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantZone" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_key text NOT NULL,
    title text NOT NULL,
    theme text NOT NULL,
    center_lat double precision NOT NULL,
    center_lng double precision NOT NULL,
    radius_m integer NOT NULL,
    zone_bonus_multiplier numeric(6,3) DEFAULT 1.000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    day_generated date,
    CONSTRAINT "RobotPlantZone_radius_m_check" CHECK ((radius_m > 0))
);


--
-- Name: RobotPlantZoneGenerationLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RobotPlantZoneGenerationLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    day_key date NOT NULL,
    search_radius_m integer,
    candidate_count_by_theme jsonb,
    selected_zone_count integer,
    osm_cache_hits integer DEFAULT 0,
    osm_live_queries integer DEFAULT 0,
    osm_errors integer DEFAULT 0,
    clipping_stats jsonb,
    total_duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rerolls_granted_today integer DEFAULT 1 NOT NULL,
    reroll_count integer DEFAULT 0 NOT NULL
);


--
-- Name: ScanLike; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScanLike" (
    discovery_id text,
    liked_by text,
    liked_date timestamp with time zone,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "ScanLike"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."ScanLike" IS 'Scans that are shared among the community (e.g. WeeklyScan) might get liked by other members.';


--
-- Name: SharedScan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SharedScan" (
    discovery_id text,
    plant_id text,
    shared_by text,
    shared_to text,
    shared_date timestamp with time zone,
    image_url text,
    discovery_location text,
    viewed boolean,
    viewed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id_from uuid,
    auth_id_to uuid
);


--
-- Name: TABLE "SharedScan"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."SharedScan" IS 'Scans might be shared with other users and friends. Send a rose to your loved ones!';


--
-- Name: TileClaim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TileClaim" (
    tile_x integer NOT NULL,
    tile_y integer NOT NULL,
    owner_auth_id uuid NOT NULL,
    owner_scan_count integer DEFAULT 0 NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_group_name text,
    CONSTRAINT "TileClaim_owner_scan_count_check" CHECK ((owner_scan_count >= 0)),
    CONSTRAINT tileclaim_claim_group_name_length CHECK (((claim_group_name IS NULL) OR ((char_length(claim_group_name) >= 3) AND (char_length(claim_group_name) <= 48))))
);


--
-- Name: UserAchievement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAchievement" (
    achievement_id text,
    unlocked_date timestamp with time zone,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "UserAchievement"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserAchievement" IS 'The Achievements the users of Floralog unlocked.';


--
-- Name: UserCollection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCollection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserCollectionQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCollectionQuest" (
    id text NOT NULL,
    auth_id uuid,
    collection_quest_id text,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    accepted text,
    redeemed text,
    completed text,
    accepted_date text,
    completed_date text,
    redeemed_date text,
    discovered_plants text[] DEFAULT '{}'::text[],
    created_date text,
    updated_date text,
    created_by text,
    created_by_id text
);


--
-- Name: UserCollectionQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserCollectionQuest_backup_2026_02_28" (
    id text,
    auth_id uuid,
    collection_quest_id text,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    accepted text,
    redeemed text,
    completed text,
    accepted_date text,
    completed_date text,
    redeemed_date text,
    discovered_plants text[],
    created_date text,
    updated_date text,
    created_by text,
    created_by_id text
);


--
-- Name: UserEngagementState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserEngagementState" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    last_login_date date,
    login_streak_days integer DEFAULT 0 NOT NULL,
    last_daily_login_claim_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserEngagementState_login_streak_days_check" CHECK ((login_streak_days >= 0))
);


--
-- Name: UserMonthlyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserMonthlyQuest" (
    monthly_quest_id text,
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    completed boolean,
    active_month text,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_date timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE "UserMonthlyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserMonthlyQuest" IS 'MonthlyQuests that are currently active for users.';


--
-- Name: UserMonthlyQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserMonthlyQuest_backup_2026_02_28" (
    monthly_quest_id text,
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    completed boolean,
    active_month text,
    completed_date text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: UserNotification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserNotification" (
    user_email text,
    notification_type text,
    related_quest_id text,
    seen boolean,
    message text,
    title text,
    description text,
    action_url text,
    priority text,
    display_location text,
    id text DEFAULT extensions.gen_random_bytes(12) NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "UserNotification"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserNotification" IS 'Motivational notifications that are sent to users';


--
-- Name: COLUMN "UserNotification".auth_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."UserNotification".auth_id IS 'User ID';


--
-- Name: UserPlantDiscovery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPlantDiscovery" (
    plant_id text,
    discovered_date timestamp with time zone,
    discovery_location text,
    discovery_notes text,
    image_url text,
    is_front_image boolean,
    is_species_front_image boolean,
    id text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text) NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    "user" text,
    auth_id uuid
);


--
-- Name: TABLE "UserPlantDiscovery"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserPlantDiscovery" IS 'Information about all scans done by the users to connect them to theire profiles.';


--
-- Name: UserQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserQuest" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    quest_id text,
    completed boolean,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_date timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE "UserQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserQuest" IS 'Reference between Quests and Users';


--
-- Name: COLUMN "UserQuest".auth_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."UserQuest".auth_id IS 'Auth ID, unique connection to user';


--
-- Name: UserQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserQuest_backup_2026_02_28" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    quest_id text,
    completed boolean,
    completed_date text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: UserRewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserRewards" (
    reward_id text,
    reward_name text,
    user_email text,
    user_name text,
    unlocked_date timestamp with time zone,
    id text DEFAULT ROW(extensions.gen_random_bytes(12)) NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid
);


--
-- Name: TABLE "UserRewards"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserRewards" IS 'Connection between users and unlocked rewards';


--
-- Name: UserWallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWallet" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    seeds_progress integer DEFAULT 0 NOT NULL,
    sparks_balance integer DEFAULT 0 NOT NULL,
    amber_balance integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserWallet_amber_balance_check" CHECK ((amber_balance >= 0)),
    CONSTRAINT "UserWallet_seeds_progress_check" CHECK ((seeds_progress >= 0)),
    CONSTRAINT "UserWallet_sparks_balance_check" CHECK ((sparks_balance >= 0))
);


--
-- Name: UserWalletLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWalletLedger" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid NOT NULL,
    currency_code text NOT NULL,
    direction text DEFAULT 'credit'::text NOT NULL,
    amount integer NOT NULL,
    event_source text NOT NULL,
    event_reference text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UserWalletLedger_amount_check" CHECK ((amount >= 0)),
    CONSTRAINT "UserWalletLedger_currency_code_check" CHECK ((currency_code = ANY (ARRAY['seeds_progress'::text, 'sparks'::text, 'amber'::text]))),
    CONSTRAINT "UserWalletLedger_direction_check" CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: UserWeeklyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWeeklyQuest" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    active_week text,
    completed boolean,
    weekly_quest_id text,
    completed_date text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_date timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE "UserWeeklyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserWeeklyQuest" IS 'Connection between weekly quests and users.';


--
-- Name: UserWeeklyQuest_backup_2026_02_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserWeeklyQuest_backup_2026_02_28" (
    redeemed text,
    accepted jsonb,
    accepted_date text,
    progress text,
    active_week text,
    completed boolean,
    weekly_quest_id text,
    completed_date text,
    id text,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    auth_id uuid,
    status text,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    quest_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: WeeklyQuest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WeeklyQuest" (
    quest_number bigint,
    title text,
    description text,
    requirement text,
    category text,
    required_discoveries bigint,
    target_genus_name text,
    target_species_name text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    created_by_id text,
    created_by text,
    seed_reward integer DEFAULT 1500 NOT NULL
);


--
-- Name: TABLE "WeeklyQuest"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."WeeklyQuest" IS 'Data about Weekly Quests that have been created, starting with 2xx';


--
-- Name: baseUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."baseUser" (
    title text,
    display_name text,
    id text NOT NULL,
    created_date timestamp with time zone,
    updated_date timestamp with time zone,
    email text,
    full_name text,
    disabled text,
    is_verified boolean,
    app_id text,
    user_role text,
    role text,
    _app_role text,
    background_image_url text,
    background_color text,
    donor_status text,
    weekly_bg1_unlocked text,
    avatar_url text,
    selected_title text,
    favorite_category text,
    favorite_plant_id text,
    weekly_bg2_unlocked text,
    donor text,
    gift_bg_unlocked text,
    auth_id uuid
);

ALTER TABLE ONLY public."baseUser" FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE "baseUser"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."baseUser" IS 'Old Base44 Auth list. Following has to be doublechecked: Why does User-Table has information regarding certain reward unlocks? Is the "title" column being used?';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_05_17; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_17 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_18; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_18 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_19; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_19 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_20; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_20 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_21; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_22; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_23; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: messages_2026_05_17; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_17 FOR VALUES FROM ('2026-05-17 00:00:00') TO ('2026-05-18 00:00:00');


--
-- Name: messages_2026_05_18; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_18 FOR VALUES FROM ('2026-05-18 00:00:00') TO ('2026-05-19 00:00:00');


--
-- Name: messages_2026_05_19; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_19 FOR VALUES FROM ('2026-05-19 00:00:00') TO ('2026-05-20 00:00:00');


--
-- Name: messages_2026_05_20; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_20 FOR VALUES FROM ('2026-05-20 00:00:00') TO ('2026-05-21 00:00:00');


--
-- Name: messages_2026_05_21; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_21 FOR VALUES FROM ('2026-05-21 00:00:00') TO ('2026-05-22 00:00:00');


--
-- Name: messages_2026_05_22; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_22 FOR VALUES FROM ('2026-05-22 00:00:00') TO ('2026-05-23 00:00:00');


--
-- Name: messages_2026_05_23; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_23 FOR VALUES FROM ('2026-05-23 00:00:00') TO ('2026-05-24 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: Achievements Achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Achievements"
    ADD CONSTRAINT "Achievements_pkey" PRIMARY KEY (id);


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_participant_id_collection_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_participant_id_collection_item_key" UNIQUE (participant_id, collection_item_id);


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_pkey" PRIMARY KEY (id);


--
-- Name: ClassroomParticipant ClassroomParticipant_join_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipant"
    ADD CONSTRAINT "ClassroomParticipant_join_token_key" UNIQUE (join_token);


--
-- Name: ClassroomParticipant ClassroomParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipant"
    ADD CONSTRAINT "ClassroomParticipant_pkey" PRIMARY KEY (id);


--
-- Name: CollectionItem CollectionItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_pkey" PRIMARY KEY (id);


--
-- Name: CollectionQuest CollectionQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionQuest"
    ADD CONSTRAINT "CollectionQuest_pkey" PRIMARY KEY (id);


--
-- Name: Collection Collection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Collection"
    ADD CONSTRAINT "Collection_pkey" PRIMARY KEY (id);


--
-- Name: Collection Collection_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Collection"
    ADD CONSTRAINT "Collection_slug_key" UNIQUE (slug);


--
-- Name: Friend Friend_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Friend"
    ADD CONSTRAINT "Friend_pkey" PRIMARY KEY (id);


--
-- Name: GeoRasterCell GeoRasterCell_grid_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeoRasterCell"
    ADD CONSTRAINT "GeoRasterCell_grid_id_key" UNIQUE (grid_id);


--
-- Name: GeoRasterCell GeoRasterCell_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeoRasterCell"
    ADD CONSTRAINT "GeoRasterCell_pkey" PRIMARY KEY (id);


--
-- Name: LogoAsset LogoAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LogoAsset"
    ADD CONSTRAINT "LogoAsset_pkey" PRIMARY KEY (asset_id);


--
-- Name: News News_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."News"
    ADD CONSTRAINT "News_pkey" PRIMARY KEY (id);


--
-- Name: OSMTileChunkLite OSMTileChunkLite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OSMTileChunkLite"
    ADD CONSTRAINT "OSMTileChunkLite_pkey" PRIMARY KEY (id);


--
-- Name: OSMTileValue OSMTileValue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OSMTileValue"
    ADD CONSTRAINT "OSMTileValue_pkey" PRIMARY KEY (chunk_id, tile_local_x, tile_local_y, zone_type);


--
-- Name: PlantGenus PlantGenus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantGenus"
    ADD CONSTRAINT "PlantGenus_pkey" PRIMARY KEY (id);


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_auth_id_discovery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_auth_id_discovery_id_key" UNIQUE (auth_id, discovery_id);


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_pkey" PRIMARY KEY (id);


--
-- Name: PlantQuizSlotRoll PlantQuizSlotRoll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizSlotRoll"
    ADD CONSTRAINT "PlantQuizSlotRoll_pkey" PRIMARY KEY (id);


--
-- Name: PlantQuizSlotRoll PlantQuizSlotRoll_run_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizSlotRoll"
    ADD CONSTRAINT "PlantQuizSlotRoll_run_key_key" UNIQUE (run_key);


--
-- Name: PlantQuiz PlantQuiz_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_pkey" PRIMARY KEY (id);


--
-- Name: Plant Plant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plant"
    ADD CONSTRAINT "Plant_pkey" PRIMARY KEY (id);


--
-- Name: PublicProfile PublicProfile_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "PublicProfile_auth_id_key" UNIQUE (auth_id);


--
-- Name: PublicProfile PublicProfile_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "PublicProfile_user_email_key" UNIQUE (user_email);


--
-- Name: RasterCellQueryLog RasterCellQueryLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RasterCellQueryLog"
    ADD CONSTRAINT "RasterCellQueryLog_pkey" PRIMARY KEY (id);


--
-- Name: Referral Referral_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_pkey" PRIMARY KEY (id);


--
-- Name: Rewards Rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantActiveEffect RobotPlantActiveEffect_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantActiveEffect"
    ADD CONSTRAINT "RobotPlantActiveEffect_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantDailyCareAction RobotPlantDailyCareAction_auth_id_day_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyCareAction"
    ADD CONSTRAINT "RobotPlantDailyCareAction_auth_id_day_key_key" UNIQUE (auth_id, day_key);


--
-- Name: RobotPlantDailyCareAction RobotPlantDailyCareAction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyCareAction"
    ADD CONSTRAINT "RobotPlantDailyCareAction_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantDailyChallenge RobotPlantDailyChallenge_challenge_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyChallenge"
    ADD CONSTRAINT "RobotPlantDailyChallenge_challenge_key_key" UNIQUE (challenge_key);


--
-- Name: RobotPlantDailyChallenge RobotPlantDailyChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyChallenge"
    ADD CONSTRAINT "RobotPlantDailyChallenge_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantOSMCache RobotPlantOSMCache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantOSMCache"
    ADD CONSTRAINT "RobotPlantOSMCache_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantOSMCache RobotPlantOSMCache_theme_osm_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantOSMCache"
    ADD CONSTRAINT "RobotPlantOSMCache_theme_osm_id_key" UNIQUE (theme, osm_id);


--
-- Name: RobotPlantShopItem RobotPlantShopItem_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantShopItem"
    ADD CONSTRAINT "RobotPlantShopItem_item_key_key" UNIQUE (item_key);


--
-- Name: RobotPlantShopItem RobotPlantShopItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantShopItem"
    ADD CONSTRAINT "RobotPlantShopItem_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_auth_id_challenge_id_challenge_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_auth_id_challenge_id_challenge_key" UNIQUE (auth_id, challenge_id, challenge_date);


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_auth_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_auth_id_item_id_key" UNIQUE (auth_id, item_id);


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_auth_id_zone_id_day_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_auth_id_zone_id_day_key_key" UNIQUE (auth_id, zone_id, day_key);


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantWalletLedger RobotPlantWalletLedger_auth_id_event_source_event_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantWalletLedger"
    ADD CONSTRAINT "RobotPlantWalletLedger_auth_id_event_source_event_reference_key" UNIQUE (auth_id, event_source, event_reference);


--
-- Name: RobotPlantWalletLedger RobotPlantWalletLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantWalletLedger"
    ADD CONSTRAINT "RobotPlantWalletLedger_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantZoneGenerationLog RobotPlantZoneGenerationLog_auth_id_day_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZoneGenerationLog"
    ADD CONSTRAINT "RobotPlantZoneGenerationLog_auth_id_day_key_key" UNIQUE (auth_id, day_key);


--
-- Name: RobotPlantZoneGenerationLog RobotPlantZoneGenerationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZoneGenerationLog"
    ADD CONSTRAINT "RobotPlantZoneGenerationLog_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantZone RobotPlantZone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZone"
    ADD CONSTRAINT "RobotPlantZone_pkey" PRIMARY KEY (id);


--
-- Name: RobotPlantZone RobotPlantZone_zone_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZone"
    ADD CONSTRAINT "RobotPlantZone_zone_key_key" UNIQUE (zone_key);


--
-- Name: RobotPlant RobotPlant_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlant"
    ADD CONSTRAINT "RobotPlant_auth_id_key" UNIQUE (auth_id);


--
-- Name: RobotPlant RobotPlant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlant"
    ADD CONSTRAINT "RobotPlant_pkey" PRIMARY KEY (id);


--
-- Name: ScanLike ScanLike_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScanLike"
    ADD CONSTRAINT "ScanLike_pkey" PRIMARY KEY (id);


--
-- Name: SharedScan SharedScan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SharedScan"
    ADD CONSTRAINT "SharedScan_pkey" PRIMARY KEY (id);


--
-- Name: TileClaim TileClaim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TileClaim"
    ADD CONSTRAINT "TileClaim_pkey" PRIMARY KEY (tile_x, tile_y);


--
-- Name: UserCollectionQuest UserCollectionQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollectionQuest"
    ADD CONSTRAINT "UserCollectionQuest_pkey" PRIMARY KEY (id);


--
-- Name: UserCollection UserCollection_auth_id_collection_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_auth_id_collection_id_key" UNIQUE (auth_id, collection_id);


--
-- Name: UserCollection UserCollection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_pkey" PRIMARY KEY (id);


--
-- Name: UserEngagementState UserEngagementState_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEngagementState"
    ADD CONSTRAINT "UserEngagementState_auth_id_key" UNIQUE (auth_id);


--
-- Name: UserEngagementState UserEngagementState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEngagementState"
    ADD CONSTRAINT "UserEngagementState_pkey" PRIMARY KEY (id);


--
-- Name: UserMonthlyQuest UserMonthlyQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMonthlyQuest"
    ADD CONSTRAINT "UserMonthlyQuest_pkey" PRIMARY KEY (id);


--
-- Name: UserNotification UserNotification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotification"
    ADD CONSTRAINT "UserNotification_pkey" PRIMARY KEY (id);


--
-- Name: UserPlantDiscovery UserPlantDiscovery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPlantDiscovery"
    ADD CONSTRAINT "UserPlantDiscovery_pkey" PRIMARY KEY (id);


--
-- Name: Quest UserQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quest"
    ADD CONSTRAINT "UserQuest_pkey" PRIMARY KEY (id);


--
-- Name: UserQuest UserQuest_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserQuest"
    ADD CONSTRAINT "UserQuest_pkey1" PRIMARY KEY (id);


--
-- Name: UserRewards UserRewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserRewards"
    ADD CONSTRAINT "UserRewards_pkey" PRIMARY KEY (id);


--
-- Name: UserWalletLedger UserWalletLedger_auth_id_event_source_event_reference_curre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWalletLedger"
    ADD CONSTRAINT "UserWalletLedger_auth_id_event_source_event_reference_curre_key" UNIQUE (auth_id, event_source, event_reference, currency_code);


--
-- Name: UserWalletLedger UserWalletLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWalletLedger"
    ADD CONSTRAINT "UserWalletLedger_pkey" PRIMARY KEY (id);


--
-- Name: UserWallet UserWallet_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_auth_id_key" UNIQUE (auth_id);


--
-- Name: UserWallet UserWallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_pkey" PRIMARY KEY (id);


--
-- Name: UserWeeklyQuest UserWeeklyQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWeeklyQuest"
    ADD CONSTRAINT "UserWeeklyQuest_pkey" PRIMARY KEY (id);


--
-- Name: PublicProfile User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: baseUser User_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."baseUser"
    ADD CONSTRAINT "User_pkey1" PRIMARY KEY (id);


--
-- Name: WeeklyQuest WeeklyQuest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeeklyQuest"
    ADD CONSTRAINT "WeeklyQuest_pkey" PRIMARY KEY (id);


--
-- Name: baseUser baseuser_auth_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."baseUser"
    ADD CONSTRAINT baseuser_auth_id_unique UNIQUE (auth_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_17 messages_2026_05_17_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_17
    ADD CONSTRAINT messages_2026_05_17_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_18 messages_2026_05_18_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_18
    ADD CONSTRAINT messages_2026_05_18_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_19 messages_2026_05_19_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_19
    ADD CONSTRAINT messages_2026_05_19_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_20 messages_2026_05_20_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_20
    ADD CONSTRAINT messages_2026_05_20_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_21 messages_2026_05_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_21
    ADD CONSTRAINT messages_2026_05_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_22 messages_2026_05_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_22
    ADD CONSTRAINT messages_2026_05_22_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_23 messages_2026_05_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_23
    ADD CONSTRAINT messages_2026_05_23_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: UserAchievement_auth_achievement_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserAchievement_auth_achievement_unique" ON public."UserAchievement" USING btree (auth_id, achievement_id);


--
-- Name: idx_baseuser_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_baseuser_auth_id ON public."baseUser" USING btree (auth_id);


--
-- Name: idx_baseuser_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_baseuser_email ON public."baseUser" USING btree (email);


--
-- Name: idx_classroom_participant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_participant_code ON public."ClassroomParticipant" USING btree (participant_code);


--
-- Name: idx_classroom_participant_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_participant_collection_id ON public."ClassroomParticipant" USING btree (collection_id);


--
-- Name: idx_collection_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_auth_id ON public."Collection" USING btree (auth_id);


--
-- Name: idx_collection_is_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_is_public ON public."Collection" USING btree (is_public);


--
-- Name: idx_collection_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_slug ON public."Collection" USING btree (slug);


--
-- Name: idx_collectionitem_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectionitem_collection_id ON public."CollectionItem" USING btree (collection_id);


--
-- Name: idx_collectionitem_genus_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectionitem_genus_id ON public."CollectionItem" USING btree (genus_id);


--
-- Name: idx_collectionitem_plant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectionitem_plant_id ON public."CollectionItem" USING btree (plant_id);


--
-- Name: idx_cpp_collection_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpp_collection_item_id ON public."ClassroomParticipantProgress" USING btree (collection_item_id);


--
-- Name: idx_cpp_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpp_participant_id ON public."ClassroomParticipantProgress" USING btree (participant_id);


--
-- Name: idx_geo_raster_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_confidence ON public."GeoRasterCell" USING btree (theme, theme_confidence DESC);


--
-- Name: idx_geo_raster_grid_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_grid_coords ON public."GeoRasterCell" USING btree (grid_lat_idx, grid_lng_idx);


--
-- Name: idx_geo_raster_grid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_grid_id ON public."GeoRasterCell" USING btree (grid_id);


--
-- Name: idx_geo_raster_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_theme ON public."GeoRasterCell" USING btree (theme);


--
-- Name: idx_geo_raster_theme_scores; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_theme_scores ON public."GeoRasterCell" USING gin (theme_scores);


--
-- Name: idx_geo_raster_valid_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_raster_valid_theme ON public."GeoRasterCell" USING btree (is_valid, theme);


--
-- Name: idx_osm_cache_theme_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_cache_theme_area ON public."RobotPlantOSMCache" USING btree (theme, area_m2 DESC);


--
-- Name: idx_osm_chunk_lite_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_chunk_lite_coords ON public."OSMTileChunkLite" USING btree (dataset_version, chunk_x, chunk_y);


--
-- Name: idx_osm_chunk_lite_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_osm_chunk_lite_unique ON public."OSMTileChunkLite" USING btree (dataset_version, chunk_x, chunk_y);


--
-- Name: idx_osm_chunk_lite_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_chunk_lite_version ON public."OSMTileChunkLite" USING btree (dataset_version);


--
-- Name: idx_osm_tile_value_chunk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_tile_value_chunk_id ON public."OSMTileValue" USING btree (chunk_id);


--
-- Name: idx_osm_tile_value_chunk_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_tile_value_chunk_zone ON public."OSMTileValue" USING btree (chunk_id, zone_type);


--
-- Name: idx_osm_tile_value_zone_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_osm_tile_value_zone_type ON public."OSMTileValue" USING btree (zone_type);


--
-- Name: idx_plant_quiz_auth_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plant_quiz_auth_created ON public."PlantQuiz" USING btree (auth_id, created_at DESC);


--
-- Name: idx_plant_quiz_excluded_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plant_quiz_excluded_auth ON public."PlantQuizExcludedDiscovery" USING btree (auth_id, created_at DESC);


--
-- Name: idx_plant_quiz_one_open_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_plant_quiz_one_open_per_user ON public."PlantQuiz" USING btree (auth_id) WHERE (status = 'open'::text);


--
-- Name: idx_plant_quiz_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plant_quiz_slot ON public."PlantQuiz" USING btree (scheduled_slot_date, scheduled_slot_type);


--
-- Name: idx_plant_quiz_slot_roll_unique_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_plant_quiz_slot_roll_unique_slot ON public."PlantQuizSlotRoll" USING btree (slot_date, slot_type);


--
-- Name: idx_raster_query_log_auth_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raster_query_log_auth_date ON public."RasterCellQueryLog" USING btree (auth_id, query_date);


--
-- Name: idx_rewards_requires_plant_genus_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_requires_plant_genus_id ON public."Rewards" USING btree (requires_plant_genus_id) WHERE (requires_plant_genus_id IS NOT NULL);


--
-- Name: idx_rewards_requires_plant_species_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_requires_plant_species_id ON public."Rewards" USING btree (requires_plant_species_id) WHERE (requires_plant_species_id IS NOT NULL);


--
-- Name: idx_rewards_requires_zone_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_requires_zone_theme ON public."Rewards" USING btree (requires_zone_theme) WHERE (requires_zone_theme IS NOT NULL);


--
-- Name: idx_robotplant_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_auth_id ON public."RobotPlant" USING btree (auth_id);


--
-- Name: idx_robotplant_dailycare_auth_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_dailycare_auth_day ON public."RobotPlantDailyCareAction" USING btree (auth_id, day_key DESC);


--
-- Name: idx_robotplant_dailychallenge_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_dailychallenge_active ON public."RobotPlantDailyChallenge" USING btree (is_active);


--
-- Name: idx_robotplant_effect_auth_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_effect_auth_expires ON public."RobotPlantActiveEffect" USING btree (auth_id, expires_at);


--
-- Name: idx_robotplant_inventory_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_inventory_auth ON public."RobotPlantUserInventory" USING btree (auth_id);


--
-- Name: idx_robotplant_last_valid_geo_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_last_valid_geo_at ON public."RobotPlant" USING btree (last_valid_geo_at DESC);


--
-- Name: idx_robotplant_ledger_auth_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_ledger_auth_id_created_at ON public."RobotPlantWalletLedger" USING btree (auth_id, created_at DESC);


--
-- Name: idx_robotplant_ledger_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_ledger_event ON public."RobotPlantWalletLedger" USING btree (event_source, event_reference);


--
-- Name: idx_robotplant_shopitem_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_shopitem_active ON public."RobotPlantShopItem" USING btree (is_active);


--
-- Name: idx_robotplant_userdaily_auth_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_userdaily_auth_date ON public."RobotPlantUserDailyChallenge" USING btree (auth_id, challenge_date DESC);


--
-- Name: idx_robotplant_userzonestate_auth_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_userzonestate_auth_day ON public."RobotPlantUserZoneState" USING btree (auth_id, day_key DESC);


--
-- Name: idx_robotplant_zone_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_zone_active ON public."RobotPlantZone" USING btree (is_active);


--
-- Name: idx_robotplant_zone_day_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotplant_zone_day_theme ON public."RobotPlantZone" USING btree (day_generated, theme);


--
-- Name: idx_tileclaim_owner_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tileclaim_owner_auth_id ON public."TileClaim" USING btree (owner_auth_id);


--
-- Name: idx_tileclaim_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tileclaim_updated_at ON public."TileClaim" USING btree (updated_at DESC);


--
-- Name: idx_usercollection_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usercollection_auth_id ON public."UserCollection" USING btree (auth_id);


--
-- Name: idx_usercollection_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usercollection_collection_id ON public."UserCollection" USING btree (collection_id);


--
-- Name: idx_userengagement_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userengagement_auth_id ON public."UserEngagementState" USING btree (auth_id);


--
-- Name: idx_userwallet_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userwallet_auth_id ON public."UserWallet" USING btree (auth_id);


--
-- Name: idx_userwalletledger_auth_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userwalletledger_auth_created ON public."UserWalletLedger" USING btree (auth_id, created_at DESC);


--
-- Name: idx_userwalletledger_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userwalletledger_event ON public."UserWalletLedger" USING btree (event_source, event_reference, currency_code);


--
-- Name: idx_zone_gen_log_auth_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zone_gen_log_auth_day ON public."RobotPlantZoneGenerationLog" USING btree (auth_id, day_key);


--
-- Name: logo_asset_r2_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX logo_asset_r2_key_idx ON public."LogoAsset" USING btree (r2_key);


--
-- Name: logo_asset_type_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logo_asset_type_active_idx ON public."LogoAsset" USING btree (asset_type, active);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_17_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_17_inserted_at_topic_idx ON realtime.messages_2026_05_17 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_18_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_18_inserted_at_topic_idx ON realtime.messages_2026_05_18 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_19_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_19_inserted_at_topic_idx ON realtime.messages_2026_05_19 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_20_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_20_inserted_at_topic_idx ON realtime.messages_2026_05_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_21_inserted_at_topic_idx ON realtime.messages_2026_05_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_22_inserted_at_topic_idx ON realtime.messages_2026_05_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_23_inserted_at_topic_idx ON realtime.messages_2026_05_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2026_05_17_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_17_inserted_at_topic_idx;


--
-- Name: messages_2026_05_17_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_17_pkey;


--
-- Name: messages_2026_05_18_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_18_inserted_at_topic_idx;


--
-- Name: messages_2026_05_18_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_18_pkey;


--
-- Name: messages_2026_05_19_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_19_inserted_at_topic_idx;


--
-- Name: messages_2026_05_19_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_19_pkey;


--
-- Name: messages_2026_05_20_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_20_inserted_at_topic_idx;


--
-- Name: messages_2026_05_20_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_20_pkey;


--
-- Name: messages_2026_05_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_21_inserted_at_topic_idx;


--
-- Name: messages_2026_05_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_21_pkey;


--
-- Name: messages_2026_05_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_22_inserted_at_topic_idx;


--
-- Name: messages_2026_05_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_22_pkey;


--
-- Name: messages_2026_05_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_23_inserted_at_topic_idx;


--
-- Name: messages_2026_05_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_23_pkey;


--
-- Name: Collection trg_collection_sync_collectionitem_title; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collection_sync_collectionitem_title AFTER UPDATE OF title ON public."Collection" FOR EACH ROW EXECUTE FUNCTION public.sync_collectionitem_titles_from_collection();


--
-- Name: CollectionItem trg_collectionitem_set_readable_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collectionitem_set_readable_fields BEFORE INSERT OR UPDATE OF collection_id, genus_id, plant_id ON public."CollectionItem" FOR EACH ROW EXECUTE FUNCTION public.set_collectionitem_readable_fields();


--
-- Name: PlantQuizSlotRoll trg_plant_quiz_slot_roll_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plant_quiz_slot_roll_updated_at BEFORE UPDATE ON public."PlantQuizSlotRoll" FOR EACH ROW EXECUTE FUNCTION public.set_plant_quiz_slot_roll_updated_at();


--
-- Name: Plant trg_plant_sync_collectionitem; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plant_sync_collectionitem AFTER UPDATE OF species_name, genus_category, genus_number ON public."Plant" FOR EACH ROW EXECUTE FUNCTION public.sync_collectionitem_from_plant();


--
-- Name: PlantGenus trg_plantgenus_sync_collectionitem; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plantgenus_sync_collectionitem AFTER UPDATE OF genus_name ON public."PlantGenus" FOR EACH ROW EXECUTE FUNCTION public.sync_collectionitem_from_plantgenus();


--
-- Name: RobotPlantDailyCareAction trg_robotplant_dailycare_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_robotplant_dailycare_updated_at BEFORE UPDATE ON public."RobotPlantDailyCareAction" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_robot_plant();


--
-- Name: RobotPlantUserInventory trg_robotplant_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_robotplant_inventory_updated_at BEFORE UPDATE ON public."RobotPlantUserInventory" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_robot_plant();


--
-- Name: RobotPlant trg_robotplant_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_robotplant_updated_at BEFORE UPDATE ON public."RobotPlant" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_robot_plant();


--
-- Name: TileClaim trg_set_updated_at_tile_claim; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_tile_claim BEFORE UPDATE ON public."TileClaim" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_tile_claim();


--
-- Name: UserCollection trg_usercollection_followers_dec; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usercollection_followers_dec AFTER DELETE ON public."UserCollection" FOR EACH ROW EXECUTE FUNCTION public.decrement_collection_followers();


--
-- Name: UserCollection trg_usercollection_followers_inc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usercollection_followers_inc AFTER INSERT ON public."UserCollection" FOR EACH ROW EXECUTE FUNCTION public.increment_collection_followers();


--
-- Name: UserEngagementState trg_userengagement_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_userengagement_updated_at BEFORE UPDATE ON public."UserEngagementState" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_wallet();


--
-- Name: UserWallet trg_userwallet_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_userwallet_updated_at BEFORE UPDATE ON public."UserWallet" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_wallet();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Achievements Achievements_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Achievements"
    ADD CONSTRAINT "Achievements_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."baseUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_collection_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_collection_item_id_fkey" FOREIGN KEY (collection_item_id) REFERENCES public."CollectionItem"(id) ON DELETE CASCADE;


--
-- Name: ClassroomParticipantProgress ClassroomParticipantProgress_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipantProgress"
    ADD CONSTRAINT "ClassroomParticipantProgress_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES public."ClassroomParticipant"(id) ON DELETE CASCADE;


--
-- Name: ClassroomParticipant ClassroomParticipant_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassroomParticipant"
    ADD CONSTRAINT "ClassroomParticipant_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."Collection"(id) ON DELETE CASCADE;


--
-- Name: CollectionItem CollectionItem_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."Collection"(id) ON DELETE CASCADE;


--
-- Name: CollectionItem CollectionItem_genus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_genus_id_fkey" FOREIGN KEY (genus_id) REFERENCES public."PlantGenus"(id) ON DELETE SET NULL;


--
-- Name: CollectionItem CollectionItem_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CollectionItem"
    ADD CONSTRAINT "CollectionItem_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES public."Plant"(id) ON DELETE SET NULL;


--
-- Name: Collection Collection_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Collection"
    ADD CONSTRAINT "Collection_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Friend Friend_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Friend"
    ADD CONSTRAINT "Friend_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OSMTileValue OSMTileValue_chunk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OSMTileValue"
    ADD CONSTRAINT "OSMTileValue_chunk_id_fkey" FOREIGN KEY (chunk_id) REFERENCES public."OSMTileChunkLite"(id) ON DELETE CASCADE;


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: PlantQuizExcludedDiscovery PlantQuizExcludedDiscovery_discovery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuizExcludedDiscovery"
    ADD CONSTRAINT "PlantQuizExcludedDiscovery_discovery_id_fkey" FOREIGN KEY (discovery_id) REFERENCES public."UserPlantDiscovery"(id) ON DELETE CASCADE;


--
-- Name: PlantQuiz PlantQuiz_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: PlantQuiz PlantQuiz_correct_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_correct_plant_id_fkey" FOREIGN KEY (correct_plant_id) REFERENCES public."Plant"(id) ON DELETE RESTRICT;


--
-- Name: PlantQuiz PlantQuiz_source_discovery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlantQuiz"
    ADD CONSTRAINT "PlantQuiz_source_discovery_id_fkey" FOREIGN KEY (source_discovery_id) REFERENCES public."UserPlantDiscovery"(id) ON DELETE CASCADE;


--
-- Name: PublicProfile PublicProfile_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicProfile"
    ADD CONSTRAINT "PublicProfile_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RasterCellQueryLog RasterCellQueryLog_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RasterCellQueryLog"
    ADD CONSTRAINT "RasterCellQueryLog_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Referral Referral_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rewards Rewards_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public."baseUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rewards Rewards_requires_plant_genus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_requires_plant_genus_id_fkey" FOREIGN KEY (requires_plant_genus_id) REFERENCES public."PlantGenus"(id) ON DELETE SET NULL;


--
-- Name: Rewards Rewards_requires_plant_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rewards"
    ADD CONSTRAINT "Rewards_requires_plant_species_id_fkey" FOREIGN KEY (requires_plant_species_id) REFERENCES public."Plant"(id) ON DELETE SET NULL;


--
-- Name: RobotPlantActiveEffect RobotPlantActiveEffect_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantActiveEffect"
    ADD CONSTRAINT "RobotPlantActiveEffect_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantActiveEffect RobotPlantActiveEffect_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantActiveEffect"
    ADD CONSTRAINT "RobotPlantActiveEffect_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public."RobotPlantShopItem"(id) ON DELETE SET NULL;


--
-- Name: RobotPlantDailyCareAction RobotPlantDailyCareAction_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantDailyCareAction"
    ADD CONSTRAINT "RobotPlantDailyCareAction_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserDailyChallenge RobotPlantUserDailyChallenge_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserDailyChallenge"
    ADD CONSTRAINT "RobotPlantUserDailyChallenge_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES public."RobotPlantDailyChallenge"(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserInventory RobotPlantUserInventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserInventory"
    ADD CONSTRAINT "RobotPlantUserInventory_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public."RobotPlantShopItem"(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantUserZoneState RobotPlantUserZoneState_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantUserZoneState"
    ADD CONSTRAINT "RobotPlantUserZoneState_zone_id_fkey" FOREIGN KEY (zone_id) REFERENCES public."RobotPlantZone"(id) ON DELETE CASCADE;


--
-- Name: RobotPlantWalletLedger RobotPlantWalletLedger_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantWalletLedger"
    ADD CONSTRAINT "RobotPlantWalletLedger_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlantZoneGenerationLog RobotPlantZoneGenerationLog_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlantZoneGenerationLog"
    ADD CONSTRAINT "RobotPlantZoneGenerationLog_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: RobotPlant RobotPlant_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RobotPlant"
    ADD CONSTRAINT "RobotPlant_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ScanLike ScanLike_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScanLike"
    ADD CONSTRAINT "ScanLike_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SharedScan SharedScan_auth_id_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SharedScan"
    ADD CONSTRAINT "SharedScan_auth_id_from_fkey" FOREIGN KEY (auth_id_from) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SharedScan SharedScan_auth_id_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SharedScan"
    ADD CONSTRAINT "SharedScan_auth_id_to_fkey" FOREIGN KEY (auth_id_to) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TileClaim TileClaim_owner_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TileClaim"
    ADD CONSTRAINT "TileClaim_owner_auth_id_fkey" FOREIGN KEY (owner_auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserAchievement UserAchievement_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAchievement"
    ADD CONSTRAINT "UserAchievement_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserCollectionQuest UserCollectionQuest_collection_quest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollectionQuest"
    ADD CONSTRAINT "UserCollectionQuest_collection_quest_id_fkey" FOREIGN KEY (collection_quest_id) REFERENCES public."CollectionQuest"(id) ON DELETE CASCADE;


--
-- Name: UserCollection UserCollection_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserCollection UserCollection_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserCollection"
    ADD CONSTRAINT "UserCollection_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."Collection"(id) ON DELETE CASCADE;


--
-- Name: UserEngagementState UserEngagementState_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEngagementState"
    ADD CONSTRAINT "UserEngagementState_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserMonthlyQuest UserMonthlyQuest_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserMonthlyQuest"
    ADD CONSTRAINT "UserMonthlyQuest_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserNotification UserNotification_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotification"
    ADD CONSTRAINT "UserNotification_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPlantDiscovery UserPlantDiscovery_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPlantDiscovery"
    ADD CONSTRAINT "UserPlantDiscovery_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserQuest UserQuest_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserQuest"
    ADD CONSTRAINT "UserQuest_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserRewards UserRewards_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserRewards"
    ADD CONSTRAINT "UserRewards_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserWalletLedger UserWalletLedger_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWalletLedger"
    ADD CONSTRAINT "UserWalletLedger_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserWallet UserWallet_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: UserWeeklyQuest UserWeeklyQuest_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserWeeklyQuest"
    ADD CONSTRAINT "UserWeeklyQuest_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: baseUser baseuser_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."baseUser"
    ADD CONSTRAINT baseuser_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: Achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Achievements" ENABLE ROW LEVEL SECURITY;

--
-- Name: PublicProfile Allow insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert for authenticated users" ON public."PublicProfile" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: Achievements Authenticated users can read achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read achievements" ON public."Achievements" FOR SELECT TO authenticated USING (true);


--
-- Name: UserAchievement Authenticated users can read all user achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read all user achievements" ON public."UserAchievement" FOR SELECT TO authenticated USING (true);


--
-- Name: PublicProfile Authenticated users can read public profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read public profiles" ON public."PublicProfile" FOR SELECT TO authenticated USING (true);


--
-- Name: Rewards Authenticated users can read rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read rewards" ON public."Rewards" FOR SELECT TO authenticated USING (true);


--
-- Name: ClassroomParticipant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ClassroomParticipant" ENABLE ROW LEVEL SECURITY;

--
-- Name: ClassroomParticipantProgress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ClassroomParticipantProgress" ENABLE ROW LEVEL SECURITY;

--
-- Name: Collection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Collection" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CollectionItem" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CollectionQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: Friend; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Friend" ENABLE ROW LEVEL SECURITY;

--
-- Name: GeoRasterCell; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."GeoRasterCell" ENABLE ROW LEVEL SECURITY;

--
-- Name: LogoAsset; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LogoAsset" ENABLE ROW LEVEL SECURITY;

--
-- Name: MonthlyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MonthlyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: News; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."News" ENABLE ROW LEVEL SECURITY;

--
-- Name: OSMTileChunkLite; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OSMTileChunkLite" ENABLE ROW LEVEL SECURITY;

--
-- Name: OSMTileValue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OSMTileValue" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem Owners manage collection items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage collection items" ON public."CollectionItem" TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND (auth.uid() = c.auth_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND (auth.uid() = c.auth_id)))));


--
-- Name: Collection Owners manage their collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage their collections" ON public."Collection" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: Plant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Plant" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantGenus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantGenus" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantQuiz; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantQuiz" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantQuizExcludedDiscovery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantQuizExcludedDiscovery" ENABLE ROW LEVEL SECURITY;

--
-- Name: PlantQuizSlotRoll; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PlantQuizSlotRoll" ENABLE ROW LEVEL SECURITY;

--
-- Name: PublicProfile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PublicProfile" ENABLE ROW LEVEL SECURITY;

--
-- Name: PublicProfile PublicProfile insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PublicProfile insert own" ON public."PublicProfile" FOR INSERT WITH CHECK ((auth.uid() = auth_id));


--
-- Name: PublicProfile PublicProfile read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PublicProfile read all" ON public."PublicProfile" FOR SELECT USING (true);


--
-- Name: PublicProfile PublicProfile update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PublicProfile update own" ON public."PublicProfile" FOR UPDATE USING ((auth.uid() = auth_id));


--
-- Name: Quest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Quest" ENABLE ROW LEVEL SECURITY;

--
-- Name: RasterCellQueryLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RasterCellQueryLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem Read items of visible collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read items of visible collections" ON public."CollectionItem" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND ((c.is_public = true) OR (auth.uid() = c.auth_id))))));


--
-- Name: Referral; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Referral" ENABLE ROW LEVEL SECURITY;

--
-- Name: Rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Rewards" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlant" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantActiveEffect; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantActiveEffect" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantDailyCareAction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantDailyCareAction" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantDailyChallenge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantDailyChallenge" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantOSMCache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantOSMCache" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantShopItem; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantShopItem" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantUserDailyChallenge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantUserDailyChallenge" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantUserInventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantUserInventory" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantUserZoneState; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantUserZoneState" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantWalletLedger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantWalletLedger" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantZone; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantZone" ENABLE ROW LEVEL SECURITY;

--
-- Name: RobotPlantZoneGenerationLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RobotPlantZoneGenerationLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: ScanLike; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ScanLike" ENABLE ROW LEVEL SECURITY;

--
-- Name: ScanLike ScanLike: authenticated delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ScanLike: authenticated delete own" ON public."ScanLike" FOR DELETE TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: ScanLike ScanLike: authenticated insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ScanLike: authenticated insert own" ON public."ScanLike" FOR INSERT TO authenticated WITH CHECK (((auth_id = auth.uid()) AND (liked_by = auth.email())));


--
-- Name: ScanLike ScanLike: authenticated read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ScanLike: authenticated read all" ON public."ScanLike" FOR SELECT TO authenticated USING (true);


--
-- Name: SharedScan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SharedScan" ENABLE ROW LEVEL SECURITY;

--
-- Name: SharedScan SharedScan insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SharedScan insert own" ON public."SharedScan" FOR INSERT WITH CHECK ((auth.uid() = auth_id_from));


--
-- Name: SharedScan SharedScan read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SharedScan read" ON public."SharedScan" FOR SELECT USING (((auth.uid() = auth_id_from) OR (auth.uid() = auth_id_to)));


--
-- Name: SharedScan SharedScan update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SharedScan update own" ON public."SharedScan" FOR UPDATE USING ((auth.uid() = auth_id_from));


--
-- Name: TileClaim; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TileClaim" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserAchievement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserAchievement" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserCollection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserCollection" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserCollectionQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserCollectionQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserCollectionQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserCollectionQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserEngagementState; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserEngagementState" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserMonthlyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserMonthlyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserMonthlyQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserMonthlyQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserNotification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserNotification" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserPlantDiscovery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserPlantDiscovery" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserRewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserRewards" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWallet" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWalletLedger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWalletLedger" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWeeklyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWeeklyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserWeeklyQuest_backup_2026_02_28; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserWeeklyQuest_backup_2026_02_28" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserNotification Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public."UserNotification" FOR DELETE TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserAchievement Users can insert their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own achievements" ON public."UserAchievement" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserNotification Users can insert their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notifications" ON public."UserNotification" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserAchievement Users can read accepted friends achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read accepted friends achievements" ON public."UserAchievement" FOR SELECT TO authenticated USING ((auth_id IN ( SELECT pp.auth_id
   FROM (public."PublicProfile" pp
     JOIN public."Friend" f ON ((((f.request_sent_by = auth.email()) AND (f.request_sent_to = pp.user_email)) OR ((f.request_sent_to = auth.email()) AND (f.request_sent_by = pp.user_email)))))
  WHERE ((f.status = 'accepted'::text) AND (pp.auth_id IS NOT NULL)))));


--
-- Name: UserAchievement Users can read their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own achievements" ON public."UserAchievement" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserNotification Users can read their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own notifications" ON public."UserNotification" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserRewards Users can read their own rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own rewards" ON public."UserRewards" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: Collection Users can read visible collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read visible collections" ON public."Collection" FOR SELECT TO authenticated USING (((is_public = true) OR (auth.uid() = auth_id)));


--
-- Name: UserAchievement Users can update their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own achievements" ON public."UserAchievement" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserNotification Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public."UserNotification" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserCollection Users manage own collection follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own collection follows" ON public."UserCollection" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserCollection Users read own collection follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own collection follows" ON public."UserCollection" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: WeeklyQuest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."WeeklyQuest" ENABLE ROW LEVEL SECURITY;

--
-- Name: CollectionItem anon_select_public_collection_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select_public_collection_items ON public."CollectionItem" FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public."Collection" c
  WHERE ((c.id = "CollectionItem".collection_id) AND (c.is_public = true)))));


--
-- Name: Collection anon_select_public_collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select_public_collections ON public."Collection" FOR SELECT TO anon USING ((is_public = true));


--
-- Name: Plant authenticated_select_plant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_plant ON public."Plant" FOR SELECT TO authenticated USING (true);


--
-- Name: baseUser; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."baseUser" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserPlantDiscovery discovery_select_local_tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY discovery_select_local_tracking ON public."UserPlantDiscovery" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" pp
  WHERE ((pp.auth_id = "UserPlantDiscovery".auth_id) AND (pp.local_tracking IS NOT FALSE)))));


--
-- Name: Friend friend_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY friend_select_participant ON public."Friend" FOR SELECT TO authenticated USING (((lower(COALESCE(request_sent_by, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (lower(COALESCE(request_sent_to, ''::text)) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: GeoRasterCell geo_raster_cell_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY geo_raster_cell_select_public ON public."GeoRasterCell" FOR SELECT TO authenticated USING ((is_valid = true));


--
-- Name: LogoAsset logo_asset_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logo_asset_select_authenticated ON public."LogoAsset" FOR SELECT TO authenticated USING ((active = true));


--
-- Name: MonthlyQuest monthlyquest_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monthlyquest_select_auth ON public."MonthlyQuest" FOR SELECT TO authenticated USING (true);


--
-- Name: News news_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_delete_admin ON public."News" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text)))));


--
-- Name: News news_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_insert_admin ON public."News" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text)))));


--
-- Name: News news_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_select_auth ON public."News" FOR SELECT TO authenticated USING (true);


--
-- Name: News news_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_select_authenticated ON public."News" FOR SELECT TO authenticated USING (true);


--
-- Name: News news_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_update_admin ON public."News" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile" p
  WHERE ((p.auth_id = auth.uid()) AND (lower(COALESCE(p.role, ''::text)) = 'admin'::text)))));


--
-- Name: RobotPlantOSMCache osm_cache_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY osm_cache_select_public ON public."RobotPlantOSMCache" FOR SELECT TO authenticated USING (true);


--
-- Name: Plant plant_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_delete_admin ON public."Plant" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: Plant plant_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_insert_admin ON public."Plant" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantQuizExcludedDiscovery plant_quiz_excluded_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_quiz_excluded_select_own ON public."PlantQuizExcludedDiscovery" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: PlantQuiz plant_quiz_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_quiz_select_own ON public."PlantQuiz" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: Plant plant_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_select_auth ON public."Plant" FOR SELECT TO authenticated USING (true);


--
-- Name: Plant plant_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_select_authenticated ON public."Plant" FOR SELECT TO authenticated USING (true);


--
-- Name: Plant plant_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plant_update_admin ON public."Plant" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantGenus plantgenus_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_delete_admin ON public."PlantGenus" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantGenus plantgenus_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_insert_admin ON public."PlantGenus" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PlantGenus plantgenus_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_select_all ON public."PlantGenus" FOR SELECT USING (true);


--
-- Name: PlantGenus plantgenus_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_select_auth ON public."PlantGenus" FOR SELECT TO authenticated USING (true);


--
-- Name: PlantGenus plantgenus_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_select_authenticated ON public."PlantGenus" FOR SELECT TO authenticated USING (true);


--
-- Name: PlantGenus plantgenus_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plantgenus_update_admin ON public."PlantGenus" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile"
  WHERE (("PublicProfile".auth_id = auth.uid()) AND ("PublicProfile".role = 'admin'::text)))));


--
-- Name: PublicProfile publicprofile_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY publicprofile_select_auth ON public."PublicProfile" FOR SELECT TO authenticated USING (true);


--
-- Name: Quest quest_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quest_select_auth ON public."Quest" FOR SELECT TO authenticated USING (true);


--
-- Name: RasterCellQueryLog raster_query_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY raster_query_log_select_own ON public."RasterCellQueryLog" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserPlantDiscovery read_own_and_friends_discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_own_and_friends_discoveries ON public."UserPlantDiscovery" FOR SELECT USING (((auth.uid() = auth_id) OR (EXISTS ( WITH current_user_email AS (
         SELECT lower(pp.user_email) AS email
           FROM public."PublicProfile" pp
          WHERE (pp.auth_id = auth.uid())
         LIMIT 1
        ), discovery_owner_email AS (
         SELECT lower(pp.user_email) AS email
           FROM public."PublicProfile" pp
          WHERE (pp.auth_id = "UserPlantDiscovery".auth_id)
         LIMIT 1
        )
 SELECT 1
   FROM ((current_user_email cue
     JOIN discovery_owner_email doe ON (true))
     JOIN public."Friend" f ON ((((lower(f.request_sent_by) = cue.email) AND (lower(f.request_sent_to) = doe.email)) OR ((lower(f.request_sent_by) = doe.email) AND (lower(f.request_sent_to) = cue.email)))))
  WHERE (f.status = 'accepted'::text)))));


--
-- Name: RobotPlantDailyCareAction robotplant_dailycare_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_dailycare_manage_own ON public."RobotPlantDailyCareAction" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantDailyCareAction robotplant_dailycare_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_dailycare_select_own ON public."RobotPlantDailyCareAction" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantDailyChallenge robotplant_dailychallenge_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_dailychallenge_select_active ON public."RobotPlantDailyChallenge" FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: RobotPlantActiveEffect robotplant_effect_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_effect_manage_own ON public."RobotPlantActiveEffect" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantActiveEffect robotplant_effect_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_effect_select_own ON public."RobotPlantActiveEffect" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlant robotplant_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_insert_own ON public."RobotPlant" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserInventory robotplant_inventory_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_inventory_manage_own ON public."RobotPlantUserInventory" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserInventory robotplant_inventory_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_inventory_select_own ON public."RobotPlantUserInventory" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantWalletLedger robotplant_ledger_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_ledger_select_own ON public."RobotPlantWalletLedger" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlant robotplant_select_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_select_authenticated_all ON public."RobotPlant" FOR SELECT TO authenticated USING (true);


--
-- Name: RobotPlant robotplant_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_select_own ON public."RobotPlant" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantShopItem robotplant_shopitem_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_shopitem_select_active ON public."RobotPlantShopItem" FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: RobotPlant robotplant_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_update_own ON public."RobotPlant" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserDailyChallenge robotplant_userdaily_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userdaily_manage_own ON public."RobotPlantUserDailyChallenge" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserDailyChallenge robotplant_userdaily_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userdaily_select_own ON public."RobotPlantUserDailyChallenge" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserZoneState robotplant_userzonestate_manage_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userzonestate_manage_own ON public."RobotPlantUserZoneState" TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: RobotPlantUserZoneState robotplant_userzonestate_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY robotplant_userzonestate_select_own ON public."RobotPlantUserZoneState" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: ScanLike scanlike_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scanlike_select_auth ON public."ScanLike" FOR SELECT TO authenticated USING (true);


--
-- Name: UserRewards select_own_user_rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_own_user_rewards ON public."UserRewards" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: TileClaim tileclaim_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tileclaim_admin_manage ON public."TileClaim" TO authenticated USING ((EXISTS ( SELECT 1
   FROM public."PublicProfile" pp
  WHERE ((pp.auth_id = auth.uid()) AND (pp.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public."PublicProfile" pp
  WHERE ((pp.auth_id = auth.uid()) AND (pp.role = 'admin'::text)))));


--
-- Name: TileClaim tileclaim_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tileclaim_select_authenticated ON public."TileClaim" FOR SELECT TO authenticated USING (true);


--
-- Name: UserEngagementState userengagement_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userengagement_select_own ON public."UserEngagementState" FOR SELECT USING ((auth.uid() = auth_id));


--
-- Name: UserMonthlyQuest usermonthlyquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usermonthlyquest_select_own ON public."UserMonthlyQuest" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserPlantDiscovery userplantdiscovery_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userplantdiscovery_select_own ON public."UserPlantDiscovery" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_delete_own ON public."UserQuest" FOR DELETE TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserMonthlyQuest userquest_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_insert_own ON public."UserMonthlyQuest" FOR INSERT WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_insert_own ON public."UserQuest" FOR INSERT TO authenticated WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserWeeklyQuest userquest_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_insert_own ON public."UserWeeklyQuest" FOR INSERT WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserMonthlyQuest userquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_select_own ON public."UserMonthlyQuest" FOR SELECT USING ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_select_own ON public."UserQuest" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: UserWeeklyQuest userquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_select_own ON public."UserWeeklyQuest" FOR SELECT USING ((auth_id = auth.uid()));


--
-- Name: UserMonthlyQuest userquest_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_update_own ON public."UserMonthlyQuest" FOR UPDATE USING ((auth_id = auth.uid())) WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserQuest userquest_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_update_own ON public."UserQuest" FOR UPDATE TO authenticated USING ((auth_id = auth.uid())) WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserWeeklyQuest userquest_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userquest_update_own ON public."UserWeeklyQuest" FOR UPDATE USING ((auth_id = auth.uid())) WITH CHECK ((auth_id = auth.uid()));


--
-- Name: UserPlantDiscovery users can delete own discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete own discoveries" ON public."UserPlantDiscovery" FOR DELETE TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: UserPlantDiscovery users can insert own discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert own discoveries" ON public."UserPlantDiscovery" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserPlantDiscovery users can update own discoveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update own discoveries" ON public."UserPlantDiscovery" FOR UPDATE TO authenticated USING ((auth.uid() = auth_id)) WITH CHECK ((auth.uid() = auth_id));


--
-- Name: UserWallet userwallet_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userwallet_select_own ON public."UserWallet" FOR SELECT USING ((auth.uid() = auth_id));


--
-- Name: UserWalletLedger userwalletledger_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userwalletledger_select_own ON public."UserWalletLedger" FOR SELECT USING ((auth.uid() = auth_id));


--
-- Name: UserWeeklyQuest userweeklyquest_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY userweeklyquest_select_own ON public."UserWeeklyQuest" FOR SELECT TO authenticated USING ((auth_id = auth.uid()));


--
-- Name: WeeklyQuest weeklyquest_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weeklyquest_select_auth ON public."WeeklyQuest" FOR SELECT TO authenticated USING (true);


--
-- Name: RobotPlantZoneGenerationLog zone_gen_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zone_gen_log_select_own ON public."RobotPlantZoneGenerationLog" FOR SELECT TO authenticated USING ((auth.uid() = auth_id));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects auth users can read from UserPlantScans; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "auth users can read from UserPlantScans" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'UserPlantScans'::text));


--
-- Name: objects auth users can upload to UserPlantScans; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "auth users can upload to UserPlantScans" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'UserPlantScans'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: ensure_rls; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION public.rls_auto_enable();


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict BeYtOiH1DY3tmzvhy8MZ47UGYZZC3JG0pI2EGIXeWCiX2bhIwwWDBtyHQgE2b8K


-- Run against an isolated local/test database after the guest funnel migration.
-- Never use real account IDs. Every test mutation is rolled back.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'guest-funnel-test@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'guest-funnel-other@example.invalid');
insert into public.guest_scan (id, token_hash, status, paths, selected_plant, feedback)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'confirmed',
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/photo.jpg'],
  '{"species_name":"Testpflanze","scientific_name":"Testus floralogus","scientific_genus":"Testus","genus_name":"Test","category":"Blumen","rarity":"Häufig"}',
  '{"rewardDetails":{"eventSource":"new_scan","finalReward":60}}');

do $$
declare claimed jsonb; repeated jsonb; balance integer; discovery_count integer;
begin
  claimed := public.claim_guest_scan(repeat('a',64), '11111111-1111-4111-8111-111111111111', array['https://example.invalid/photo.jpg']);
  repeated := public.claim_guest_scan(repeat('a',64), '11111111-1111-4111-8111-111111111111', array['https://example.invalid/photo.jpg']);
  if claimed->>'discoveryId' is distinct from repeated->>'discoveryId' then raise exception 'Replay created another discovery'; end if;
  if repeated->>'alreadyClaimed' <> 'true' then raise exception 'Replay was not recognized'; end if;
  select wallet_balance into balance from public."RobotPlant" where auth_id = '11111111-1111-4111-8111-111111111111';
  if balance <> 60 then raise exception 'Expected exactly 60 seeds, got %', balance; end if;
  select count(*) into discovery_count from public."UserPlantDiscovery" where auth_id = '11111111-1111-4111-8111-111111111111';
  if discovery_count <> 1 then raise exception 'Expected exactly one discovery'; end if;
  if not exists (select 1 from public."UserStory" where auth_id = '11111111-1111-4111-8111-111111111111' and intro_seen) then raise exception 'Intro was not migrated'; end if;
  begin
    perform public.claim_guest_scan(repeat('a',64), '22222222-2222-4222-8222-222222222222', array['https://example.invalid/photo.jpg']);
    raise exception 'Foreign claim unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm = 'Foreign claim unexpectedly allowed' then raise; end if;
  end;
end;
$$;

insert into public.guest_scan (token_hash, status, paths, selected_plant, feedback)
select repeat('b',64), 'confirmed', paths, selected_plant, feedback from public.guest_scan where token_hash=repeat('a',64);
do $$
begin
  begin
    perform public.claim_guest_scan(repeat('b',64), '11111111-1111-4111-8111-111111111111', array['https://example.invalid/photo.jpg']);
    raise exception 'Second guest reward unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm = 'Second guest reward unexpectedly allowed' then raise; end if;
  end;
  update public.guest_scan set expires_at = now() - interval '1 second' where token_hash=repeat('b',64);
  begin
    perform public.claim_guest_scan(repeat('b',64), '22222222-2222-4222-8222-222222222222', array['https://example.invalid/photo.jpg']);
    raise exception 'Expired claim unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm = 'Expired claim unexpectedly allowed' then raise; end if;
  end;
  if has_function_privilege('anon', 'public.claim_guest_scan(text,uuid,text[])', 'execute')
    or has_function_privilege('authenticated', 'public.claim_guest_scan(text,uuid,text[])', 'execute')
    or has_table_privilege('anon', 'public.guest_scan', 'select')
    or has_table_privilege('authenticated', 'public.guest_scan', 'update')
  then raise exception 'Guest receipt permissions are too broad'; end if;
  if not public.guest_scan_take_rate('test',2) or not public.guest_scan_take_rate('test',2)
    or public.guest_scan_take_rate('test',2) then raise exception 'Rate limit not enforced'; end if;
end;
$$;
rollback;
\echo 'Guest claim tests passed: one discovery, exact reward, replay, foreign owner, second reward, expiry, permissions and rate limits.'

-- Guest receipts are capabilities, not anonymous Auth users. Only the Edge
-- Function's service client can access these tables or invoke these RPCs.
create table public.guest_scan (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  status text not null default 'open'
    check (status in ('open', 'identifying', 'identified', 'confirmed', 'claimed')),
  attempts integer not null default 0 check (attempts between 0 and 4),
  uploads integer not null default 0 check (uploads between 0 and 20),
  paths text[] not null default '{}',
  results jsonb not null default '[]',
  selected_plant jsonb,
  feedback jsonb,
  discovery_location text,
  confirmed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  discovery_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index guest_scan_expiry_idx on public.guest_scan (expires_at);
create index guest_scan_claimed_by_idx on public.guest_scan (claimed_by) where claimed_by is not null;
alter table public.guest_scan enable row level security;
revoke all on public.guest_scan from public, anon, authenticated;
grant all on public.guest_scan to service_role;

create table public.guest_scan_rate (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
alter table public.guest_scan_rate enable row level security;
revoke all on public.guest_scan_rate from public, anon, authenticated;
grant all on public.guest_scan_rate to service_role;

create function public.guest_scan_take_rate(p_key text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare v_count integer;
begin
  insert into public.guest_scan_rate as r (key, window_start, count)
  values (p_key, date_trunc('day', now()), 1)
  on conflict (key) do update set
    window_start = excluded.window_start,
    count = case when r.window_start = excluded.window_start then r.count + 1 else 1 end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.guest_scan_take_rate(text, integer) from public, anon, authenticated;
grant execute on function public.guest_scan_take_rate(text, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('guest-scans', 'guest-scans', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('guest-discoveries', 'guest-discoveries', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Called with a verified user id by guestScan only. All mutations (including
-- existing discovery triggers and reward ledgers) share one transaction.
create function public.claim_guest_scan(p_token_hash text, p_auth_id uuid, p_image_urls text[])
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  receipt public.guest_scan%rowtype;
  plant_row public."Plant"%rowtype;
  genus_row public."PlantGenus"%rowtype;
  selected jsonb;
  user_email text;
  new_discovery_id text;
  grant_result record;
  v_category text;
begin
  if p_auth_id is null then raise exception 'Authenticated user required'; end if;
  select * into receipt from public.guest_scan where token_hash = p_token_hash for update;
  if receipt.id is null then raise exception 'Guest scan not found'; end if;
  if receipt.status = 'claimed' then
    if receipt.claimed_by is distinct from p_auth_id then raise exception 'Guest scan already claimed'; end if;
    return jsonb_build_object('discoveryId', receipt.discovery_id, 'alreadyClaimed', true);
  end if;
  if receipt.status <> 'confirmed' or receipt.expires_at <= now() then
    raise exception 'Guest scan not ready or expired';
  end if;
  -- One guest reward per account, even if a visitor obtains several tokens.
  perform pg_advisory_xact_lock(hashtextextended('guest-claim:' || p_auth_id::text, 0));
  if exists (select 1 from public.guest_scan where claimed_by = p_auth_id and status = 'claimed') then
    raise exception 'This account has already claimed a guest scan';
  end if;
  if cardinality(p_image_urls) <> cardinality(receipt.paths) or cardinality(p_image_urls) = 0 then
    raise exception 'Missing scan images';
  end if;
  select email into user_email from auth.users where id = p_auth_id;
  if user_email is null then raise exception 'Account not found'; end if;
  selected := receipt.selected_plant;
  -- Serializes the uncommon new-global-plant path with other guest claims.
  perform pg_advisory_xact_lock(hashtextextended('guest-plant-catalog', 0));
  select * into plant_row from public."Plant"
  where lower(scientific_name) = lower(selected->>'scientific_name')
  order by id limit 1;
  if plant_row.id is null then
    v_category := coalesce(selected->>'category', 'Blumen');
    select * into genus_row from public."PlantGenus"
    where lower(scientific_genus) = lower(selected->>'scientific_genus')
    order by id limit 1;
    if genus_row.id is null then
      insert into public."PlantGenus" (id, genus_name, scientific_genus, category, category_dex_number, family)
      select encode(extensions.gen_random_bytes(12), 'hex'),
        selected->>'genus_name', selected->>'scientific_genus', v_category,
        coalesce(max(category_dex_number), 0) + 1, selected->>'family'
      from public."PlantGenus" where category = v_category
      returning * into genus_row;
    end if;
    insert into public."Plant" (
      id, genus_category, genus_number, species_name, scientific_name, description,
      identification_features, fun_fact, rarity, native_region, created_by_id,
      wild_bees_count, butterflies_count, caterpillars_count, hoverflies_count,
      beetles_count, red_list_threat, red_list_population, nectar_value, pollen_value, naturadb_url
    ) values (
      encode(extensions.gen_random_bytes(12), 'hex'), genus_row.category, genus_row.category_dex_number,
      selected->>'species_name', selected->>'scientific_name', selected->>'description',
      selected->>'identification_features', selected->>'fun_fact', selected->>'rarity',
      selected->>'native_region', p_auth_id::text,
      (selected->>'wild_bees_count')::integer, (selected->>'butterflies_count')::integer,
      (selected->>'caterpillars_count')::integer, (selected->>'hoverflies_count')::integer,
      (selected->>'beetles_count')::integer, selected->>'red_list_threat',
      selected->>'red_list_population', selected->>'nectar_value', selected->>'pollen_value', selected->>'naturadb_url'
    ) returning * into plant_row;
  end if;
  insert into public."UserPlantDiscovery" (
    auth_id, created_by_id, created_by, plant_id, discovered_date,
    discovery_location, discovery_notes, image_url, additional_image_urls
  ) values (
    p_auth_id, p_auth_id::text, user_email, plant_row.id, now(),
    receipt.discovery_location, '', p_image_urls[1], p_image_urls[2:cardinality(p_image_urls)]
  ) returning id into new_discovery_id;

  select * into grant_result from public.robot_plant_grant_reward(
    p_auth_id, receipt.feedback->'rewardDetails'->>'eventSource', new_discovery_id,
    (receipt.feedback->'rewardDetails'->>'finalReward')::integer,
    0, 0, 0, jsonb_build_object('guest_scan_id', receipt.id, 'reward_breakdown', receipt.feedback->'rewardDetails')
  );
  if not grant_result.applied then raise exception 'Guest reward was not applied'; end if;
  perform public.ensure_user_story_row(p_auth_id, 'v1');
  update public."UserStory" set intro_seen = true, intro_seen_at = coalesce(intro_seen_at, now())
    where auth_id = p_auth_id;
  update public.guest_scan set status = 'claimed', claimed_by = p_auth_id,
    discovery_id = new_discovery_id, updated_at = now()
    where id = receipt.id;
  return jsonb_build_object('discoveryId', new_discovery_id, 'reward', receipt.feedback->'rewardDetails'->'finalReward');
end;
$$;
revoke all on function public.claim_guest_scan(text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.claim_guest_scan(text, uuid, text[]) to service_role;
-- Geo-Tracking audit for Pia
-- Account: 881d8429-4ca0-4245-a7af-02fafd77df63

-- Block 1: Overall geo quality summary for Pia's scans
select
  count(*) as scans_total,
  count(*) filter (where discovery_location is not null and trim(discovery_location) <> '') as scans_with_location,
  count(*) filter (
    where discovery_location ~ '^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$'
  ) as scans_parseable,
  count(*) filter (
    where discovery_location ~ '^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$'
      and split_part(discovery_location, ',', 1)::double precision between -90 and 90
      and split_part(discovery_location, ',', 2)::double precision between -180 and 180
  ) as scans_geo_valid
from public."UserPlantDiscovery"
where auth_id = '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid;

-- Block 2: List problematic scan rows (missing/invalid geo)
select
  id,
  discovered_date,
  discovery_location
from public."UserPlantDiscovery"
where auth_id = '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid
  and (
    discovery_location is null
    or trim(discovery_location) = ''
    or discovery_location !~ '^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$'
    or split_part(discovery_location, ',', 1)::double precision not between -90 and 90
    or split_part(discovery_location, ',', 2)::double precision not between -180 and 180
  )
order by discovered_date asc nulls last;

-- Block 3: Ledger-to-discovery match for scan rewards and geo presence
select
  l.id as ledger_id,
  l.event_source,
  l.event_reference as discovery_id,
  l.amount,
  d.discovered_date,
  d.discovery_location,
  case
    when d.id is null then 'MISSING_DISCOVERY'
    when d.discovery_location is null or trim(d.discovery_location) = '' then 'NO_LOCATION'
    else 'OK'
  end as status
from public."RobotPlantWalletLedger" l
left join public."UserPlantDiscovery" d
  on d.id::text = l.event_reference
where l.auth_id = '881d8429-4ca0-4245-a7af-02fafd77df63'::uuid
  and l.currency_code = 'seed'
  and l.event_source in ('scan', 'new_scan', 'new_global_scan')
order by l.created_at asc;

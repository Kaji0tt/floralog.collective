-- Zones may now require 3, 4, or 5 scans to complete (randomized per zone at generation time).
-- Existing zones keep the previous fixed threshold of 5 via the column default.
alter table public."RobotPlantZone"
  add column if not exists required_scan_count integer not null default 5
    check (required_scan_count between 3 and 5);

notify pgrst, 'reload schema';

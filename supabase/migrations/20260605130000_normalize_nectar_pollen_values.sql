-- Normalize legacy NaturaDB quarter values in Plant ecology fields.
-- Keeps only numeric quarter score (x/4). Non-matching values are set to NULL.

update public."Plant"
set
  nectar_value = case
    when nectar_value is null then null
    when nectar_value ~ '([0-4])\s*/\s*4' then regexp_replace(nectar_value, '.*?([0-4])\s*/\s*4.*', '\1/4')
    else null
  end,
  pollen_value = case
    when pollen_value is null then null
    when pollen_value ~ '([0-4])\s*/\s*4' then regexp_replace(pollen_value, '.*?([0-4])\s*/\s*4.*', '\1/4')
    else null
  end
where
  nectar_value is not null
  or pollen_value is not null;

-- Safety pass: force any remaining non-conforming values to NULL.
update public."Plant"
set
  nectar_value = case
    when nectar_value ~ '^[0-4]/4$' then nectar_value
    else null
  end,
  pollen_value = case
    when pollen_value ~ '^[0-4]/4$' then pollen_value
    else null
  end
where
  (nectar_value is not null and nectar_value !~ '^[0-4]/4$')
  or (pollen_value is not null and pollen_value !~ '^[0-4]/4$');

-- Enforce clean format moving forward (nullable or x/4).
alter table public."Plant"
  drop constraint if exists plant_nectar_value_quarter_check;

alter table public."Plant"
  drop constraint if exists plant_pollen_value_quarter_check;

alter table public."Plant"
  add constraint plant_nectar_value_quarter_check
  check (nectar_value is null or nectar_value ~ '^[0-4]/4$') not valid;

alter table public."Plant"
  add constraint plant_pollen_value_quarter_check
  check (pollen_value is null or pollen_value ~ '^[0-4]/4$') not valid;

-- Validate constraints after cleanup.
alter table public."Plant" validate constraint plant_nectar_value_quarter_check;
alter table public."Plant" validate constraint plant_pollen_value_quarter_check;

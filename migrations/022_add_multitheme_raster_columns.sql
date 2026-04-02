-- 022_add_multitheme_raster_columns.sql
-- Add support for mixed-theme cells and per-theme anchor points.

alter table public."GeoRasterCell"
  add column if not exists theme_scores jsonb not null default '{}'::jsonb,
  add column if not exists theme_anchor_points jsonb not null default '{}'::jsonb;

-- Backfill existing rows so legacy data remains usable immediately.
update public."GeoRasterCell"
set
  theme_scores = case
    when coalesce(theme_scores, '{}'::jsonb) = '{}'::jsonb
      then jsonb_build_object(theme, greatest(theme_confidence::numeric, 0.10))
    else theme_scores
  end,
  theme_anchor_points = case
    when coalesce(theme_anchor_points, '{}'::jsonb) = '{}'::jsonb
      then jsonb_build_object(
        theme,
        jsonb_build_object('lat', center_lat, 'lng', center_lng)
      )
    else theme_anchor_points
  end;

create index if not exists idx_geo_raster_theme_scores
  on public."GeoRasterCell" using gin (theme_scores);
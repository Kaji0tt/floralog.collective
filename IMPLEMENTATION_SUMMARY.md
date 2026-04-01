# Raster-Grid Implementation Summary

## What Changed

### 1. **Database Schema** (`migrations/021_create_geo_raster_grid.sql`)
- Created `GeoRasterCell` table: stores 0.5km² grid cells with OSM-derived theme classification
- Created `RasterCellQueryLog` table: tracks query performance metrics
- Added spatial indexes and RLS policies for fast, secure queries

### 2. **Runtime Function** (`supabase/functions/robotPlantDailyZones/index.ts`)

**Old approach:**
- Made 4 live Overpass API calls per request (2500m radius)
- Risk of timeout, rate limits, network failures
- Variable response time: 2-30+ seconds (or timeout)

**New approach:**
- Queries pre-computed `GeoRasterCell` table from database
- Fast, predictable: <100ms guaranteed
- No external API dependencies during runtime

**Key changes:**
```typescript
// OLD:
const candidates = await queryOverpassForTheme(lat, lng, radiusM, theme);

// NEW:
const rasterCells = await adminClient
  .from("GeoRasterCell")
  .select("...")
  .or(gridConditions)
  .eq("is_valid", true);
```

### 3. **Data Initialization** (`supabase/functions/initializeGeoRasterGrid/index.ts`)
- New function to populate the raster grid
- Queries Overpass API **once per region** (offline initialization)
- Classifies cells based on dominant OSM tags
- Upserts into `GeoRasterCell` table

### 4. **Configuration** (`supabase/config.toml`)
- Registered new `initializeGeoRasterGrid` function

## Implementation Details

### Grid System
- **Cell size:** ~0.5km² (707m per side)
- **Grid resolution:** 0.00636° per cell
- **Coordinate system:** Degree-based (latitude/longitude indices)
- **Indexing:** `grid_id = "{lat_idx}_{lng_idx}"` (unique)

### Zone Selection Algorithm
1. Calculate grid cells within 5km radius of user
2. Query all valid cells from database
3. Group cells by theme (forest, water, urban, meadow)
4. Sort by distance (nearest = best)
5. Select 1 zone per theme
6. Check for overlaps (min separation = radius₁ + radius₂)
7. Return 3-4 non-overlapping zones

### Classification Logic
```javascript
// OSM tags → Theme + Confidence

natural=forest → forest (0.9)
landuse=forest → forest (0.9)

natural=water → water (0.9)
waterway=* → water (0.9)

landuse=residential → urban (0.88)
landuse=commercial → urban (0.88)

leisure=park → meadow (0.85)
natural=meadow → meadow (0.85)
```

## What Stays the Same

✅ Frontend: No changes needed
✅ API response format: Identical to old system
✅ Cache strategy: Same (24h per day)
✅ `RobotPlantZone` table: Still used for storing generated zones
✅ User experience: Faster, more reliable zones

## How to Deploy

### Step 1: Database Migration
```bash
supabase migration up
```
Or if using hosted Supabase, run migration manually via dashboard.

### Step 2: Deploy Functions
```bash
npx supabase functions deploy robotPlantDailyZones
npx supabase functions deploy initializeGeoRasterGrid
```

### Step 3: Set Environment Variables
In Supabase project settings, add:
```
ADMIN_SECRET=<random-secure-string>
```

### Step 4: Initialize Raster Grid
```bash
# Option A: Use the provided script
bash scripts/init-raster-grid-kiel.sh

# Option B: Manual curl
curl -X POST https://PROJECT.supabase.co/functions/v1/initializeGeoRasterGrid \
  -H "Content-Type: application/json" \
  -d '{
    "bounds": {"north": 54.5, "south": 54.15, "east": 10.35, "west": 9.9},
    "adminKey": "YOUR_ADMIN_SECRET",
    "forceRefresh": false
  }'
```

## Testing Checklist

- [ ] Migration deployed successfully
- [ ] Both functions deployed without errors
- [ ] `GeoRasterCell` table has data (>100 rows)
- [ ] Open map in app, click "Standort ermitteln"
- [ ] Zones appear within 1-2 seconds
- [ ] Console logs show `rasterBased: true` and `queryDurationMs: <100`
- [ ] Check `RasterCellQueryLog` for metrics

## Performance Expectations

| Metric | Value |
|--------|-------|
| Database query (grid cells) | 10-30ms |
| Zone selection algorithm | 5-15ms |
| Total request time | **<100ms** |
| Consistency | 100% (no timeouts) |
| Availability | Depends on DB uptime only |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No geo-raster data available" | Run `initializeGeoRasterGrid` for your region |
| Zones always the same theme | Re-init with `forceRefresh: true` |
| Query takes >100ms | Check DB indexes, RLS policies |
| Old zones still appearing | Check if cache is >24h old |

## Future Improvements

1. **Multi-region support:** Extend grid to cover larger areas
2. **Zone quality metrics:** Track which zones are most frequently visited
3. **Dynamic confidence:** Adjust classification based on user feedback
4. **Geometry support:** Store actual polygon boundaries from OSM (PostGIS)
5. **Incremental updates:** Only refresh cells with stale OSM data

## Files Modified/Created

```
migrations/
  021_create_geo_raster_grid.sql (NEW)

supabase/functions/
  initializeGeoRasterGrid/
    index.ts (NEW)
  robotPlantDailyZones/
    index.ts (UPDATED)

supabase/
  config.toml (UPDATED)

scripts/
  init-raster-grid-kiel.sh (NEW)

docs/
  RASTER_GRID_GUIDE.md (NEW)
```

## References

- **OSM Data:** https://www.openstreetmap.org/
- **Overpass API:** https://overpass-api.de/
- **PostGIS (future):** https://postgis.net/
- **Grid concept:** Based on H3 hexagonal grids (simplified square version)

# Raster-Grid Implementation Summary

⚠️ **DEPRECATED: This document describes the old GeoRasterCell system (April 2026 or earlier).**

The system has been completely migrated to **slim OSM database architecture** (OSMTileChunkLite + OSMTileValue).
See [OSM_TILES_SLIM_GUIDE.md](OSM_TILES_SLIM_GUIDE.md) for current implementation details.

---

## What Changed (DEPRECATED - Historical Reference Only)

### 1. **Database Schema** (`migrations/021_create_geo_raster_grid.sql`) - DEPRECATED
- Created ~~`GeoRasterCell`~~ table: stores 0.5km² grid cells with OSM-derived theme classification (REPLACED)
- Created ~~`RasterCellQueryLog`~~ table: tracks query performance metrics (NO LONGER NEEDED)
- Added spatial indexes and RLS policies for fast, secure queries (REPLACED)

### 2. **Runtime Function** (`supabase/functions/robotPlantDailyZones/index.ts`) - DEPRECATED APPROACH REPLACED

**Old approach (DEPRECATED):**
- Made 4 live Overpass API calls per request (2500m radius)
- Risk of timeout, rate limits, network failures
- Variable response time: 2-30+ seconds (or timeout)
- Used pre-computed `GeoRasterCell` table from database

**Current approach (slim OSM, April 2026+):**
- Queries pre-computed `OSMTileChunkLite` + `OSMTileValue` tables
- Uses EPSG:3035 projection (meter-based grid)
- 100m tile resolution with 10×10 chunk grouping
- Fast, predictable: <100ms typical for 3.5km radius
- No grid cell manipulation or on-demand initialization

**Key changes:**
```typescript
// OLD (GeoRasterCell):
const rasterCells = await adminClient
  .from("GeoRasterCell")
  .select("...")
  .or(gridConditions)
  .eq("is_valid", true);

// NEW (slim OSM):
const { data: chunkRows } = await adminClient
  .from("OSMTileChunkLite")
  .select("id, chunk_x, chunk_y, tile_count")
  .eq("dataset_version", DATASET_VERSION)
  .gte("chunk_x", minChunkX)
  .lte("chunk_x", maxChunkX);
```

### 3. **Data Initialization** (`supabase/functions/initializeGeoRasterGrid/index.ts`) - DEPRECATED
- Function to populate the raster grid (NO LONGER USED)
- Was: Queries Overpass API **once per region** (offline initialization)
- Was: Classifies cells based on dominant OSM tags
- Was: Upserts into ~~`GeoRasterCell`~~ table (REPLACED by bulk OSM data import)

### 4. **Data Pipeline** (current, slim OSM)
- `data/pipeline/build_osm_tiles_slim.py`: Extracts tile zones from PostGIS database
- `data/pipeline/upload_osm_tiles_slim.py`: Bulk imports to OSMTileChunkLite + OSMTileValue
- Dataset: Pre-computed Germany OSM data (osm_de_2026_04_10)

### 5. **Configuration** (`supabase/config.toml`)
- Registered functions: `robotPlantDailyZones` (active), ~~`initializeGeoRasterGrid`~~ (DEPRECATED)

## Implementation Details (DEPRECATED - Historical Reference)

### Old Grid System (GeoRasterCell) - DEPRECATED
- **Cell size:** ~0.5km² (707m per side)
- **Grid resolution:** 0.00636° per cell
- **Coordinate system:** Degree-based (latitude/longitude indices)
- **Indexing:** `grid_id = "{lat_idx}_{lng_idx}"` (unique)

### Old Zone Selection Algorithm (DEPRECATED)
1. Calculate grid cells within 5km radius of user
2. Query all valid cells from database
3. Group cells by theme (forest, water, urban, meadow)
4. Sort by distance (nearest = best)
5. Select 1 zone per theme
6. Check for overlaps (min separation = radius₁ + radius₂)
7. Return 3-4 non-overlapping zones

### Old Classification Logic (DEPRECATED)
```javascript
// OSM tags → Theme + Confidence (GeoRasterCell - no longer used)

natural=forest → forest (0.9)
landuse=forest → forest (0.9)

natural=water → water (0.9)
waterway=* → water (0.9)

landuse=residential → urban (0.88)
landuse=commercial → urban (0.88)

leisure=park → meadow (0.85)
natural=meadow → meadow (0.85)
```

### Current System (slim OSM)
See [OSM_TILES_SLIM_GUIDE.md](OSM_TILES_SLIM_GUIDE.md) for:
- Tile grid architecture (100m × 100m tiles, 10×10 chunk grouping)
- EPSG:3035 coordinate transformation
- Zone type enumeration (0-5: forest, water, meadow, urban, beach, wetlands)
- Query patterns and performance characteristics

## What Stays the Same

✅ Frontend: No changes needed
✅ API response format: Identical to old system
✅ Cache strategy: Same (24h per day)
✅ `RobotPlantZone` table: Still used for storing generated zones
✅ User experience: Faster, more reliable zones

## Deployment (DEPRECATED - Historic Reference)

⚠️ The following steps were used with the old GeoRasterCell system. They are **no longer needed** with the slim OSM architecture.

For current deployment, see [OSM_TILES_SLIM_GUIDE.md](OSM_TILES_SLIM_GUIDE.md).

### Old Step 1: Database Migration (DEPRECATED)
```bash
supabase migration up
```

### Old Step 2: Deploy Functions (DEPRECATED)
```bash
npx supabase functions deploy robotPlantDailyZones  # Still needed, but new implementation
# DO NOT DEPLOY: initializeGeoRasterGrid (no longer used)
```

### Old Step 3: Environment Variables (DEPRECATED)
```
ADMIN_SECRET=<random-secure-string>  # No longer needed
```

### Old Step 4: Initialize Raster Grid (DEPRECATED - DO NOT RUN)
```bash
# DO NOT RUN - this function is deprecated
curl -X POST https://PROJECT.supabase.co/functions/v1/initializeGeoRasterGrid \
  ...
```

## Testing Checklist (DEPRECATED)

- ❌ ~~Migration deployed successfully~~ (no longer needed)
- ✅ `robotPlantDailyZones` deployed with new slim OSM implementation
- ❌ ~~`GeoRasterCell` table has data~~ (replaced by OSMTileChunkLite/OSMTileValue)
- ✅ Open map in app, click "Standort ermitteln"
- ✅ Zones appear within 1-2 seconds (typically <100ms)
- ✅ Check console logs for `osmSlimBased: true`
- ❌ ~~Check `RasterCellQueryLog`~~ (no longer exists)

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

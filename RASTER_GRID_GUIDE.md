# Raster-basierte Geo-Klassifikation – Setup & Migration Guide

## Überblick

Das neue System ersetzt die problematischen **Live-Overpass-API-Calls** durch eine **vorberechnete Raster-Struktur mit 0,5km²-Zellen**. Dies eliminiert sämtliche Fehlerquellen (Timeouts, Rate Limits, Netzwerkfehler) und garantiert <100ms Antwortzeiten.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  GeoRasterCell Table (Pre-computed, Persistent)             │
│  ─ 0.5km² cells (~707m per side)                            │
│  ─ grid_lat_idx, grid_lng_idx (unique)                      │
│  ─ theme: forest | water | urban | meadow                   │
│  ─ theme_confidence: 0.0 - 1.0                              │
│  ─ dominant_osm_tags: Tags that define the cell             │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
    ┌──────────────────────┴──────────────────────┐
    │  Offline Data Preparation (One-time)        │
    │  initializeGeoRasterGrid Function           │
    │  - Query OSM data from Overpass             │
    │  - Classify cells by dominant tags          │
    │  - Insert into GeoRasterCell table          │
    └─────────────────────────────────────────────┘
                           ▲
                           │
    ┌──────────────────────┴──────────────────────┐
    │  OpenStreetMap Data (Public)                │
    │  Overpass API (24h cache recommended)       │
    └─────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Runtime: robotPlantDailyZones Function (Fast)              │
│  ─ User sends location (lat, lng)                           │
│  ─ Calculate affected grid cells (5km radius)               │
│  ─ SQL query: SELECT from GeoRasterCell                     │
│  ─ Select best non-overlapping zones by theme               │
│  ─ Return 3-4 zones in <100ms                               │
└─────────────────────────────────────────────────────────────┘
```

## Migration Steps

### 1. Database Migration

Deploy the new migration to Supabase:

```bash
# Run locally first (if using local Supabase)
supabase migration up

# Or deploy to hosted Supabase
# The migration is already in: migrations/021_create_geo_raster_grid.sql
```

**What it creates:**
- `GeoRasterCell` table: main grid storage
- `RasterCellQueryLog` table: metrics & debugging
- Indexes for fast spatial queries
- RLS policies for public read access

### 2. Deploy New Edge Functions

```bash
# Deploy both functions
npx supabase functions deploy initializeGeoRasterGrid
npx supabase functions deploy robotPlantDailyZones
```

### 3. Initialize Raster Grid for Your Region

The `initializeGeoRasterGrid` function populates the grid. Call it once per region:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/initializeGeoRasterGrid \
  -H "Content-Type: application/json" \
  -d '{
    "bounds": {
      "north": 55.0,
      "south": 54.0,
      "east": 10.5,
      "west": 9.5
    },
    "adminKey": "<your-admin-secret>",
    "forceRefresh": false
  }'
```

**Parameters:**
- `bounds`: Bounding box [lat, lng] for the region to initialize
  - `north`, `south`: latitude bounds
  - `east`, `west`: longitude bounds
- `adminKey`: Authorization secret (set in Supabase env as `ADMIN_SECRET`)
- `forceRefresh` (optional): Delete existing cells and re-populate

**Response:**
```json
{
  "success": true,
  "cellsCreated": 142,
  "duration_ms": 5234
}
```

### 4. Configure Environment Variables

Set in your Supabase project settings (`.env.local` or Supabase dashboard):

```
ADMIN_SECRET=your-secure-random-secret
FLORALOG_URL=https://yourdomain.com
SITE_URL=https://yourdomain.com
```

## Grid Calculation Details

The grid uses **degree-based coordinates** for simplicity:

**Grid Resolution:** ~0.00636° per cell
- Latitude: 707m per cell
- Longitude: ~554m per cell (at Kiel, ~54°N)
- **Total area:** ~0.5km² per cell

**Grid Cell Identification:**

```javascript
// To find which grid cell a location belongs to:
function getGridCellCoordinates(lat, lng) {
  const GRID_RESOLUTION = 0.00636;
  return {
    latIdx: Math.floor(lat / GRID_RESOLUTION),
    lngIdx: Math.floor(lng / GRID_RESOLUTION)
  };
}

// Example: Kiel (54.32°N, 10.13°E)
// → latIdx = 8542, lngIdx = 1592
// → grid_id = "8542_1592"
```

## Data Quality & Confidence Scoring

Each cell has a `theme_confidence` (0.0 - 1.0):

| Confidence | Meaning | Example |
|-----------|---------|---------|
| 0.85-1.0  | Very confident | Primary tag matches (e.g., `landuse=forest`) |
| 0.5-0.85  | Moderate confidence | Secondary or inferred (e.g., `leisure=park` → meadow) |
| 0.3-0.5   | Low confidence | Mixed or ambiguous | Fallback classifications |

## OSM Tag Classification Rules

The system classifies cells based on **dominant OSM tags**:

### Water
- `natural=water|riverbank`
- `waterway=river|stream|canal`
- `water=*` (any tag)
- **Confidence:** 0.9

### Forest
- `natural=forest|wood`
- `landuse=forest`
- **Confidence:** 0.9

### Urban
- `landuse=residential|industrial|commercial|retail`
- **Confidence:** 0.88

### Meadow
- `natural=meadow|grassland`
- `leisure=park`
- **Fallback:** 0.4-0.85

## Troubleshooting

### Issue: "No geo-raster data available"

**Solution:** The GeoRasterCell table is empty. Run `initializeGeoRasterGrid` for your region.

### Issue: Zone generation takes >100ms

**Possible causes:**
1. Too many cells in the search radius (increase grid resolution)
2. Database indexes are missing (check migration was applied)
3. RLS policies are inefficient (see `idx_geo_raster_valid_theme`)

**Fix:** Check Supabase query performance in the dashboard.

### Issue: Zones are always the same theme

**Possible cause:** OSM data in your region lacks diversity, or raster was initialized with incomplete data.

**Fix:** Re-run `initializeGeoRasterGrid` with `forceRefresh: true`.

## Performance Benchmarks (Expected)

| Operation | Time | Notes |
|-----------|------|-------|
| Database lookup (5km radius) | 10-30ms | ~100-200 cells |
| Zone selection algorithm | 5-15ms | Overlap checking |
| Zone insertion to DB | 20-50ms | 3-4 zone records |
| **Total per request** | **<100ms** | Consistent, no API timeouts |

**vs. Old System (Live OSM):**
- Overpass query: 2-8 seconds (or timeout)
- Fallback generation: 100ms
- Total: **unpredictable, often failed**

## Maintenance & Updates

### Refreshing OSM data

OSM data changes over time. Update the raster grid periodically:

```bash
# Update a region (preserves existing cells where data hasn't changed much)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/initializeGeoRasterGrid \
  -H "Content-Type: application/json" \
  -d '{
    "bounds": {...},
    "adminKey": "secret",
    "forceRefresh": false  # Upsert only where confidence changes
  }'
```

### Monitor performance

Check `RasterCellQueryLog` table:

```sql
-- Average query duration
SELECT 
  DATE_TRUNC('day', created_at) as day,
  AVG(query_duration_ms) as avg_duration_ms,
  COUNT(*) as total_queries
FROM public."RasterCellQueryLog"
GROUP BY day
ORDER BY day DESC;

-- Theme distribution
SELECT
  theme,
  AVG(theme_confidence) as avg_confidence,
  COUNT(*) as cell_count
FROM public."GeoRasterCell"
GROUP BY theme;
```

## Backwards Compatibility

The old `RobotPlantZone` table is still used for output. The new code:
1. Checks for cached zones (same as before)
2. Queries raster grid instead of Overpass
3. Writes selected zones to `RobotPlantZone` (same as before)

**No frontend changes needed.**

## Next Steps

1. **Deploy migrations:** `supabase migration up`
2. **Deploy functions:** `npx supabase functions deploy robotPlantDailyZones initializeGeoRasterGrid`
3. **Configure admin secret** in Supabase env
4. **Initialize your region:** Call `initializeGeoRasterGrid` with appropriate bounds
5. **Test:** Open the map in the app, click "Standort ermitteln"
6. **Monitor:** Check `RasterCellQueryLog` for performance metrics

## References

- OSM Tag Documentation: https://wiki.openstreetmap.org/wiki/Key:landuse
- Overpass API: https://overpass-api.de/
- PostGIS (for future geometry support): https://postgis.net/

# Deployment Checklist – Raster Grid System

⚠️ **NOTE: This checklist documents the DEPRECATED GeoRasterCell system.** 
The system has been migrated to slim OSM database (OSMTileChunkLite + OSMTileValue) as of April 2026.
See `robotPlantDailyZones` function for current implementation.

## Pre-Deployment

- [ ] Backup your database (recommended)
- [ ] Review migration file: `migrations/021_create_geo_raster_grid.sql` (DEPRECATED)
- [ ] Review functions:
  - [ ] `supabase/functions/robotPlantDailyZones/index.ts` (NOW uses OSMTileChunkLite + OSMTileValue)
  - [ ] `supabase/functions/initializeGeoRasterGrid/index.ts` (DEPRECATED - no longer in use)
- [ ] Ensure you have admin access to Supabase project

## Phase 1: Database Setup

### Local Testing (if applicable)
```bash
# Reset local Supabase if needed
supabase db reset

# Run migrations
supabase migration up
```

### Production Deployment
1. Go to Supabase Dashboard → SQL Editor
2. Copy-paste the SQL from `migrations/021_create_geo_raster_grid.sql`
3. Execute the migration
4. Verify tables were created: (NOTE: GeoRasterCell system is DEPRECATED)
   - [ ] ~~`GeoRasterCell` table exists~~ (DEPRECATED - replaced by OSMTileChunkLite)
   - [ ] ~~`RasterCellQueryLog` table exists~~ (DEPRECATED - no longer needed)
   - [ ] Indexes created (DEPRECATED)
   - [ ] RLS policies in place (DEPRECATED)

## Phase 2: Environment Configuration

1. Go to Supabase Project Settings → Environment Variables
2. Add or verify:
   ```
   KEY                          VALUE
   ADMIN_SECRET                 <generate-secure-random-string>
   FLORALOG_URL                 https://yourdomain.com
   SITE_URL                     https://yourdomain.com
   ```
3. Note the `ADMIN_SECRET` value (you'll need it later)

## Phase 3: Deploy Functions

```bash
# In your project root:
cd your-project-directory

# Deploy both functions
npx supabase functions deploy robotPlantDailyZones
npx supabase functions deploy initializeGeoRasterGrid

# Verify deployment in Supabase dashboard → Functions
```

- [ ] `robotPlantDailyZones` deployed successfully (NOW uses slim OSM database)
- [ ] ~~`initializeGeoRasterGrid` deployed successfully~~ (DEPRECATED - do not deploy)
- [ ] `robotPlantDailyZones` shows in Functions list in dashboard

## Phase 4: Initialize Raster Grid

### Option A: Using Script (Recommended)

1. Edit `scripts/init-raster-grid-kiel.sh`:
   ```bash
   SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
   ADMIN_SECRET="<value-from-env-config>"
   ```

2. Run the script:
   ```bash
   bash scripts/init-raster-grid-kiel.sh
   ```

3. Wait for completion (typically 2-5 minutes per region)

### Option B: Manual cURL

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/initializeGeoRasterGrid \
  -H "Content-Type: application/json" \
  -d '{
    "bounds": {
      "north": 54.5,
      "south": 54.15,
      "east": 10.35,
      "west": 9.9
    },
    "adminKey": "<ADMIN_SECRET from env>",
    "forceRefresh": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "cellsCreated": 120-200,
  "duration_ms": 3000-8000
}
```

- [ ] Grid initialization completed
- [ ] At least 100+ cells created
- [ ] No errors in response

## Phase 5: Verification

### Quick Test

```bash
# Make sure everything works
bash scripts/test-raster-grid.sh
```

Enter your Supabase credentials when prompted.

- [ ] `GeoRasterCell` table accessible
- [ ] Both functions deployed
- [ ] Raster grid has data (>100 cells)
- [ ] Zone generation responds in <100ms

### Frontend Test

1. Open your Floralog app
2. Navigate to 🗺️ Map tab
3. Click "📍 Lokal" quick view
4. Click "Standort ermitteln" button
5. Wait for zones to appear (~1-2 seconds)

Expected behavior:
- [ ] App shows user location on map
- [ ] 3-4 colored zones appear around user
- [ ] Each zone has a different theme color:
  - 🟢 Forest (green)
  - 🔵 Water (blue)
  - 🟠 Urban (orange/gray)
  - 🟡 Meadow (yellow)

### Database Inspection

```sql
-- Check grid population
SELECT theme, COUNT(*) as cell_count, 
       AVG(theme_confidence) as avg_confidence
FROM public."GeoRasterCell"
WHERE is_valid = true
GROUP BY theme;

-- Check recent zone generations
SELECT search_lat, search_lng, cells_found, query_duration_ms, created_at
FROM public."RasterCellQueryLog"
ORDER BY created_at DESC
LIMIT 10;
```

- [ ] Multiple themes represented in grid
- [ ] Query duration consistently <100ms
- [ ] No NULL values in critical fields

## Phase 6: Cleanup (Optional)

If you're confident the new system works, you can optionally remove old code:

```bash
# These are now obsolete (the functions still work, but unused):
rm supabase/functions/robotPlantDailyZones/old-overpass-queries.ts  # If exists
```

**DO NOT DELETE:**
- `robotPlantDailyZones/index.ts` (the updated version is used!)
- Old OSM-related tables (they might be used elsewhere)

## Post-Deployment Monitoring

### Daily
- Check that users' zones are appearing correctly
- Monitor Supabase function logs for errors

### Weekly
- Run `test-raster-grid.sh` to ensure performance
- Check `RasterCellQueryLog` for anomalies:
  ```sql
  SELECT AVG(query_duration_ms) as avg_ms, MAX(query_duration_ms) as max_ms
  FROM public."RasterCellQueryLog"
  WHERE created_at > NOW() - INTERVAL '7 days';
  ```

### Monthly
- Review OSM data freshness
- Consider re-running `initializeGeoRasterGrid` with `forceRefresh: true` if needed
- Check grid coverage – extend to new regions if users travel beyond current bounds

## Rollback Plan (If Needed)

If critical issues arise:

1. **Temporary fix:** Revert the old `robotPlantDailyZones` function code from git
2. **Database rollback:** Drop `GeoRasterCell` and `RasterCellQueryLog` tables (if needed)
3. **Redeploy old function:**
   ```bash
   git checkout HEAD~1 -- supabase/functions/robotPlantDailyZones/index.ts
   npx supabase functions deploy robotPlantDailyZones
   ```

> ⚠️ Keep the migration file – you might want it later for re-deployment.

## Support & Documentation

- **Detailed guide:** See `RASTER_GRID_GUIDE.md`
- **Implementation notes:** See `IMPLEMENTATION_SUMMARY.md`
- **Quick scripts:** See `scripts/init-raster-grid-kiel.sh` and `scripts/test-raster-grid.sh`

## Final Sign-Off

- [ ] All phases completed
- [ ] Frontend tests passed
- [ ] Database checks OK
- [ ] Performance <100ms confirmed
- [ ] Team aware of new system
- [ ] Documentation shared with team

**Deployment Date:** ________________
**Deployed By:** ________________
**Status:** ✅ Ready for Production / 🔴 Issues Pending

#!/usr/bin/env bash

# Quick Start: Initialize Raster Grid for Kiel Region
# 
# This script populates the GeoRasterCell table with pre-computed OSM data
# for the Kiel area. Adjust ADMIN_SECRET and SUPABASE_URL as needed.

# Configuration
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
ADMIN_SECRET="your-admin-secret-here"

# Kiel region (approximate bounding box)
# Center: ~54.32°N, 10.13°E
# Area: ~30km x 30km
BOUNDS_NORTH=54.5
BOUNDS_SOUTH=54.15
BOUNDS_EAST=10.35
BOUNDS_WEST=9.9

echo "🗺️  Initializing Geo Raster Grid for Kiel Region"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Bounds: North=$BOUNDS_NORTH, South=$BOUNDS_SOUTH"
echo "        East=$BOUNDS_EAST, West=$BOUNDS_WEST"
echo ""

# Call the initialization function
echo "📡 Sending request to initializeGeoRasterGrid..."

RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/initializeGeoRasterGrid" \
  -H "Content-Type: application/json" \
  -d "{
    \"bounds\": {
      \"north\": $BOUNDS_NORTH,
      \"south\": $BOUNDS_SOUTH,
      \"east\": $BOUNDS_EAST,
      \"west\": $BOUNDS_WEST
    },
    \"adminKey\": \"$ADMIN_SECRET\",
    \"forceRefresh\": false
  }")

echo "$RESPONSE" | jq '.'

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅ Raster grid initialization successful!"
  CELLS=$(echo "$RESPONSE" | jq '.cellsCreated')
  DURATION=$(echo "$RESPONSE" | jq '.duration_ms')
  echo "   Created $CELLS cells in ${DURATION}ms"
  echo ""
  echo "🚀 The system is now ready for zone generation!"
else
  echo ""
  echo "❌ Initialization failed. Check the response above."
  echo ""
  echo "Troubleshooting:"
  echo "  1. Verify SUPABASE_URL is correct"
  echo "  2. Verify ADMIN_SECRET matches Supabase env (ADMIN_SECRET)"
  echo "  3. Check that migrations have been deployed"
  echo "  4. Review Supabase function logs"
fi

#!/usr/bin/env bash

# Test Script: Verify Raster Grid Implementation
# 
# This script checks if all components are working correctly:
# 1. Migrations deployed
# 2. Functions created
# 3. Raster grid has data
# 4. Query performance

echo "🔍 Verifying Raster Grid Implementation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://YOUR_PROJECT.supabase.co}"
SUPABASE_KEY="${SUPABASE_KEY:-}"
AUTH_ID="${TEST_AUTH_ID:-00000000-0000-0000-0000-000000000000}"

echo "📦 Checking Database Tables..."
echo "─────────────────────────────"

# Check if GeoRasterCell table exists
TABLE_CHECK=$(curl -s "$SUPABASE_URL/rest/v1/GeoRasterCell?limit=1" \
  -H "APIKey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$TABLE_CHECK" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓${NC} GeoRasterCell table exists"
  
  CELL_COUNT=$(curl -s "$SUPABASE_URL/rest/v1/GeoRasterCell?select=count()&count=exact" \
    -H "APIKey: $SUPABASE_KEY" \
    2>/dev/null | grep -o '"count":[0-9]*' | cut -d: -f2)
  
  if [ ! -z "$CELL_COUNT" ] && [ "$CELL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} GeoRasterCell has $CELL_COUNT cells"
  else
    echo -e "${YELLOW}⚠${NC} GeoRasterCell is empty (run initialization)"
  fi
else
  echo -e "${RED}✗${NC} GeoRasterCell table not found (HTTP $HTTP_CODE)"
  echo "  → Run: supabase migration up"
fi

echo ""
echo "⚡ Checking Edge Functions..."
echo "─────────────────────────────"

# Check robotPlantDailyZones function
FUNC_CHECK=$(curl -s -X OPTIONS "$SUPABASE_URL/functions/v1/robotPlantDailyZones" \
  -w "\n%{http_code}")

if echo "$FUNC_CHECK" | tail -n1 | grep -q "200\|204"; then
  echo -e "${GREEN}✓${NC} robotPlantDailyZones function deployed"
else
  echo -e "${RED}✗${NC} robotPlantDailyZones function not accessible"
  echo "  → Run: npx supabase functions deploy robotPlantDailyZones"
fi

# Check initializeGeoRasterGrid function
INIT_CHECK=$(curl -s -X OPTIONS "$SUPABASE_URL/functions/v1/initializeGeoRasterGrid" \
  -w "\n%{http_code}")

if echo "$INIT_CHECK" | tail -n1 | grep -q "200\|204"; then
  echo -e "${GREEN}✓${NC} initializeGeoRasterGrid function deployed"
else
  echo -e "${RED}✗${NC} initializeGeoRasterGrid function not accessible"
  echo "  → Run: npx supabase functions deploy initializeGeoRasterGrid"
fi

echo ""
echo "🗺️  Testing Zone Generation (Kiel)..."
echo "─────────────────────────────────────"

# Test zone generation for Kiel
TEST_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/robotPlantDailyZones" \
  -H "Content-Type: application/json" \
  -d "{
    \"authId\": \"$AUTH_ID\",
    \"latitude\": 54.32,
    \"longitude\": 10.13
  }")

echo "Response:"
echo "$TEST_RESPONSE" | jq '.' 2>/dev/null || echo "$TEST_RESPONSE"

if echo "$TEST_RESPONSE" | grep -q '"success":true'; then
  QUERY_TIME=$(echo "$TEST_RESPONSE" | jq '.queryDurationMs // 0')
  ZONE_COUNT=$(echo "$TEST_RESPONSE" | jq '.zones | length')
  
  echo ""
  echo -e "${GREEN}✓${NC} Zone generation successful"
  echo "  • Generated $ZONE_COUNT zones"
  echo "  • Query time: ${QUERY_TIME}ms"
  
  if [ "$QUERY_TIME" -lt 100 ]; then
    echo -e "  ${GREEN}✓ Under 100ms${NC}"
  else
    echo -e "  ${YELLOW}⚠ Over 100ms (check indexes)${NC}"
  fi
else
  if echo "$TEST_RESPONSE" | grep -q "No geo-raster data"; then
    echo -e "${YELLOW}⚠${NC} Raster grid not initialized for this region"
    echo "  → Run: bash scripts/init-raster-grid-kiel.sh"
  else
    echo -e "${RED}✗${NC} Zone generation failed"
    echo "  Check the response above for details"
  fi
fi

echo ""
echo "📊 Checking Query Logs..."
echo "─────────────────────────"

LOG_COUNT=$(curl -s "$SUPABASE_URL/rest/v1/RasterCellQueryLog?select=count()&count=exact" \
  -H "APIKey: $SUPABASE_KEY" \
  2>/dev/null | grep -o '"count":[0-9]*' | cut -d: -f2)

if [ ! -z "$LOG_COUNT" ]; then
  if [ "$LOG_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Query logs recorded ($LOG_COUNT entries)"
  else
    echo -e "${YELLOW}⚠${NC} No query logs yet (run zone generation first)"
  fi
else
  echo -e "${RED}✗${NC} RasterCellQueryLog table not accessible"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test Summary Complete"
echo ""
echo "📖 For more information, see:"
echo "   • RASTER_GRID_GUIDE.md"
echo "   • IMPLEMENTATION_SUMMARY.md"

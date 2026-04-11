# Admin Tile Visualization - Integration Guide

## Overview

The "Tile Show" feature allows admins to visualize OSM tiles in a given area with their assigned themes. This helps debug zone generation and understand how tiles are classified by the backend.

## Components

### 1. Backend: `getTileVisualization` Edge Function
- **File**: `supabase/functions/getTileVisualization/index.ts`
- **Access**: Admin only (checks PublicProfile.role == "admin")
- **Input**: `{ authId, latitude, longitude, radiusM }`
- **Output**: Array of tiles with theme percentages and dominant theme

### 2. Frontend: Service Layer
- **File**: `src/api/tileVisualizationService.js`
- **Function**: `getTileVisualization(authId, lat, lng, radiusM)`
- **Returns**: `{ success, tiles[], tilesCount, tileSize, chunkSize }`

### 3. Frontend: UI Component
- **File**: `src/components/admin/TileVisualizationPanel.jsx`
- **Component**: `TileVisualizationPanel`
- **Props**: `{ map, userLocation, authId, isAdmin }`

## Integration Steps

### Step 1: Add component to Home.jsx

```jsx
import { TileVisualizationPanel } from "@/components/admin/TileVisualizationPanel";
import mapboxgl from "mapbox-gl";

// In your render:
<HeroZoneMap3D 
  zones={zones}
  userLocation={currentUserLocation}
  fallbackCenter={fallbackCenter}
  onMapReady={(mapInstance) => {
    // Store map reference for tile visualization
    setMapRef(mapInstance);
  }}
/>

{/* Add the tile visualization panel */}
{mapRef && (
  <TileVisualizationPanel
    map={mapRef}
    userLocation={currentUserLocation}
    authId={userId}
    isAdmin={userRole === "admin"}
  />
)}
```

### Step 2: Export map reference from HeroZoneMap3D

Modify `HeroZoneMap3D` to expose the map instance:

```jsx
useEffect(() => {
  // ... existing map setup code ...
  if (onMapReady && mapRef.current) {
    onMapReady(mapRef.current);
  }
}, [mapRef.current, onMapReady]);
```

### Step 3: Deploy backend function

```bash
npx supabase functions deploy getTileVisualization --project-ref YOUR_PROJECT_REF
```

## Usage

1. **Unlock Admin Mode**: Ensure your account has `role = "admin"` in PublicProfile
2. **Open Home Page**: Navigate to the home/map view
3. **Click Grid Icon**: A button with grid icon appears bottom-right (admins only)
4. **Adjust Radius**: Slider controls search radius (500m - 5000m, default 2000m)
5. **Load Tiles**: Click "Load Tiles" to fetch and visualize
6. **View Results**: 
   - Tiles appear as colored grid squares on the map
   - Colors indicate the dominant theme
   - Click tiles for detailed theme breakdown
   - List shows all tiles with percentage breakdown

## Tile Visualization Details

### Colors
- **Forest**: Dark Green (#007a3f)
- **Urban**: Brown (#8d755c)
- **Water**: Blue (#2b6cb0)
- **Meadow**: Lime Green (#84cc16)
- **Beach**: Amber (#fbbf24)
- **Wetlands**: Teal (#14b8a6)

### Tile Size
- 100m × 100m tiles displayed as squares on the map
- Approximate rendering (uses proper EPSG:3035 to lat/lng conversion)

### Interaction
- **Hover**: Cursor changes to pointer over tiles
- **Click**: Popup shows tile coordinates and theme breakdown
- **List**: Scroll through all tiles with percentage indicators

## Theme Percentages

Each tile displays the distribution of zone types as percentages:

```
[Tile X, Y] forest (Dominant Theme)
┌─────────────────────────────────┐
│ forest: 45%  urban: 30%         │
│ water: 20%   meadow: 5%         │
└─────────────────────────────────┘
```

## Debugging

### Check if data is loaded
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter for "getTileVisualization"
4. Check response for tiles array

### If no tiles show
1. Verify location has OSM data (`radiusM` may need adjustment)
2. Check admin status: `SELECT role FROM "PublicProfile" WHERE auth_id = '...'`
3. Check Supabase function logs in dashboard

### Performance notes
- Typical response time: 200-500ms for 2000m radius
- Max 500 candidates pre-fetched in function (iOS optimization)
- Mapbox layer rendering: <100ms for typical tile counts

## Advanced: Custom Tile Filtering

To show only specific themes, modify the component's `renderTilesOnMap`:

```jsx
// Filter tiles by theme before rendering
const filteredTiles = tiles.filter(tile => 
  tile.dominantTheme === "forest" // Example: show only forest tiles
);

renderTilesOnMap(map, filteredTiles, result.tileSize);
```

## Deployment Checklist

- [ ] Backend function deployed: `getTileVisualization`
- [ ] Frontend service created: `tileVisualizationService.js`
- [ ] Component added: `TileVisualizationPanel.jsx`
- [ ] Component integrated into Home.jsx with map ref export
- [ ] Admin test account created with role = "admin"
- [ ] Tested tile loading in browser
- [ ] Tiles render with correct colors
- [ ] Click interactions work (popups appear)
- [ ] Mobile Safari tested (if applicable)

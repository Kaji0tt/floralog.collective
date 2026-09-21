# Admin Area Visualization - Integration Guide

## Overview

The "Area Show" feature allows admins to visualize OSM areas in a given area with their assigned themes. This helps debug zone generation and understand how areas are classified by the backend.

## Components

### 1. Backend: `getAreaVisualization` Edge Function
- **File**: `supabase/functions/getAreaVisualization/index.ts`
- **Access**: Admin only (checks PublicProfile.role == "admin")
- **Input**: `{ authId, latitude, longitude, radiusM }`
- **Output**: Array of areas with theme percentages and dominant theme

### 2. Frontend: Service Layer
- **File**: `src/api/areaVisualizationService.js`
- **Function**: `getAreaVisualization(authId, lat, lng, radiusM)`
- **Returns**: `{ success, areas[], areasCount, areaSize, chunkSize }`

### 3. Frontend: UI Component
- **File**: `src/components/admin/AreaVisualizationPanel.jsx`
- **Component**: `AreaVisualizationPanel`
- **Props**: `{ map, userLocation, authId, isAdmin }`

## Integration Steps

### Step 1: Add component to Home.jsx

```jsx
import { AreaVisualizationPanel } from "@/components/admin/AreaVisualizationPanel";
import mapboxgl from "mapbox-gl";

// In your render:
<HeroZoneMap3D 
  zones={zones}
  userLocation={currentUserLocation}
  fallbackCenter={fallbackCenter}
  onMapReady={(mapInstance) => {
    // Store map reference for area visualization
    setMapRef(mapInstance);
  }}
/>

{/* Add the area visualization panel */}
{mapRef && (
  <AreaVisualizationPanel
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
npx supabase functions deploy getAreaVisualization --project-ref YOUR_PROJECT_REF
```

## Usage

1. **Unlock Admin Mode**: Ensure your account has `role = "admin"` in PublicProfile
2. **Open Home Page**: Navigate to the home/map view
3. **Click Grid Icon**: A button with grid icon appears bottom-right (admins only)
4. **Adjust Radius**: Slider controls search radius (500m - 5000m, default 2000m)
5. **Load Areas**: Click "Load Areas" to fetch and visualize
6. **View Results**: 
   - Areas appear as colored grid squares on the map
   - Colors indicate the dominant theme
   - Click areas for detailed theme breakdown
   - List shows all areas with percentage breakdown

## Area Visualization Details

### Colors
- **Forest**: Dark Green (#007a3f)
- **Urban**: Brown (#8d755c)
- **Water**: Blue (#2b6cb0)
- **Meadow**: Lime Green (#84cc16)
- **Beach**: Amber (#fbbf24)
- **Wetlands**: Teal (#14b8a6)

### Area Size
- 100m × 100m areas displayed as squares on the map
- Approximate rendering (uses proper EPSG:3035 to lat/lng conversion)

### Interaction
- **Hover**: Cursor changes to pointer over areas
- **Click**: Popup shows area coordinates and theme breakdown
- **List**: Scroll through all areas with percentage indicators

## Theme Percentages

Each area displays the distribution of zone types as percentages:

```
[Area X, Y] forest (Dominant Theme)
┌─────────────────────────────────┐
│ forest: 45%  urban: 30%         │
│ water: 20%   meadow: 5%         │
└─────────────────────────────────┘
```

## Debugging

### Check if data is loaded
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter for "getAreaVisualization"
4. Check response for areas array

### If no areas show
1. Verify location has OSM data (`radiusM` may need adjustment)
2. Check admin status: `SELECT role FROM "PublicProfile" WHERE auth_id = '...'`
3. Check Supabase function logs in dashboard

### Performance notes
- Typical response time: 200-500ms for 2000m radius
- Max 500 candidates pre-fetched in function (iOS optimization)
- Mapbox layer rendering: <100ms for typical area counts

## Advanced: Custom Area Filtering

To show only specific themes, modify the component's `renderAreasOnMap`:

```jsx
// Filter areas by theme before rendering
const filteredAreas = areas.filter(area =>
  area.dominantTheme === "forest" // Example: show only forest areas
);

renderAreasOnMap(map, filteredAreas, result.areaSize);
```

## Deployment Checklist

- [ ] Backend function deployed: `getAreaVisualization`
- [ ] Frontend service created: `areaVisualizationService.js`
- [ ] Component added: `AreaVisualizationPanel.jsx`
- [ ] Component integrated into Home.jsx with map ref export
- [ ] Admin test account created with role = "admin"
- [ ] Tested area loading in browser
- [ ] Areas render with correct colors
- [ ] Click interactions work (popups appear)
- [ ] Mobile Safari tested (if applicable)

import React, { useState } from "react";
import { getAreaVisualization } from "@/api/areaVisualizationService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, Grid3x3, AlertCircle } from "lucide-react";
import mapboxgl from "mapbox-gl";

const THEME_COLORS = {
  forest: "#007a3f",
  urban: "#8d755c",
  water: "#2b6cb0",
  meadow: "#84cc16",
  beach: "#fbbf24",
  wetlands: "#14b8a6",
};

const formatPercent = (value) =>
  Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Admin-only area visualization overlay for Mapbox
 * Shows OSM areas with their dominant themes highlighted
 *
 * When `open` and `onOpenChange` are provided the component is controlled
 * externally and the built-in toggle button is hidden.
 */
export function AreaVisualizationPanel({ map, userLocation, authId, isAdmin, open, onOpenChange }) {
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const [internalVisible, setInternalVisible] = useState(false);
  const isVisible = isControlled ? open : internalVisible;
  const setIsVisible = isControlled ? onOpenChange : setInternalVisible;
  const [isLoading, setIsLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState(null);
  const [radiusM, setRadiusM] = useState(2000);

  const handleLoadAreas = async () => {
    if (!map || !userLocation || !authId) {
      setError("Map or location not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getAreaVisualization(
        authId,
        Number(userLocation.lat),
        Number(userLocation.lng),
        radiusM
      );

      if (result.success) {
        setAreas(result.areas || []);
        renderAreasOnMap(map, result.areas || [], result.areaSize);
      } else {
        setError(result.error || "Failed to load areas");
      }
    } catch (err) {
      setError(err.message || "Error loading areas");
      console.error("[AreaVisualization]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAreas = () => {
    setAreas([]);
    clearAreasFromMap(map);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {!isControlled && (
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          size="sm"
          className="absolute bottom-4 right-4 z-10 gap-2"
          title="Admin: Arealansicht umschalten"
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <Grid3x3 className="w-4 h-4" />
        </Button>
      )}

      <Dialog open={isVisible} onOpenChange={setIsVisible}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔧 Admin: Arealansicht</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Radius control */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Suchradius: {radiusM}m
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={radiusM}
                onChange={(e) => setRadiusM(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleLoadAreas}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Areale laden"
                )}
              </Button>
              <Button
                onClick={handleClearAreas}
                variant="outline"
                className="flex-1"
              >
                Leeren
              </Button>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg flex gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Areas list */}
            {areas.length > 0 && (
              <div className="max-h-64 overflow-y-auto border rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-medium mb-2 text-slate-600">
                  {areas.length} Areale geladen:
                </p>
                <div className="space-y-2">
                  {areas.map((area, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border text-xs"
                    >
                      <div className="font-mono text-slate-700">
                        [{area.areaX}, {area.areaY}] {area.dominantTheme}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(area.themes).map(([theme, pct]) => (
                          pct > 0 && (
                            <span
                              key={theme}
                              className="px-2 py-1 rounded text-white text-xs font-medium"
                              style={{
                                backgroundColor: THEME_COLORS[theme],
                              }}
                              title={`${theme}: ${formatPercent(pct)}%`}
                            >
                              {theme} {formatPercent(pct)}%
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Theme legend */}
            <div className="p-2 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium mb-2 text-slate-600">Themes:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(THEME_COLORS).map(([theme, color]) => (
                  <div key={theme} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="capitalize">{theme}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Render areas on Mapbox with borders and fill for each theme
 */
function renderAreasOnMap(map, areas, areaSize = 100) {
  // Remove existing layer if present
  if (map.getLayer("areas-fill")) {
    map.removeLayer("areas-fill");
  }
  if (map.getLayer("areas-border")) {
    map.removeLayer("areas-border");
  }
  if (map.getSource("areas")) {
    map.removeSource("areas");
  }

  // Convert areas to GeoJSON features
  const features = areas.map((area) => {
    // Convert area coordinates to lat/lng bounds
    // This is approximate - uses area center
    const areaWidthDegrees = areaSize / 111000; // 111km per degree
    const areaLat = Number(area.centerLat);
    const areaLng = Number(area.centerLng);

    // Adjust for latitude
    const adj = Math.cos((areaLat * Math.PI) / 180);
    const west = areaLng - areaWidthDegrees / 2 / adj;
    const east = areaLng + areaWidthDegrees / 2 / adj;
    const south = areaLat - areaWidthDegrees / 2;
    const north = areaLat + areaWidthDegrees / 2;

    const dominantTheme = area.dominantTheme || "meadow";
    const themeColor = THEME_COLORS[dominantTheme] || "#84cc16";

    return {
      type: "Feature",
      properties: {
        areaX: area.areaX,
        areaY: area.areaY,
        dominantTheme,
        themeColor,
        themes: area.themes,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    };
  });

  // Add source
  map.addSource("areas", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features,
    },
  });

  // Add fill layer
  map.addLayer(
    {
      id: "areas-fill",
      type: "fill",
      source: "areas",
      paint: {
        "fill-color": ["get", "themeColor"],
        "fill-opacity": 0.2,
      },
    },
    "water"
  );

  // Add border layer
  map.addLayer({
    id: "areas-border",
    type: "line",
    source: "areas",
    paint: {
      "line-color": ["get", "themeColor"],
      "line-width": 2,
      "line-opacity": 0.8,
    },
  });

  // Add click listener for area info
  map.on("click", "areas-border", (e) => {
    const feature = e.features[0];
    if (feature) {
      const props = feature.properties;
      let themes = {};
      try {
        themes = typeof props.themes === "string" ? JSON.parse(props.themes) : (props.themes || {});
      } catch {
        themes = {};
      }
      const themesText = Object.entries(themes)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}%`)
        .join(", ");

      const popup = new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="p-2">
            <strong>Area [${props.areaX}, ${props.areaY}]</strong><br>
            Dominant: <strong>${props.dominantTheme}</strong><br>
            <small>${themesText}</small>
          </div>`
        )
        .addTo(map);
    }
  });

  map.on("mouseenter", "areas-border", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "areas-border", () => {
    map.getCanvas().style.cursor = "";
  });
}

function clearAreasFromMap(map) {
  if (map.getLayer("areas-border")) {
    map.removeLayer("areas-border");
  }
  if (map.getLayer("areas-fill")) {
    map.removeLayer("areas-fill");
  }
  if (map.getSource("areas")) {
    map.removeSource("areas");
  }
}

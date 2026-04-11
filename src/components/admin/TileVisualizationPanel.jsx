import React, { useState, useEffect } from "react";
import { getTileVisualization } from "@/api/tileVisualizationService";
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

/**
 * Admin-only tile visualization overlay for Mapbox
 * Shows OSM tiles with their dominant themes highlighted
 */
export function TileVisualizationPanel({ map, userLocation, authId, isAdmin }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tiles, setTiles] = useState([]);
  const [error, setError] = useState(null);
  const [radiusM, setRadiusM] = useState(2000);

  const handleLoadTiles = async () => {
    if (!map || !userLocation || !authId) {
      setError("Map or location not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getTileVisualization(
        authId,
        Number(userLocation.lat),
        Number(userLocation.lng),
        radiusM
      );

      if (result.success) {
        setTiles(result.tiles || []);
        renderTilesOnMap(map, result.tiles || [], result.tileSize);
      } else {
        setError(result.error || "Failed to load tiles");
      }
    } catch (err) {
      setError(err.message || "Error loading tiles");
      console.error("[TileVisualization]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearTiles = () => {
    setTiles([]);
    clearTilesFromMap(map);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsVisible(!isVisible)}
        variant="outline"
        size="sm"
        className="absolute bottom-4 right-4 z-10 gap-2"
        title="Admin: Toggle tile visualization"
      >
        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <Grid3x3 className="w-4 h-4" />
      </Button>

      <Dialog open={isVisible} onOpenChange={setIsVisible}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔧 Admin: Tile Visualization</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Radius control */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Search Radius: {radiusM}m
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
                onClick={handleLoadTiles}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load Tiles"
                )}
              </Button>
              <Button
                onClick={handleClearTiles}
                variant="outline"
                className="flex-1"
              >
                Clear
              </Button>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg flex gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Tiles list */}
            {tiles.length > 0 && (
              <div className="max-h-64 overflow-y-auto border rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-medium mb-2 text-slate-600">
                  {tiles.length} Tiles Loaded:
                </p>
                <div className="space-y-2">
                  {tiles.map((tile, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border text-xs"
                    >
                      <div className="font-mono text-slate-700">
                        [{tile.tileX}, {tile.tileY}] {tile.dominantTheme}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(tile.themes).map(([theme, pct]) => (
                          pct > 0 && (
                            <span
                              key={theme}
                              className="px-2 py-1 rounded text-white text-xs font-medium"
                              style={{
                                backgroundColor: THEME_COLORS[theme],
                              }}
                              title={`${theme}: ${pct}%`}
                            >
                              {pct}%
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
 * Render tiles on Mapbox with borders and fill for each theme
 */
function renderTilesOnMap(map, tiles, tileSize = 100) {
  // Remove existing layer if present
  if (map.getLayer("tiles-fill")) {
    map.removeLayer("tiles-fill");
  }
  if (map.getLayer("tiles-border")) {
    map.removeLayer("tiles-border");
  }
  if (map.getSource("tiles")) {
    map.removeSource("tiles");
  }

  // Convert tiles to GeoJSON features
  const features = tiles.map((tile) => {
    // Convert tile coordinates to lat/lng bounds
    // This is approximate - uses tile center
    const tileWidthDegrees = tileSize / 111000; // 111km per degree
    const tileLat = Number(tile.centerLat);
    const tileLng = Number(tile.centerLng);

    // Adjust for latitude
    const adj = Math.cos((tileLat * Math.PI) / 180);
    const west = tileLng - tileWidthDegrees / 2 / adj;
    const east = tileLng + tileWidthDegrees / 2 / adj;
    const south = tileLat - tileWidthDegrees / 2;
    const north = tileLat + tileWidthDegrees / 2;

    const dominantTheme = tile.dominantTheme || "meadow";
    const themeColor = THEME_COLORS[dominantTheme] || "#84cc16";

    return {
      type: "Feature",
      properties: {
        tileX: tile.tileX,
        tileY: tile.tileY,
        dominantTheme,
        themeColor,
        themes: tile.themes,
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
  map.addSource("tiles", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features,
    },
  });

  // Add fill layer
  map.addLayer(
    {
      id: "tiles-fill",
      type: "fill",
      source: "tiles",
      paint: {
        "fill-color": ["feature-state", "themeColor", ["get", "themeColor"]],
        "fill-opacity": 0.2,
      },
    },
    "water"
  );

  // Add border layer
  map.addLayer({
    id: "tiles-border",
    type: "line",
    source: "tiles",
    paint: {
      "line-color": ["get", "themeColor"],
      "line-width": 2,
      "line-opacity": 0.8,
    },
  });

  // Add click listener for tile info
  map.on("click", "tiles-border", (e) => {
    const feature = e.features[0];
    if (feature) {
      const props = feature.properties;
      const themes = JSON.parse(props.themes || "{}");
      const themesText = Object.entries(themes)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}%`)
        .join(", ");

      const popup = new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="p-2">
            <strong>Tile [${props.tileX}, ${props.tileY}]</strong><br>
            Dominant: <strong>${props.dominantTheme}</strong><br>
            <small>${themesText}</small>
          </div>`
        )
        .addTo(map);
    }
  });

  map.on("mouseenter", "tiles-border", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "tiles-border", () => {
    map.getCanvas().style.cursor = "";
  });
}

function clearTilesFromMap(map) {
  if (map.getLayer("tiles-border")) {
    map.removeLayer("tiles-border");
  }
  if (map.getLayer("tiles-fill")) {
    map.removeLayer("tiles-fill");
  }
  if (map.getSource("tiles")) {
    map.removeSource("tiles");
  }
}

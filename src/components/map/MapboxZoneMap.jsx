import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const THEME_MAP_COLORS = {
  forest: "#007a3f",
  urban: "#8d755c",
  water: "#2b6cb0",
  meadow: "#84cc16",
};

const THEME_MAP_LABELS = {
  forest: "Forest",
  urban: "Urban",
  water: "Water",
  meadow: "Meadow",
};

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

const toCirclePolygon = ({ lat, lng, radiusM, points = 48 }) => {
  const earthRadiusM = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const angularDistance = radiusM / earthRadiusM;
  const coordinates = [];

  for (let index = 0; index <= points; index += 1) {
    const bearing = (2 * Math.PI * index) / points;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const pointLng =
      (lng * Math.PI) / 180 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat)
      );

    coordinates.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }

  return coordinates;
};

export default function MapboxZoneMap({
  zones = [],
  userLocation = null,
  fallbackCenter = null,
  discoveryPoints = [],
  onTokenError = null,
  onMapReady = null,
  className = "h-full w-full z-0",
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const onTokenErrorRef = useRef(null);

  useEffect(() => {
    onTokenErrorRef.current = typeof onTokenError === "function" ? onTokenError : null;
  }, [onTokenError]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    if (!MAPBOX_ACCESS_TOKEN) {
      onTokenErrorRef.current?.("Mapbox Token fehlt. Setze VITE_MAPBOX_ACCESS_TOKEN in .env.local.");
      return;
    }

    const userLng = Number(userLocation?.lng);
    const userLat = Number(userLocation?.lat);
    const initialLng = Number.isFinite(userLng) ? userLng : Number(fallbackCenter?.lng);
    const initialLat = Number.isFinite(userLat) ? userLat : Number(fallbackCenter?.lat);

    if (!Number.isFinite(initialLng) || !Number.isFinite(initialLat)) {
      onTokenErrorRef.current?.("Karte konnte nicht initialisiert werden (fehlender Startpunkt).");
      return;
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      config: {
        basemap: {
          theme: "default",
          show3dObjects: true,
        },
      },
      center: [initialLng, initialLat],
      zoom: 13,
      pitch: 58,
      bearing: -18,
      antialias: true,
    });

    mapRef.current = map;
    if (typeof onMapReady === "function") {
      onMapReady(map);
    }

    map.on("error", (event) => {
      const status = event?.error?.status;
      if (status === 401 || status === 403) {
        onTokenErrorRef.current?.("Mapbox Zugriff verweigert. Bitte Token und Allowed URLs pruefen.");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      if (typeof onMapReady === "function") {
        onMapReady(null);
      }
    };
  }, [fallbackCenter?.lat, fallbackCenter?.lng, onMapReady, userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateMapData = () => {
      const userLng = Number(userLocation?.lng);
      const userLat = Number(userLocation?.lat);
      const targetLng = Number.isFinite(userLng) ? userLng : Number(fallbackCenter?.lng);
      const targetLat = Number.isFinite(userLat) ? userLat : Number(fallbackCenter?.lat);

      if (Number.isFinite(targetLng) && Number.isFinite(targetLat)) {
        map.easeTo({
          center: [targetLng, targetLat],
          zoom: 13,
          pitch: 58,
          bearing: -18,
          duration: 600,
        });
      }

      const zoneFeatures = zones
        .map((zone) => {
          const lat = Number(zone.centerLat);
          const lng = Number(zone.centerLng);
          const radiusM = Number(zone.radiusM || 0);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || radiusM <= 0) {
            return null;
          }

          const theme = typeof zone.theme === "string" ? zone.theme : "meadow";
          const color = THEME_MAP_COLORS[theme] || THEME_MAP_COLORS.meadow;
          const themeLabel = THEME_MAP_LABELS[theme] || theme;
          const zoneMultiplierCandidate = Number(
            zone.bonusMultiplier ?? zone.zoneBonusMultiplier ?? zone.zone_bonus_multiplier ?? 1.5
          );
          const zoneMultiplier = Number.isFinite(zoneMultiplierCandidate) ? zoneMultiplierCandidate : 1.5;

          return {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [toCirclePolygon({ lat, lng, radiusM })],
            },
            properties: {
              id: zone.zoneKey || zone.id || `${lat}-${lng}`,
              color,
              theme,
              themeLabel,
              radiusM,
              zoneMultiplier,
            },
          };
        })
        .filter(Boolean);

      const zoneGeoJson = {
        type: "FeatureCollection",
        features: zoneFeatures,
      };

      const zoneSource = map.getSource("hero-zones");
      if (zoneSource) {
        zoneSource.setData(zoneGeoJson);
      } else {
        map.addSource("hero-zones", {
          type: "geojson",
          data: zoneGeoJson,
        });

        map.addLayer({
          id: "hero-zones-fill",
          type: "fill",
          source: "hero-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.22,
          },
        });

        map.addLayer({
          id: "hero-zones-line",
          type: "line",
          source: "hero-zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
            "line-opacity": 0.9,
          },
        });

        map.on("click", "hero-zones-fill", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;

          const props = feature.properties || {};
          const themeLabel = props.themeLabel || props.theme || "Zone";
          const color = props.color || THEME_MAP_COLORS.meadow;
          const radiusDisplay = props.radiusM ? `${Math.round(props.radiusM)} m` : "";
          const zoneMultiplier = Number(props.zoneMultiplier || 1.5);
          const popupHtml = `
            <div style="font-family:sans-serif;min-width:170px;max-width:220px;padding:4px 2px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                <strong style="font-size:14px;color:#fde68a;">${themeLabel} Zone</strong>
              </div>
              <div style="font-size:12px;color:#d6d3d1;line-height:1.5;">
                <div style="margin-bottom:4px;">
                  <span style="color:#86efac;font-weight:600;">Multiplikator:</span> x${zoneMultiplier.toFixed(2)}
                </div>
                <div style="margin-bottom:4px;color:#a8a29e;">
                  Startet bei x1.50 und sinkt pro weiterem Scan in dieser Zone.
                </div>
                ${radiusDisplay ? `<div style="color:#a8a29e;">Radius: ${radiusDisplay}</div>` : ""}
              </div>
            </div>
          `;

          new mapboxgl.Popup({ closeButton: true, maxWidth: "240px", className: "hero-zone-popup" })
            .setLngLat(event.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseenter", "hero-zones-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "hero-zones-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      const userGeoJson = {
        type: "FeatureCollection",
        features: Number.isFinite(userLng) && Number.isFinite(userLat)
          ? [{
              type: "Feature",
              geometry: { type: "Point", coordinates: [userLng, userLat] },
              properties: {},
            }]
          : [],
      };

      const userSource = map.getSource("hero-user");
      if (userSource) {
        userSource.setData(userGeoJson);
      } else {
        map.addSource("hero-user", {
          type: "geojson",
          data: userGeoJson,
        });
        map.addLayer({
          id: "hero-user-point",
          type: "circle",
          source: "hero-user",
          paint: {
            "circle-radius": 6,
            "circle-color": "#38bdf8",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#111827",
          },
        });
      }

      const discoveryGeoJson = {
        type: "FeatureCollection",
        features: discoveryPoints
          .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
          .map((point, index) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(point.lng), Number(point.lat)],
            },
            properties: {
              id: `discovery-${index}`,
            },
          })),
      };

      const discoverySource = map.getSource("hero-discoveries");
      if (discoverySource) {
        discoverySource.setData(discoveryGeoJson);
      } else {
        map.addSource("hero-discoveries", {
          type: "geojson",
          data: discoveryGeoJson,
        });

        map.addLayer({
          id: "hero-discovery-points",
          type: "circle",
          source: "hero-discoveries",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 4],
            "circle-color": "#16a34a",
            "circle-opacity": 0.92,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#dcfce7",
          },
        });
      }

      // Keep discovery markers visually below the player marker.
      if (map.getLayer("hero-discovery-points") && map.getLayer("hero-user-point")) {
        map.moveLayer("hero-discovery-points", "hero-user-point");
      }
    };

    if (map.isStyleLoaded()) {
      updateMapData();
      return;
    }

    map.once("style.load", updateMapData);
  }, [discoveryPoints, fallbackCenter?.lat, fallbackCenter?.lng, userLocation?.lat, userLocation?.lng, zones]);

  return <div ref={mapContainerRef} className={className} />;
}
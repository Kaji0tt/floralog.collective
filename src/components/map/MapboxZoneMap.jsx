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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDiscoveryDate = (rawDate) => {
  if (!rawDate) return "Kein Datum";
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return "Kein Datum";
  return parsed.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const buildDiscoveryPopupHtml = (properties) => {
  const imageUrl = typeof properties?.imageUrl === "string" ? properties.imageUrl : "";
  const scannerDisplayName = escapeHtml(properties?.scannerDisplayName || properties?.scannerName || "Unbekannt");
  const dateLabel = escapeHtml(formatDiscoveryDate(properties?.discoveredAt));
  const plantName = escapeHtml(properties?.plantName || "Unbekannte Pflanze");
  const isLiked = String(properties?.likedByCurrentUser || "") === "true";

  const mediaHtml = imageUrl
    ? `<button type="button" data-popup-action="open-scan" style="padding:0;border:0;background:transparent;display:block;width:100%;cursor:pointer;"><img src="${escapeHtml(imageUrl)}" alt="Scan" style="width:100%;height:76px;object-fit:cover;border-radius:8px;border:1px solid rgba(240,229,165,0.22);margin-bottom:8px;" /></button>`
    : `<div style="width:100%;height:76px;border-radius:8px;border:1px solid rgba(240,229,165,0.18);margin-bottom:8px;background:linear-gradient(135deg,rgba(34,197,94,0.18),rgba(21,128,61,0.12));display:flex;align-items:center;justify-content:center;color:rgba(214,211,209,0.82);font-size:11px;">Kein Bild</div>`;

  return `
    <div style="font-family:sans-serif;min-width:152px;max-width:190px;padding:2px 1px;">
      ${mediaHtml}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:700;color:#f5f5f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${plantName}</div>
          <div style="font-size:10px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${dateLabel} · ${scannerDisplayName}</div>
        </div>
        <button type="button" title="Like" aria-label="Like" data-popup-action="toggle-like" style="border:1px solid rgba(240,229,165,0.26);background:rgba(0,0,0,0.25);color:#fda4af;border-radius:999px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;">${isLiked ? "♥" : "♡"}</button>
      </div>
    </div>
  `;
};

const openDiscoveryPopup = ({ map, event, feature, onDiscoveryImageClick, onDiscoveryLike, allowDiscoveryLike }) => {
  if (!feature) return;
  const properties = feature.properties || {};
  const popupHtml = buildDiscoveryPopupHtml(properties);
  const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: "210px", className: "hero-discovery-popup" })
    .setLngLat(event.lngLat)
    .setHTML(popupHtml)
    .addTo(map);

  const popupRoot = popup.getElement();
  if (!popupRoot) return;

  const imageButton = popupRoot.querySelector('[data-popup-action="open-scan"]');
  if (imageButton && typeof onDiscoveryImageClick === "function") {
    imageButton.addEventListener("click", () => {
      onDiscoveryImageClick({
        discoveryId: properties?.discoveryId || "",
        scannerAuthId: properties?.scannerAuthId || "",
        scannerEmail: properties?.scannerEmail || "",
        genusId: properties?.genusId || "",
      });
    });
  }

  const likeButton = popupRoot.querySelector('[data-popup-action="toggle-like"]');
  if (!likeButton) return;

  const setLikeButtonState = (liked) => {
    likeButton.textContent = liked ? "♥" : "♡";
  };

  const canLike = allowDiscoveryLike === true && typeof onDiscoveryLike === "function";
  likeButton.disabled = !canLike;
  if (!canLike) {
    likeButton.style.opacity = "0.55";
    likeButton.style.cursor = "default";
    return;
  }

  likeButton.addEventListener("click", async () => {
    const currentlyLiked = String(properties?.likedByCurrentUser || "") === "true";
    const nextLiked = !currentlyLiked;
    likeButton.disabled = true;
    try {
      const resolvedLiked = await onDiscoveryLike({
        discoveryId: properties?.discoveryId || "",
        scannerAuthId: properties?.scannerAuthId || "",
        scannerEmail: properties?.scannerEmail || "",
        scannerDisplayName: properties?.scannerDisplayName || "",
        plantName: properties?.plantName || "",
        genusId: properties?.genusId || "",
        nextLiked,
      });
      const finalLiked = typeof resolvedLiked === "boolean" ? resolvedLiked : nextLiked;
      properties.likedByCurrentUser = String(finalLiked);
      setLikeButtonState(finalLiked);
    } finally {
      likeButton.disabled = false;
    }
  });
};

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
  onDiscoveryImageClick = null,
  onDiscoveryLike = null,
  allowDiscoveryLike = true,
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
          const discoveryNearClick = map.queryRenderedFeatures(
            [
              [event.point.x - 8, event.point.y - 8],
              [event.point.x + 8, event.point.y + 8],
            ],
            { layers: ["hero-discovery-hit", "hero-discovery-points"] }
          );
          if (discoveryNearClick.length > 0) {
            return;
          }

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
              discoveryId: point?.discoveryId || "",
              imageUrl: point?.imageUrl || "",
              scannerName: point?.scannerName || "Unbekannt",
              scannerDisplayName: point?.scannerDisplayName || point?.scannerName || "Unbekannt",
              scannerEmail: point?.scannerEmail || "",
              scannerAuthId: point?.scannerAuthId || "",
              plantName: point?.plantName || "Unbekannte Pflanze",
              genusId: point?.genusId || "",
              likedByCurrentUser: String(point?.likedByCurrentUser === true),
              discoveredAt: point?.discoveredAt || "",
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
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 5, 17, 9, 20, 13],
            "circle-color": "#16a34a",
            "circle-opacity": 0.92,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#dcfce7",
          },
        });

        map.addLayer({
          id: "hero-discovery-hit",
          type: "circle",
          source: "hero-discoveries",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 12, 17, 17, 20, 22],
            "circle-color": "#000000",
            "circle-opacity": 0,
            "circle-stroke-width": 0,
            "circle-stroke-opacity": 0,
          },
        });

        map.on("click", "hero-discovery-hit", (event) => {
          const feature = event.features?.[0];
          openDiscoveryPopup({
            map,
            event,
            feature,
            onDiscoveryImageClick,
            onDiscoveryLike,
            allowDiscoveryLike,
          });
        });

        map.on("mouseenter", "hero-discovery-hit", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "hero-discovery-hit", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Keep discovery markers visually below the player marker.
      if (map.getLayer("hero-discovery-points") && map.getLayer("hero-user-point")) {
        map.moveLayer("hero-discovery-points", "hero-user-point");
      }
      if (map.getLayer("hero-discovery-hit") && map.getLayer("hero-user-point")) {
        map.moveLayer("hero-discovery-hit", "hero-user-point");
      }
    };

    if (map.isStyleLoaded()) {
      updateMapData();
      return;
    }

    map.once("style.load", updateMapData);
  }, [
    allowDiscoveryLike,
    discoveryPoints,
    fallbackCenter?.lat,
    fallbackCenter?.lng,
    onDiscoveryImageClick,
    onDiscoveryLike,
    userLocation?.lat,
    userLocation?.lng,
    zones,
  ]);

  return <div ref={mapContainerRef} className={className} />;
}
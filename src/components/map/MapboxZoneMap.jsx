import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { hexToFilter } from "@/lib/hexToFilter";

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
const TILE_HALF_SIZE_M = 50;

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
          <button type="button" data-popup-action="open-scan" style="padding:0;border:0;background:transparent;display:block;max-width:100%;font-size:12px;font-weight:700;color:#f5f5f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-align:left;">${plantName}</button>
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

  const openScanButtons = popupRoot.querySelectorAll('[data-popup-action="open-scan"]');
  if (openScanButtons.length > 0 && typeof onDiscoveryImageClick === "function") {
    openScanButtons.forEach((button) => {
      button.addEventListener("click", () => {
        onDiscoveryImageClick({
          discoveryId: properties?.discoveryId || "",
          scannerAuthId: properties?.scannerAuthId || "",
          scannerEmail: properties?.scannerEmail || "",
          genusId: properties?.genusId || "",
          plantId: properties?.plantId || "",
        });
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

const createDiscoveryMarkerElement = (point) => {
  const markerEl = document.createElement("button");
  markerEl.type = "button";
  markerEl.setAttribute("aria-label", `Scan von ${point?.scannerDisplayName || point?.scannerName || "Unbekannt"}`);
  markerEl.style.padding = "0";
  markerEl.style.border = "0";
  markerEl.style.background = "transparent";
  markerEl.style.cursor = "pointer";

  const borderUrl = String(point?.scannerLogoBorderUrl || "").trim();
  const plantUrl = String(point?.scannerLogoPlantUrl || "").trim();
  const faceUrl = String(point?.scannerLogoFaceUrl || "").trim();
  const borderColor = String(point?.scannerLogoBorderColor || "").trim();
  const hasCustomLogo = Boolean(borderUrl || plantUrl || faceUrl);

  if (!hasCustomLogo) {
    markerEl.style.width = "16px";
    markerEl.style.height = "16px";
    markerEl.style.borderRadius = "999px";
    markerEl.style.background = "#16a34a";
    markerEl.style.border = "1px solid #dcfce7";
    markerEl.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.35)";
    return markerEl;
  }

  markerEl.style.width = "34px";
  markerEl.style.height = "34px";
  markerEl.style.borderRadius = "999px";
  markerEl.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.35)";

  const ring = document.createElement("span");
  ring.style.display = "block";
  ring.style.width = "100%";
  ring.style.height = "100%";
  ring.style.borderRadius = "999px";
  ring.style.border = "1px solid rgba(240,229,165,0.6)";
  ring.style.background = "rgba(0,0,0,0.35)";
  ring.style.padding = "4px";
  ring.style.boxSizing = "border-box";
  ring.style.overflow = "hidden";
  markerEl.appendChild(ring);

  const content = document.createElement("span");
  content.style.position = "relative";
  content.style.display = "block";
  content.style.width = "100%";
  content.style.height = "100%";
  ring.appendChild(content);

  const appendLayer = (url, filterValue) => {
    if (!url) return;
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.style.position = "absolute";
    img.style.inset = "0";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    if (filterValue) {
      img.style.filter = filterValue;
    }
    content.appendChild(img);
  };

  appendLayer(borderUrl, borderColor ? `brightness(0) saturate(100%) ${hexToFilter(borderColor)}` : "");
  appendLayer(plantUrl, "");
  appendLayer(faceUrl, "");

  return markerEl;
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

const getLngLatOffsetByMeters = (lat, lng, offsetXMeter, offsetYMeter) => {
  const latMetersPerDegree = 111320;
  const lngMetersPerDegree = 111320 * Math.cos((lat * Math.PI) / 180);
  const safeLngMetersPerDegree = Math.abs(lngMetersPerDegree) < 1e-6 ? 1e-6 : lngMetersPerDegree;

  return {
    lat: lat + offsetYMeter / latMetersPerDegree,
    lng: lng + offsetXMeter / safeLngMetersPerDegree,
  };
};

const buildApproxTilePolygon = (centerLat, centerLng) => {
  const nw = getLngLatOffsetByMeters(centerLat, centerLng, -TILE_HALF_SIZE_M, TILE_HALF_SIZE_M);
  const ne = getLngLatOffsetByMeters(centerLat, centerLng, TILE_HALF_SIZE_M, TILE_HALF_SIZE_M);
  const se = getLngLatOffsetByMeters(centerLat, centerLng, TILE_HALF_SIZE_M, -TILE_HALF_SIZE_M);
  const sw = getLngLatOffsetByMeters(centerLat, centerLng, -TILE_HALF_SIZE_M, -TILE_HALF_SIZE_M);

  return [
    [nw.lng, nw.lat],
    [ne.lng, ne.lat],
    [se.lng, se.lat],
    [sw.lng, sw.lat],
    [nw.lng, nw.lat],
  ];
};

const buildClaimOverlayData = (claimedTiles = []) => {
  const claimByTileKey = new Map();
  claimedTiles.forEach((claim) => {
    const tileX = Number(claim?.tileX);
    const tileY = Number(claim?.tileY);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
    claimByTileKey.set(`${tileX}:${tileY}`, claim);
  });

  const fillFeatures = [];
  const borderFeatures = [];

  claimedTiles.forEach((claim) => {
    const tileX = Number(claim?.tileX);
    const tileY = Number(claim?.tileY);
    const centerLat = Number(claim?.centerLat);
    const centerLng = Number(claim?.centerLng);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY) || !Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      return;
    }

    const ownerAuthId = String(claim?.ownerAuthId || "");
    const ownerName = claim?.ownerName || "Unbekannt";
    const ownerScanCount = Math.max(0, Number(claim?.ownerScanCount || 0));
    const ownerBorderColor = String(claim?.ownerBorderColor || "").trim() || "#f0e5a5";

    const polygon = buildApproxTilePolygon(centerLat, centerLng);
    fillFeatures.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [polygon],
      },
      properties: {
        tileX,
        tileY,
        ownerAuthId,
        ownerName,
        ownerScanCount,
        ownerBorderColor,
      },
    });

    const tileKey = `${tileX}:${tileY}`;
    const neighbors = {
      north: claimByTileKey.get(`${tileX}:${tileY + 1}`),
      east: claimByTileKey.get(`${tileX + 1}:${tileY}`),
      south: claimByTileKey.get(`${tileX}:${tileY - 1}`),
      west: claimByTileKey.get(`${tileX - 1}:${tileY}`),
    };

    const edges = [
      { id: `${tileKey}:north`, points: [polygon[0], polygon[1]], neighbor: neighbors.north },
      { id: `${tileKey}:east`, points: [polygon[1], polygon[2]], neighbor: neighbors.east },
      { id: `${tileKey}:south`, points: [polygon[2], polygon[3]], neighbor: neighbors.south },
      { id: `${tileKey}:west`, points: [polygon[3], polygon[0]], neighbor: neighbors.west },
    ];

    edges.forEach((edge) => {
      const sameOwnerNeighbor = edge.neighbor && String(edge.neighbor.ownerAuthId || "") === ownerAuthId;
      if (sameOwnerNeighbor) return;

      borderFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: edge.points,
        },
        properties: {
          id: edge.id,
          ownerAuthId,
          ownerBorderColor,
          ownerName,
          ownerScanCount,
        },
      });
    });
  });

  return {
    fillFeatureCollection: {
      type: "FeatureCollection",
      features: fillFeatures,
    },
    borderFeatureCollection: {
      type: "FeatureCollection",
      features: borderFeatures,
    },
  };
};

const findClaimForPoint = (point, claimedTiles = []) => {
  const pointLat = Number(point?.lat);
  const pointLng = Number(point?.lng);
  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return null;

  for (const claim of claimedTiles) {
    const centerLat = Number(claim?.centerLat);
    const centerLng = Number(claim?.centerLng);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) continue;

    const latMetersPerDegree = 111320;
    const lngMetersPerDegree = 111320 * Math.cos((centerLat * Math.PI) / 180);
    const dx = (pointLng - centerLng) * (Math.abs(lngMetersPerDegree) < 1e-6 ? 1e-6 : lngMetersPerDegree);
    const dy = (pointLat - centerLat) * latMetersPerDegree;

    if (Math.abs(dx) <= TILE_HALF_SIZE_M && Math.abs(dy) <= TILE_HALF_SIZE_M) {
      return claim;
    }
  }

  return null;
};

export default function MapboxZoneMap({
  zones = [],
  userLocation = null,
  fallbackCenter = null,
  discoveryPoints = [],
  claimedTiles = [],
  currentAuthId = null,
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
  const discoveryMarkersRef = useRef([]);
  const claimPulseIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (claimPulseIntervalRef.current) {
        window.clearInterval(claimPulseIntervalRef.current);
        claimPulseIntervalRef.current = null;
      }
      discoveryMarkersRef.current.forEach((marker) => marker.remove());
      discoveryMarkersRef.current = [];
    };
  }, []);

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
      discoveryMarkersRef.current.forEach((marker) => marker.remove());
      discoveryMarkersRef.current = [];
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
          const discoveryLayers = ["hero-discovery-hit", "hero-discovery-points"].filter((layerId) => map.getLayer(layerId));
          if (discoveryLayers.length > 0) {
            const discoveryNearClick = map.queryRenderedFeatures(
              [
                [event.point.x - 8, event.point.y - 8],
                [event.point.x + 8, event.point.y + 8],
              ],
              { layers: discoveryLayers }
            );
            if (discoveryNearClick.length > 0) {
              return;
            }
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

      const claimOverlay = buildClaimOverlayData(claimedTiles);
      const claimFillSource = map.getSource("hero-claims-fill");
      if (claimFillSource) {
        claimFillSource.setData(claimOverlay.fillFeatureCollection);
      } else {
        map.addSource("hero-claims-fill", {
          type: "geojson",
          data: claimOverlay.fillFeatureCollection,
        });

        map.addLayer({
          id: "hero-claims-fill",
          type: "fill",
          source: "hero-claims-fill",
          paint: {
            "fill-color": ["get", "ownerBorderColor"],
            "fill-opacity": 0.06,
          },
        });

        map.on("click", "hero-claims-fill", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const props = feature.properties || {};

          const ownerName = escapeHtml(props.ownerName || "Unbekannt");
          const ownerScanCount = Math.max(0, Number(props.ownerScanCount || 0));
          const ownerBorderColor = props.ownerBorderColor || "#f0e5a5";
          const tileX = Number(props.tileX);
          const tileY = Number(props.tileY);

          const popupHtml = `
            <div style="font-family:sans-serif;min-width:172px;max-width:220px;padding:4px 2px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${ownerBorderColor};flex-shrink:0;"></span>
                <strong style="font-size:14px;color:#fde68a;">Claimed Tile</strong>
              </div>
              <div style="font-size:12px;color:#d6d3d1;line-height:1.55;">
                <div><span style="color:#86efac;font-weight:600;">Owner:</span> ${ownerName}</div>
                <div><span style="color:#86efac;font-weight:600;">Scans im Tile:</span> ${ownerScanCount}</div>
                <div style="color:#a8a29e;margin-top:4px;">Tile ${tileX}/${tileY}</div>
              </div>
            </div>
          `;

          new mapboxgl.Popup({ closeButton: true, maxWidth: "240px", className: "hero-claim-popup" })
            .setLngLat(event.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseenter", "hero-claims-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "hero-claims-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      const claimBorderSource = map.getSource("hero-claims-borders");
      if (claimBorderSource) {
        claimBorderSource.setData(claimOverlay.borderFeatureCollection);
      } else {
        map.addSource("hero-claims-borders", {
          type: "geojson",
          data: claimOverlay.borderFeatureCollection,
        });

        map.addLayer({
          id: "hero-claims-borders",
          type: "line",
          source: "hero-claims-borders",
          paint: {
            "line-color": ["get", "ownerBorderColor"],
            "line-width": 3,
            "line-opacity": 0.92,
            "line-blur": 0.4,
          },
        });
      }

      if (claimPulseIntervalRef.current) {
        window.clearInterval(claimPulseIntervalRef.current);
        claimPulseIntervalRef.current = null;
      }

      if (map.getLayer("hero-claims-borders")) {
        let pulseOn = false;
        claimPulseIntervalRef.current = window.setInterval(() => {
          if (!map.getLayer("hero-claims-borders")) return;
          pulseOn = !pulseOn;
          map.setPaintProperty("hero-claims-borders", "line-opacity", pulseOn ? 0.98 : 0.58);
          map.setPaintProperty("hero-claims-borders", "line-width", pulseOn ? 4 : 2.4);
        }, 820);
      }

      discoveryMarkersRef.current.forEach((marker) => marker.remove());
      discoveryMarkersRef.current = [];

      discoveryPoints
        .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
        .forEach((point) => {
          const pointClaim = findClaimForPoint(point, claimedTiles);
          const scannerAuthId = String(point?.scannerAuthId || "").trim();
          if (pointClaim && scannerAuthId && String(pointClaim.ownerAuthId || "") === scannerAuthId) {
            return;
          }

          const lng = Number(point.lng);
          const lat = Number(point.lat);
          const properties = {
            discoveryId: point?.discoveryId || "",
            imageUrl: point?.imageUrl || "",
            scannerName: point?.scannerName || "Unbekannt",
            scannerDisplayName: point?.scannerDisplayName || point?.scannerName || "Unbekannt",
            scannerEmail: point?.scannerEmail || "",
            scannerAuthId: point?.scannerAuthId || "",
            viewerAuthId: currentAuthId || "",
            plantName: point?.plantName || "Unbekannte Pflanze",
            plantId: point?.plantId || "",
            genusId: point?.genusId || "",
            likedByCurrentUser: String(point?.likedByCurrentUser === true),
            discoveredAt: point?.discoveredAt || "",
          };

          const markerElement = createDiscoveryMarkerElement(point);
          markerElement.addEventListener("click", (domEvent) => {
            domEvent.preventDefault();
            domEvent.stopPropagation();
            openDiscoveryPopup({
              map,
              event: { lngLat: { lng, lat } },
              feature: { properties },
              onDiscoveryImageClick,
              onDiscoveryLike,
              allowDiscoveryLike,
            });
          });

          const marker = new mapboxgl.Marker({ element: markerElement, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
          discoveryMarkersRef.current.push(marker);
        });
    };

    if (map.isStyleLoaded()) {
      updateMapData();
      return;
    }

    map.once("style.load", updateMapData);
  }, [
    allowDiscoveryLike,
    claimedTiles,
    currentAuthId,
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
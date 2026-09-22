import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import proj4 from "proj4";
import { hexToFilter } from "@/lib/hexToFilter";
import { NEARBY_DISCOVERY_RADIUS_METERS } from "@/lib/discoveryMap";

// Must match the EPSG:3035 definition used by the backend area grid (see e.g.
// supabase/functions/robotPlantDailyZones/index.ts) so the sonar grid lines up with real game areas.
const EPSG_3035 = "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +datum=ETRS89 +units=m +no_defs +type=crs";
proj4.defs("EPSG:3035", EPSG_3035);
const toGameAreaMeters = (lng, lat) => {
  const [x, y] = proj4("EPSG:4326", "EPSG:3035", [lng, lat]);
  return { x, y };
};
const toLngLatFromGameAreaMeters = (x, y) => {
  const [lng, lat] = proj4("EPSG:3035", "EPSG:4326", [x, y]);
  return { lng, lat };
};

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

const AREA_HALF_SIZE_M = 50;
// Same size as the authoritative backend area grid (EPSG:3035, 100m areas - see AREA_SIZE_M in
// supabase/functions/robotPlantDailyZones, getAreaClaims, etc.), so the sonar grid matches real game areas.
const GRID_SPACING_M = 100;
const GRID_LINE_COLOR = "rgba(94, 234, 212, 0.16)";
const GRID_LINE_COLOR_MAJOR = "rgba(94, 234, 212, 0.32)";

// Free, tokenless vector areas (OpenFreeMap, community-hosted OpenMapAreas schema) used purely as a
// faint silhouette (coastline/water/roads) underneath the sonar grid — no buildings, no 3D, no labels.
const OPENFREEMAP_SOURCE_URL = "https://tiles.openfreemap.org/planet";

// Dark echo-lot/sonar basemap: near-black background, glowing teal water/roads, no labels or 3D buildings.
const SONAR_MAP_STYLE = {
  version: 8,
  sources: {
    ofm: {
      type: "vector",
      url: OPENFREEMAP_SOURCE_URL,
      attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmapareas.org/" target="_blank">OpenMapAreas</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#050b0c" } },
    {
      id: "landcover",
      type: "fill",
      source: "ofm",
      "source-layer": "landcover",
      paint: { "fill-color": "#0a1f16", "fill-opacity": 0.55 },
    },
    {
      id: "landuse",
      type: "fill",
      source: "ofm",
      "source-layer": "landuse",
      paint: { "fill-color": "#0c1a1a", "fill-opacity": 0.4 },
    },
    {
      id: "water",
      type: "fill",
      source: "ofm",
      "source-layer": "water",
      paint: { "fill-color": "#082e33", "fill-opacity": 0.9 },
    },
    {
      id: "waterway",
      type: "line",
      source: "ofm",
      "source-layer": "waterway",
      paint: { "line-color": "#0f4a52", "line-width": 1, "line-opacity": 0.8 },
    },
    {
      id: "boundary",
      type: "line",
      source: "ofm",
      "source-layer": "boundary",
      filter: ["<=", ["get", "admin_level"], 4],
      paint: { "line-color": "#123a3a", "line-width": 0.6, "line-dasharray": [2, 2], "line-opacity": 0.5 },
    },
    {
      id: "transportation-glow",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "path", "track"]]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#1f6d63",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.6, 18, 5],
        "line-blur": 1.4,
        "line-opacity": 0.35,
      },
    },
    {
      id: "transportation",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "path", "track"]]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#2dd4bf",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 18, 1.8],
        "line-opacity": 0.55,
      },
    },
  ],
};

// Above this many lines per axis the grid is skipped entirely (guards against WebGL/context-loss
// crashes when the user zooms out far enough that a 100m grid would need tens of thousands of lines).
const GRID_MAX_LINES_PER_AXIS = 400;
// Points sampled along each grid line when reprojecting back to lng/lat, so the (tiny) LAEA curvature
// at map-viewport scale is respected instead of drawing a naive straight line between two endpoints.
const GRID_LINE_SEGMENTS = 4;

// Builds a grid of GeoJSON lines matching the real EPSG:3035 100m game areas within the given lng/lat
// bounds: reprojects the viewport into the same metric CRS the backend uses, snaps to area boundaries,
// then reprojects each line back to lng/lat.
const buildSonarGridFeatureCollection = (bounds) => {
  if (!bounds) return { type: "FeatureCollection", features: [] };

  const corners = [bounds.getSouthWest(), bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthEast()];
  const metricCorners = corners.map((corner) => toGameAreaMeters(corner.lng, corner.lat));

  const padding = GRID_SPACING_M * 2;
  const xMin = Math.min(...metricCorners.map((p) => p.x)) - padding;
  const xMax = Math.max(...metricCorners.map((p) => p.x)) + padding;
  const yMin = Math.min(...metricCorners.map((p) => p.y)) - padding;
  const yMax = Math.max(...metricCorners.map((p) => p.y)) + padding;

  const lineCountX = (xMax - xMin) / GRID_SPACING_M;
  const lineCountY = (yMax - yMin) / GRID_SPACING_M;
  if (!Number.isFinite(lineCountX) || !Number.isFinite(lineCountY) ||
      lineCountX > GRID_MAX_LINES_PER_AXIS || lineCountY > GRID_MAX_LINES_PER_AXIS) {
    return { type: "FeatureCollection", features: [] };
  }

  const features = [];
  const startX = Math.floor(xMin / GRID_SPACING_M) * GRID_SPACING_M;
  const startY = Math.floor(yMin / GRID_SPACING_M) * GRID_SPACING_M;

  for (let x = startX; x <= xMax; x += GRID_SPACING_M) {
    const isMajor = Math.round(x / GRID_SPACING_M) % 10 === 0;
    const coordinates = [];
    for (let i = 0; i <= GRID_LINE_SEGMENTS; i += 1) {
      const y = yMin + ((yMax - yMin) * i) / GRID_LINE_SEGMENTS;
      const { lng, lat } = toLngLatFromGameAreaMeters(x, y);
      coordinates.push([lng, lat]);
    }
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: { major: isMajor } });
  }

  for (let y = startY; y <= yMax; y += GRID_SPACING_M) {
    const isMajor = Math.round(y / GRID_SPACING_M) % 10 === 0;
    const coordinates = [];
    for (let i = 0; i <= GRID_LINE_SEGMENTS; i += 1) {
      const x = xMin + ((xMax - xMin) * i) / GRID_LINE_SEGMENTS;
      const { lng, lat } = toLngLatFromGameAreaMeters(x, y);
      coordinates.push([lng, lat]);
    }
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: { major: isMajor } });
  }

  return { type: "FeatureCollection", features };
};
const CLAIM_PULSE_CYCLE_MS = 2600;
const OVERLAP_PADDING_FACTOR = 0.86;
const DISCOVERY_CUSTOM_MARKER_BASE_SIZE_PX = 34;
const DISCOVERY_FALLBACK_MARKER_BASE_SIZE_PX = 16;
const DISCOVERY_CUSTOM_LOGO_BASE_SCALE = 2.15;
const DISCOVERY_MARKER_UNIFIED_SCALE_DEFAULT = 0.8;
const DISCOVERY_MARKER_UNIFIED_SCALE_MIN = 0.5;
const DISCOVERY_MARKER_UNIFIED_SCALE_MAX = 1.0;
const PLAYER_RECENTER_DURATION_MS = 750;
// Delay before auto-recentering on the player after the map settles; a fresh user gesture
// (zoomstart/dragstart/rotatestart) cancels the pending recenter so it never fights live input.
const RECENTER_DEBOUNCE_MS = 500;

const toPx = (value) => `${Math.round(value)}px`;

const clampDiscoveryMarkerScale = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DISCOVERY_MARKER_UNIFIED_SCALE_DEFAULT;
  }
  return Math.min(DISCOVERY_MARKER_UNIFIED_SCALE_MAX, Math.max(DISCOVERY_MARKER_UNIFIED_SCALE_MIN, numeric));
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildZonePopupHtml = (props, isLightUi) => {
  const themeLabel = escapeHtml(props.themeLabel || props.theme || "Zone");
  const color = props.color || THEME_MAP_COLORS.meadow;
  const radiusDisplay = props.radiusM ? `${Math.round(props.radiusM)} m` : "";
  const zoneMultiplier = Number(props.zoneMultiplier || 1.5);
  const scanCount = Math.max(0, Number(props.scansToday || 0));

  const cardBg = isLightUi ? "rgba(255,255,255,0.92)" : "rgba(12,14,17,0.86)";
  const cardBorder = isLightUi ? "rgba(200,172,98,0.5)" : "rgba(240,229,165,0.35)";
  const titleColor = isLightUi ? "#292524" : "#fde68a";
  const bodyColor = isLightUi ? "#44403c" : "#d6d3d1";
  const mutedColor = isLightUi ? "#78716c" : "#a8a29e";

  return `
    <div style="font-family:sans-serif;min-width:176px;max-width:228px;padding:6px 4px;background:${cardBg};border:1px solid ${cardBorder};border-radius:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        <strong style="font-size:14px;color:${titleColor};">${themeLabel} Zone</strong>
      </div>
      <div style="font-size:12px;color:${bodyColor};line-height:1.55;">
        <div style="margin-bottom:4px;">
          <span style="font-weight:700;">Multiplikator:</span> x ${zoneMultiplier.toFixed(1).replace(".", ",")}
        </div>
        <div style="margin-bottom:4px;color:${mutedColor};">
          Start bei x1.50, sinkt pro weiterem Scan in dieser Zone.
        </div>
        <div style="margin-bottom:4px;"><span style="font-weight:700;">Scans:</span> ${scanCount}/5</div>
        ${radiusDisplay ? `<div style="color:${mutedColor};">Radius: ${radiusDisplay}</div>` : ""}
      </div>
    </div>
  `;
};

const buildClaimPopupHtml = (props, isLightUi) => {
  const ownerName = escapeHtml(props.ownerName || "Unbekannt");
  const ownerScanCount = Math.max(0, Number(props.ownerScanCount || 0));
  const ownerBorderColor = props.ownerBorderColor || "#f0e5a5";
  const areaX = Number(props.areaX);
  const areaY = Number(props.areaY);
  const zoneTitle = `${ownerName}'s Zone`;

  const cardBg = isLightUi ? "rgba(255,255,255,0.94)" : "rgba(12,14,17,0.88)";
  const titleColor = isLightUi ? "#292524" : "#fde68a";
  const bodyColor = isLightUi ? "#44403c" : "#d6d3d1";
  const mutedColor = isLightUi ? "#78716c" : "#a8a29e";

  return `
    <div style="font-family:sans-serif;min-width:188px;max-width:248px;padding:6px 4px;background:${cardBg};border-radius:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${ownerBorderColor};flex-shrink:0;"></span>
        <strong style="font-size:14px;color:${titleColor};">${zoneTitle}</strong>
      </div>
      <div style="font-size:12px;color:${bodyColor};line-height:1.58;">
        <div><span style="font-weight:700;">Owner:</span> ${ownerName}</div>
        <div><span style="font-weight:700;">Scans im Area:</span> ${ownerScanCount}</div>
        <div style="color:${mutedColor};margin-top:4px;">Area ${areaX}/${areaY}</div>
      </div>
    </div>
  `;
};

const buildClaimPulseGradient = (phase) => {
  if (!Number.isFinite(phase) || phase < 0 || phase > 1) {
    return ["interpolate", ["linear"], ["line-progress"], 0, "rgba(255,255,255,0)", 1, "rgba(255,255,255,0)"];
  }

  const trailStart = Math.max(0, phase - 0.09);
  const headEnd = Math.min(1, phase + 0.1);

  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    "rgba(255,255,255,0)",
    trailStart,
    "rgba(255,255,255,0)",
    phase,
    "rgba(255,255,255,0.98)",
    headEnd,
    "rgba(255,255,255,0)",
    1,
    "rgba(255,255,255,0)",
  ];
};

const getPulsePhaseWithPause = (cycleMs) => {
  const t = Date.now() % cycleMs;
  const normalized = t / cycleMs;
  if (normalized > 0.72) {
    return -1;
  }
  return normalized / 0.72;
};

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
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "210px", className: "hero-discovery-popup" })
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

const createDiscoveryMarkerElement = (point, markerScale) => {
  const safeMarkerScale = clampDiscoveryMarkerScale(markerScale);
  const customMarkerSizePx = Math.round(DISCOVERY_CUSTOM_MARKER_BASE_SIZE_PX * safeMarkerScale);
  const fallbackMarkerSizePx = Math.round(DISCOVERY_FALLBACK_MARKER_BASE_SIZE_PX * safeMarkerScale);
  const customLogoScale = DISCOVERY_CUSTOM_LOGO_BASE_SCALE * safeMarkerScale;

  const markerEl = document.createElement("button");
  markerEl.type = "button";
  markerEl.setAttribute("aria-label", `Scan von ${point?.scannerDisplayName || point?.scannerName || "Unbekannt"}`);
  markerEl.style.padding = "0";
  markerEl.style.border = "0";
  markerEl.style.background = "transparent";
  markerEl.style.cursor = "pointer";
  markerEl.style.overflow = "visible";

  const borderUrl = String(point?.scannerLogoBorderUrl || "").trim();
  const plantUrl = String(point?.scannerLogoPlantUrl || "").trim();
  const faceUrl = String(point?.scannerLogoFaceUrl || "").trim();
  const borderColor = String(point?.scannerLogoBorderColor || "").trim();
  const hasCustomLogo = Boolean(borderUrl || plantUrl || faceUrl);

  if (!hasCustomLogo) {
    markerEl.style.width = toPx(fallbackMarkerSizePx);
    markerEl.style.height = toPx(fallbackMarkerSizePx);
    markerEl.style.borderRadius = "999px";
    markerEl.style.background = "#16a34a";
    markerEl.style.border = "1px solid #dcfce7";
    markerEl.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.35)";
    return markerEl;
  }

  markerEl.style.width = toPx(customMarkerSizePx);
  markerEl.style.height = toPx(customMarkerSizePx);
  markerEl.style.borderRadius = "999px";
  markerEl.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.35)";

  const ring = document.createElement("span");
  ring.style.display = "block";
  ring.style.width = "100%";
  ring.style.height = "100%";
  ring.style.borderRadius = "999px";
  ring.style.border = "0";
  ring.style.background = "rgba(0,0,0,0.35)";
  ring.style.padding = toPx(3 * safeMarkerScale);
  ring.style.boxSizing = "border-box";
  ring.style.overflow = "visible";
  markerEl.appendChild(ring);

  const content = document.createElement("span");
  content.style.position = "relative";
  content.style.display = "block";
  content.style.width = "100%";
  content.style.height = "100%";
  content.style.overflow = "visible";
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
    img.style.transform = `scale(${customLogoScale})`;
    img.style.transformOrigin = "center center";
    if (filterValue) {
      img.style.filter = filterValue;
    }
    content.appendChild(img);
  };

  appendLayer(borderUrl, borderColor ? `brightness(0) saturate(100%) ${hexToFilter(borderColor)}` : "");
  appendLayer(plantUrl, "");
  appendLayer(faceUrl, "");

  if (Number(point?.mergedCount || 1) > 1) {
    const badge = document.createElement("span");
    badge.textContent = String(Math.max(2, Number(point.mergedCount || 2)));
    badge.style.position = "absolute";
    badge.style.right = toPx(-8 * safeMarkerScale);
    badge.style.bottom = toPx(-3 * safeMarkerScale);
    badge.style.minWidth = toPx(16 * safeMarkerScale);
    badge.style.height = toPx(16 * safeMarkerScale);
    badge.style.borderRadius = "999px";
    badge.style.background = "rgba(17, 24, 39, 0.75)";
    badge.style.border = "1px solid rgba(240,229,165,0.75)";
    badge.style.color = "#f8fafc";
    badge.style.fontSize = toPx(10 * safeMarkerScale);
    badge.style.fontWeight = "700";
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.padding = `0 ${toPx(4 * safeMarkerScale)}`;
    badge.style.boxSizing = "border-box";
    markerEl.appendChild(badge);
  }

  return markerEl;
};

const buildMergedDiscoveryPopupHtml = (point) => {
  const scanCount = Math.max(2, Number(point?.mergedCount || 2));
  const scannerDisplayName = escapeHtml(point?.scannerDisplayName || point?.scannerName || "Unbekannt");
  return `
    <div style="font-family:sans-serif;min-width:168px;max-width:220px;padding:6px 4px;background:rgba(12,14,17,0.9);border:1px solid rgba(240,229,165,0.35);border-radius:12px;">
      <div style="font-size:14px;font-weight:700;color:#fde68a;margin-bottom:6px;">Mehrere Scans</div>
      <div style="font-size:12px;color:#e7e5e4;line-height:1.55;">
        <div><span style="font-weight:700;">Spieler:</span> ${scannerDisplayName}</div>
        <div><span style="font-weight:700;">Überlappte Scans:</span> ${scanCount}</div>
        <div style="color:#a8a29e;margin-top:4px;">Zoome weiter hinein, um Einzelmarker zu sehen.</div>
      </div>
    </div>
  `;
};

const openMergedDiscoveryPopup = ({ map, lng, lat, point }) => {
  new maplibregl.Popup({ closeButton: true, maxWidth: "240px", className: "hero-discovery-popup" })
    .setLngLat({ lng, lat })
    .setHTML(buildMergedDiscoveryPopupHtml(point))
    .addTo(map);
};

const getMarkerVisualSizePx = (point, markerScale) => {
  const safeMarkerScale = clampDiscoveryMarkerScale(markerScale);
  const customMarkerSizePx = Math.round(DISCOVERY_CUSTOM_MARKER_BASE_SIZE_PX * safeMarkerScale);
  const fallbackMarkerSizePx = Math.round(DISCOVERY_FALLBACK_MARKER_BASE_SIZE_PX * safeMarkerScale);

  const hasCustomLogo = Boolean(
    String(point?.scannerLogoBorderUrl || "").trim() ||
      String(point?.scannerLogoPlantUrl || "").trim() ||
      String(point?.scannerLogoFaceUrl || "").trim()
  );
  return hasCustomLogo ? customMarkerSizePx : fallbackMarkerSizePx;
};

const createClaimLogoMarkerElement = (claim, markerScale) => {
  const safeMarkerScale = clampDiscoveryMarkerScale(markerScale);
  const claimMarkerSizePx = Math.round(40 * safeMarkerScale);
  const fallbackDotSizePx = Math.round(14 * safeMarkerScale);
  const claimLogoScale = DISCOVERY_CUSTOM_LOGO_BASE_SCALE * safeMarkerScale;

  const markerEl = document.createElement("div");
  markerEl.style.width = toPx(claimMarkerSizePx);
  markerEl.style.height = toPx(claimMarkerSizePx);
  markerEl.style.borderRadius = "999px";
  markerEl.style.pointerEvents = "none";
  markerEl.style.overflow = "visible";
  markerEl.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.35)";

  const borderUrl = String(claim?.ownerLogoBorderUrl || "").trim();
  const plantUrl = String(claim?.ownerLogoPlantUrl || "").trim();
  const faceUrl = String(claim?.ownerLogoFaceUrl || "").trim();
  const borderColor = String(claim?.ownerBorderColor || "").trim();

  if (!borderUrl && !plantUrl && !faceUrl) {
    const fallbackDot = document.createElement("span");
    fallbackDot.style.width = toPx(fallbackDotSizePx);
    fallbackDot.style.height = toPx(fallbackDotSizePx);
    fallbackDot.style.borderRadius = "999px";
    fallbackDot.style.background = borderColor || "#f0e5a5";
    fallbackDot.style.border = "1px solid rgba(255,255,255,0.8)";
    fallbackDot.style.display = "block";
    fallbackDot.style.margin = "0 auto";
    markerEl.appendChild(fallbackDot);
    return markerEl;
  }

  const ring = document.createElement("span");
  ring.style.display = "block";
  ring.style.width = "100%";
  ring.style.height = "100%";
  ring.style.borderRadius = "999px";
  ring.style.border = "0";
  ring.style.background = "rgba(0,0,0,0.35)";
  ring.style.padding = toPx(3 * safeMarkerScale);
  ring.style.boxSizing = "border-box";
  ring.style.overflow = "visible";
  markerEl.appendChild(ring);

  const content = document.createElement("span");
  content.style.position = "relative";
  content.style.display = "block";
  content.style.width = "100%";
  content.style.height = "100%";
  content.style.overflow = "visible";
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
    img.style.transform = `scale(${claimLogoScale})`;
    img.style.transformOrigin = "center center";
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

const buildApproxAreaPolygon = (centerLat, centerLng) => {
  const nw = getLngLatOffsetByMeters(centerLat, centerLng, -AREA_HALF_SIZE_M, AREA_HALF_SIZE_M);
  const ne = getLngLatOffsetByMeters(centerLat, centerLng, AREA_HALF_SIZE_M, AREA_HALF_SIZE_M);
  const se = getLngLatOffsetByMeters(centerLat, centerLng, AREA_HALF_SIZE_M, -AREA_HALF_SIZE_M);
  const sw = getLngLatOffsetByMeters(centerLat, centerLng, -AREA_HALF_SIZE_M, -AREA_HALF_SIZE_M);

  return [
    [nw.lng, nw.lat],
    [ne.lng, ne.lat],
    [se.lng, se.lat],
    [sw.lng, sw.lat],
    [nw.lng, nw.lat],
  ];
};

const buildClaimOverlayData = (claimedAreas = []) => {
  const claimByAreaKey = new Map();
  claimedAreas.forEach((claim) => {
    const areaX = Number(claim?.areaX);
    const areaY = Number(claim?.areaY);
    if (!Number.isFinite(areaX) || !Number.isFinite(areaY)) return;
    claimByAreaKey.set(`${areaX}:${areaY}`, claim);
  });

  const fillFeatures = [];
  const borderFeatures = [];

  claimedAreas.forEach((claim) => {
    const areaX = Number(claim?.areaX);
    const areaY = Number(claim?.areaY);
    const centerLat = Number(claim?.centerLat);
    const centerLng = Number(claim?.centerLng);
    if (!Number.isFinite(areaX) || !Number.isFinite(areaY) || !Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      return;
    }

    const ownerAuthId = String(claim?.ownerAuthId || "");
    const ownerName = claim?.ownerName || "Unbekannt";
    const claimGroupName = String(claim?.claimGroupName || "").trim() || null;
    const ownerScanCount = Math.max(0, Number(claim?.ownerScanCount || 0));
    const ownerBorderColor = String(claim?.ownerBorderColor || "").trim() || "#f0e5a5";

    const polygon = buildApproxAreaPolygon(centerLat, centerLng);
    fillFeatures.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [polygon],
      },
      properties: {
        areaX,
        areaY,
        ownerAuthId,
        ownerName,
        claimGroupName,
        ownerScanCount,
        ownerBorderColor,
      },
    });

    const areaKey = `${areaX}:${areaY}`;
    const neighbors = {
      north: claimByAreaKey.get(`${areaX}:${areaY + 1}`),
      east: claimByAreaKey.get(`${areaX + 1}:${areaY}`),
      south: claimByAreaKey.get(`${areaX}:${areaY - 1}`),
      west: claimByAreaKey.get(`${areaX - 1}:${areaY}`),
    };

    const edges = [
      { id: `${areaKey}:north`, points: [polygon[0], polygon[1]], neighbor: neighbors.north },
      { id: `${areaKey}:east`, points: [polygon[1], polygon[2]], neighbor: neighbors.east },
      { id: `${areaKey}:south`, points: [polygon[2], polygon[3]], neighbor: neighbors.south },
      { id: `${areaKey}:west`, points: [polygon[3], polygon[0]], neighbor: neighbors.west },
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
          claimGroupName,
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

const findClaimForPoint = (point, claimedAreas = []) => {
  const pointLat = Number(point?.lat);
  const pointLng = Number(point?.lng);
  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return null;

  for (const claim of claimedAreas) {
    const centerLat = Number(claim?.centerLat);
    const centerLng = Number(claim?.centerLng);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) continue;

    const latMetersPerDegree = 111320;
    const lngMetersPerDegree = 111320 * Math.cos((centerLat * Math.PI) / 180);
    const dx = (pointLng - centerLng) * (Math.abs(lngMetersPerDegree) < 1e-6 ? 1e-6 : lngMetersPerDegree);
    const dy = (pointLat - centerLat) * latMetersPerDegree;

    if (Math.abs(dx) <= AREA_HALF_SIZE_M && Math.abs(dy) <= AREA_HALF_SIZE_M) {
      return claim;
    }
  }

  return null;
};

const mergeOverlappingDiscoveryPoints = (map, points = [], markerScale) => {
  const safePoints = (points || []).filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
  if (safePoints.length <= 1) {
    return safePoints.map((point) => ({ ...point, mergedCount: 1, mergedDiscoveryIds: [point?.discoveryId].filter(Boolean) }));
  }

  const byScanner = new Map();
  safePoints.forEach((point, idx) => {
    const key = String(point?.scannerAuthId || point?.scannerEmail || `unknown-${idx}`);
    if (!byScanner.has(key)) byScanner.set(key, []);
    byScanner.get(key).push({ point, idx });
  });

  const result = [];

  byScanner.forEach((entries) => {
    if (entries.length === 1) {
      const single = entries[0].point;
      result.push({ ...single, mergedCount: 1, mergedDiscoveryIds: [single?.discoveryId].filter(Boolean) });
      return;
    }

    const projected = entries.map((entry) => {
      const coords = map.project([Number(entry.point.lng), Number(entry.point.lat)]);
      return {
        ...entry,
        x: Number(coords.x),
        y: Number(coords.y),
        sizePx: getMarkerVisualSizePx(entry.point, markerScale),
      };
    });

    const parent = projected.map((_, index) => index);
    const find = (i) => {
      let p = i;
      while (parent[p] !== p) {
        parent[p] = parent[parent[p]];
        p = parent[p];
      }
      return p;
    };
    const union = (a, b) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
    };

    for (let i = 0; i < projected.length; i += 1) {
      for (let j = i + 1; j < projected.length; j += 1) {
        const dx = projected[i].x - projected[j].x;
        const dy = projected[i].y - projected[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const overlapThreshold = ((projected[i].sizePx + projected[j].sizePx) / 2) * OVERLAP_PADDING_FACTOR;
        if (distance <= overlapThreshold) {
          union(i, j);
        }
      }
    }

    const groups = new Map();
    projected.forEach((entry, index) => {
      const root = find(index);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(entry.point);
    });

    groups.forEach((groupPoints) => {
      if (groupPoints.length <= 1) {
        const single = groupPoints[0];
        result.push({ ...single, mergedCount: 1, mergedDiscoveryIds: [single?.discoveryId].filter(Boolean) });
        return;
      }

      const lat = groupPoints.reduce((acc, point) => acc + Number(point.lat || 0), 0) / groupPoints.length;
      const lng = groupPoints.reduce((acc, point) => acc + Number(point.lng || 0), 0) / groupPoints.length;
      const representative = groupPoints[0];

      result.push({
        ...representative,
        lat,
        lng,
        mergedCount: groupPoints.length,
        mergedDiscoveryIds: groupPoints.map((point) => point?.discoveryId).filter(Boolean),
      });
    });
  });

  return result;
};

export default function MapboxZoneMap({
  zones = [],
  userLocation = null,
  fallbackCenter = null,
  focusCenter = null,
  discoveryPoints = [],
  claimedAreas = [],
  currentAuthId = null,
  isLightUi = false,
  onTokenError = null,
  onMapReady = null,
  onDiscoveryImageClick = null,
  onDiscoveryLike = null,
  onPinSelect = null,
  onZoneSelect = null,
  onClaimSelect = null,
  allowDiscoveryLike = true,
  discoveryMarkerScale = DISCOVERY_MARKER_UNIFIED_SCALE_DEFAULT,
  hideClaimLogos = false,
  className = "h-full w-full z-0",
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const onTokenErrorRef = useRef(null);
  const onZoneSelectRef = useRef(null);
  const onClaimSelectRef = useRef(null);
  const discoveryMarkersRef = useRef([]);
  const claimLogoMarkersRef = useRef([]);
  const claimPulseIntervalRef = useRef(null);
  const rerenderDiscoveryMarkersRef = useRef(() => {});
  const recenterTimeoutRef = useRef(null);
  const isUserInteractingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (claimPulseIntervalRef.current) {
        window.clearInterval(claimPulseIntervalRef.current);
        claimPulseIntervalRef.current = null;
      }
      claimLogoMarkersRef.current.forEach((marker) => marker.remove());
      claimLogoMarkersRef.current = [];
      discoveryMarkersRef.current.forEach((marker) => marker.remove());
      discoveryMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    onTokenErrorRef.current = typeof onTokenError === "function" ? onTokenError : null;
  }, [onTokenError]);

  useEffect(() => {
    onZoneSelectRef.current = typeof onZoneSelect === "function" ? onZoneSelect : null;
  }, [onZoneSelect]);

  useEffect(() => {
    onClaimSelectRef.current = typeof onClaimSelect === "function" ? onClaimSelect : null;
  }, [onClaimSelect]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const userLng = Number(userLocation?.lng);
    const userLat = Number(userLocation?.lat);
    const initialLng = Number.isFinite(userLng) ? userLng : Number(fallbackCenter?.lng);
    const initialLat = Number.isFinite(userLat) ? userLat : Number(fallbackCenter?.lat);

    if (!Number.isFinite(initialLng) || !Number.isFinite(initialLat)) {
      onTokenErrorRef.current?.("Karte konnte nicht initialisiert werden (fehlender Startpunkt).");
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: SONAR_MAP_STYLE,
      center: [initialLng, initialLat],
      zoom: 15,
      minZoom: 12,
      maxZoom: 19,
      pitch: 0,
      bearing: 0,
      antialias: true,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    if (typeof onMapReady === "function") {
      onMapReady(map);
    }

    map.on("error", (event) => {
      const status = event?.error?.status;
      const message = String(event?.error?.message || "");
      if ((status && status >= 400) || message) {
        console.warn("[MapboxZoneMap] Basemap source error", {
          status: status || null,
          message: message || "unknown map error",
        });
        onTokenErrorRef.current?.("Kartendaten konnten nicht geladen werden. Bitte spaeter erneut versuchen.");
      }
    });

    const handleDiscoveryMarkerReflow = () => {
      rerenderDiscoveryMarkersRef.current();
    };

    map.on("zoom", handleDiscoveryMarkerReflow);
    map.on("moveend", handleDiscoveryMarkerReflow);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(() => {
          map.resize();
        });
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    window.requestAnimationFrame(() => {
      map.resize();
    });

    return () => {
      map.off("zoom", handleDiscoveryMarkerReflow);
      map.off("moveend", handleDiscoveryMarkerReflow);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (claimPulseIntervalRef.current) {
        window.clearInterval(claimPulseIntervalRef.current);
        claimPulseIntervalRef.current = null;
      }
      claimLogoMarkersRef.current.forEach((marker) => marker.remove());
      claimLogoMarkersRef.current = [];
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

    const resolveRecenterTarget = () => {
      const focusLng = Number(focusCenter?.lng);
      const focusLat = Number(focusCenter?.lat);
      if (Number.isFinite(focusLng) && Number.isFinite(focusLat)) {
        return { targetLng: focusLng, targetLat: focusLat };
      }

      const userLng = Number(userLocation?.lng);
      const userLat = Number(userLocation?.lat);
      return {
        targetLng: Number.isFinite(userLng) ? userLng : Number(fallbackCenter?.lng),
        targetLat: Number.isFinite(userLat) ? userLat : Number(fallbackCenter?.lat),
      };
    };

    const syncMapCenterToPlayer = () => {
      // Never fight an in-flight user gesture (zoom/drag/rotate) or an already-running camera animation.
      if (isUserInteractingRef.current || map.isMoving()) {
        return;
      }

      const { targetLng, targetLat } = resolveRecenterTarget();

      if (!Number.isFinite(targetLng) || !Number.isFinite(targetLat)) {
        return;
      }

      const currentCenter = map.getCenter();
      const currentLng = Number(currentCenter?.lng);
      const currentLat = Number(currentCenter?.lat);
      const isAlreadyCentered =
        Number.isFinite(currentLng) &&
        Number.isFinite(currentLat) &&
        Math.abs(currentLng - targetLng) < 0.00001 &&
        Math.abs(currentLat - targetLat) < 0.00001;

      if (!isAlreadyCentered) {
        map.easeTo({
          center: [targetLng, targetLat],
          duration: PLAYER_RECENTER_DURATION_MS,
          essential: true,
        });
      }
    };

    const clearPendingRecenter = () => {
      if (recenterTimeoutRef.current) {
        window.clearTimeout(recenterTimeoutRef.current);
        recenterTimeoutRef.current = null;
      }
    };

    // Debounced so a moveend caused by the user's own gesture doesn't immediately trigger a
    // programmatic easeTo that a follow-up zoom/pan input would then collide with mid-animation.
    const scheduleRecenter = () => {
      clearPendingRecenter();
      recenterTimeoutRef.current = window.setTimeout(() => {
        recenterTimeoutRef.current = null;
        syncMapCenterToPlayer();
      }, RECENTER_DEBOUNCE_MS);
    };

    const handleInteractionStart = () => {
      isUserInteractingRef.current = true;
      clearPendingRecenter();
    };

    const handleInteractionEnd = () => {
      isUserInteractingRef.current = false;
      scheduleRecenter();
    };

    const updateMapData = () => {
      const userLng = Number(userLocation?.lng);
      const userLat = Number(userLocation?.lat);
      const { targetLng, targetLat } = resolveRecenterTarget();

      // Skip if the user is actively interacting (or a prior ease is still running) so this
      // data-driven recenter never collides with a live zoom/pan gesture.
      if (!isUserInteractingRef.current && !map.isMoving() && Number.isFinite(targetLng) && Number.isFinite(targetLat)) {
        map.easeTo({
          center: [targetLng, targetLat],
          duration: PLAYER_RECENTER_DURATION_MS,
          essential: true,
        });
      }

      if (!map.getSource("hero-sonar-grid")) {
        map.addSource("hero-sonar-grid", {
          type: "geojson",
          data: buildSonarGridFeatureCollection(map.getBounds()),
        });
        map.addLayer({
          id: "hero-sonar-grid",
          type: "line",
          source: "hero-sonar-grid",
          paint: {
            "line-color": ["case", ["get", "major"], GRID_LINE_COLOR_MAJOR, GRID_LINE_COLOR],
            "line-width": ["case", ["get", "major"], 1, 0.6],
          },
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
          const scansToday = Math.max(0, Number(zone.scansToday ?? zone.scans_today ?? 0) || 0);

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
              scansToday,
              centerLat: lat,
              centerLng: lng,
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
          id: "hero-zones-line",
          type: "line",
          source: "hero-zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2.4,
            "line-opacity": 0.95,
            "line-blur": 0.45,
          },
        });

        map.addLayer({
          id: "hero-zones-fill",
          type: "fill",
          source: "hero-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.07,
          },
        });

        map.addLayer({
          id: "hero-zones-hit",
          type: "fill",
          source: "hero-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0,
          },
        });

        map.on("click", "hero-zones-hit", (event) => {
          const claimHit = map.queryRenderedFeatures(
            [
              [event.point.x - 8, event.point.y - 8],
              [event.point.x + 8, event.point.y + 8],
            ],
            {
              layers: ["hero-claims-fill", "hero-claims-borders", "hero-claims-pulse"].filter((layerId) => map.getLayer(layerId)),
            }
          );

          if (claimHit.length > 0) {
            return;
          }

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

          if (onZoneSelectRef.current) {
            onZoneSelectRef.current({
              zoneId: props.id,
              centerLat: Number(props.centerLat),
              centerLng: Number(props.centerLng),
              radiusM: Number(props.radiusM),
              themeLabel: props.themeLabel || props.theme || "Zone",
            });
            return;
          }

          const popupHtml = buildZonePopupHtml(props, isLightUi);
          new maplibregl.Popup({ closeButton: true, maxWidth: "240px", className: "hero-zone-popup" })
            .setLngLat(event.lngLat)
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseenter", "hero-zones-hit", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "hero-zones-hit", () => {
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

      // Sichtweite (Visibility) des Spielers als Polygon anzeigen (z.B. 2500m)
      try {
        const visCenterLng = Number.isFinite(targetLng) ? targetLng : null;
        const visCenterLat = Number.isFinite(targetLat) ? targetLat : null;
        const visibilityFeatures = visCenterLng !== null && visCenterLat !== null
          ? [{
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  toCirclePolygon({ lat: visCenterLat, lng: visCenterLng, radiusM: Number(NEARBY_DISCOVERY_RADIUS_METERS || 2500), points: 64 }),
                ],
              },
              properties: {},
            }]
          : [];

        const visibilityGeoJson = {
          type: "FeatureCollection",
          features: visibilityFeatures,
        };

        const visSource = map.getSource("hero-visibility");
        if (visSource) {
          visSource.setData(visibilityGeoJson);
        } else {
          map.addSource("hero-visibility", { type: "geojson", data: visibilityGeoJson });

          // Fill under the user marker
          map.addLayer({
            id: "hero-visibility-fill",
            type: "fill",
            source: "hero-visibility",
            paint: {
              "fill-color": "#38bdf8",
              "fill-opacity": 0.06,
            },
          }, "hero-user-point");

          map.addLayer({
            id: "hero-visibility-line",
            type: "line",
            source: "hero-visibility",
            paint: {
              "line-color": "#38bdf8",
              "line-width": 2,
              "line-opacity": 0.9,
            },
          }, "hero-user-point");
        }
      } catch (e) {
        // defensive: if visibility creation fails, don't break the whole map update
        // eslint-disable-next-line no-console
        console.warn("Failed to update visibility layer", e);
      }

      const claimOverlay = buildClaimOverlayData(claimedAreas);
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
            "fill-opacity": 0.22,
          },
        });

        map.on("click", "hero-claims-fill", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const props = feature.properties || {};

          if (onClaimSelectRef.current) {
            onClaimSelectRef.current({
              areaX: Number(props.areaX),
              areaY: Number(props.areaY),
              ownerAuthId: props.ownerAuthId || "",
            });
            return;
          }

          const popupHtml = buildClaimPopupHtml(props, isLightUi);
          new maplibregl.Popup({ closeButton: true, maxWidth: "260px", className: "hero-claim-popup" })
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
          lineMetrics: true,
        });

        map.addLayer({
          id: "hero-claims-borders",
          type: "line",
          source: "hero-claims-borders",
          paint: {
            "line-color": ["get", "ownerBorderColor"],
            "line-width": 5.5,
            "line-opacity": 0.98,
            "line-blur": 0.9,
          },
        });

        map.addLayer({
          id: "hero-claims-pulse",
          type: "line",
          source: "hero-claims-borders",
          paint: {
            "line-width": 8,
            "line-opacity": 0.9,
            "line-blur": 1.6,
            "line-gradient": buildClaimPulseGradient(-1),
          },
        });
      }

      if (claimPulseIntervalRef.current) {
        window.clearInterval(claimPulseIntervalRef.current);
        claimPulseIntervalRef.current = null;
      }

      if (map.getLayer("hero-claims-pulse")) {
        claimPulseIntervalRef.current = window.setInterval(() => {
          if (!map.getLayer("hero-claims-pulse")) return;
          const phase = getPulsePhaseWithPause(CLAIM_PULSE_CYCLE_MS);
          map.setPaintProperty("hero-claims-pulse", "line-gradient", buildClaimPulseGradient(phase));
        }, 90);
      }

      claimLogoMarkersRef.current.forEach((marker) => marker.remove());
      claimLogoMarkersRef.current = [];

      if (!hideClaimLogos) {
        claimedAreas
          .filter((claim) => Number.isFinite(claim?.centerLat) && Number.isFinite(claim?.centerLng))
          .forEach((claim) => {
            const claimMarkerElement = createClaimLogoMarkerElement(claim, discoveryMarkerScale);
            const claimMarker = new maplibregl.Marker({ element: claimMarkerElement, anchor: "center" })
              .setLngLat([Number(claim.centerLng), Number(claim.centerLat)])
              .addTo(map);

            claimLogoMarkersRef.current.push(claimMarker);
          });
      }

      const renderDiscoveryMarkers = () => {
        discoveryMarkersRef.current.forEach((marker) => marker.remove());
        discoveryMarkersRef.current = [];

        const filteredPoints = discoveryPoints
          .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
          .filter((point) => {
            const pointClaim = findClaimForPoint(point, claimedAreas);
            const scannerAuthId = String(point?.scannerAuthId || "").trim();
            return !(pointClaim && scannerAuthId && String(pointClaim.ownerAuthId || "") === scannerAuthId);
          });

        const visualPoints = mergeOverlappingDiscoveryPoints(map, filteredPoints, discoveryMarkerScale);

        visualPoints.forEach((point) => {
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

          const markerElement = createDiscoveryMarkerElement(point, discoveryMarkerScale);
          markerElement.addEventListener("click", (domEvent) => {
            domEvent.preventDefault();
            domEvent.stopPropagation();

            if (typeof onPinSelect === "function") {
              onPinSelect({
                point,
                properties,
                mergedCount: Number(point?.mergedCount || 1),
                mergedDiscoveryIds: point?.mergedDiscoveryIds || [properties.discoveryId].filter(Boolean),
              });
              return;
            }

            if (Number(point?.mergedCount || 1) > 1) {
              openMergedDiscoveryPopup({ map, lng, lat, point });
              return;
            }

            openDiscoveryPopup({
              map,
              event: { lngLat: { lng, lat } },
              feature: { properties },
              onDiscoveryImageClick,
              onDiscoveryLike,
              allowDiscoveryLike,
            });
          });

          const marker = new maplibregl.Marker({ element: markerElement, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
          discoveryMarkersRef.current.push(marker);
        });
      };

      rerenderDiscoveryMarkersRef.current = renderDiscoveryMarkers;
      renderDiscoveryMarkers();
    };

    map.on("moveend", scheduleRecenter);
    map.on("zoomstart", handleInteractionStart);
    map.on("dragstart", handleInteractionStart);
    map.on("rotatestart", handleInteractionStart);
    map.on("pitchstart", handleInteractionStart);
    map.on("zoomend", handleInteractionEnd);
    map.on("dragend", handleInteractionEnd);
    map.on("rotateend", handleInteractionEnd);
    map.on("pitchend", handleInteractionEnd);

    const updateSonarGrid = () => {
      const gridSource = map.getSource("hero-sonar-grid");
      if (!gridSource) return;
      gridSource.setData(buildSonarGridFeatureCollection(map.getBounds()));
    };
    map.on("moveend", updateSonarGrid);
    map.on("zoomend", updateSonarGrid);

    if (map.isStyleLoaded()) {
      updateMapData();
      syncMapCenterToPlayer();
    } else {
      map.once("style.load", () => {
        updateMapData();
        syncMapCenterToPlayer();
      });
    }

    return () => {
      clearPendingRecenter();
      map.off("moveend", scheduleRecenter);
      map.off("zoomstart", handleInteractionStart);
      map.off("dragstart", handleInteractionStart);
      map.off("rotatestart", handleInteractionStart);
      map.off("pitchstart", handleInteractionStart);
      map.off("zoomend", handleInteractionEnd);
      map.off("dragend", handleInteractionEnd);
      map.off("rotateend", handleInteractionEnd);
      map.off("pitchend", handleInteractionEnd);
      map.off("moveend", updateSonarGrid);
      map.off("zoomend", updateSonarGrid);
    };
  }, [
    allowDiscoveryLike,
    claimedAreas,
    currentAuthId,
    discoveryPoints,
    fallbackCenter?.lat,
    fallbackCenter?.lng,
    focusCenter?.lat,
    focusCenter?.lng,
    hideClaimLogos,
    isLightUi,
    onDiscoveryImageClick,
    onDiscoveryLike,
    onPinSelect,
    discoveryMarkerScale,
    userLocation?.lat,
    userLocation?.lng,
    zones,
  ]);

  return <div ref={mapContainerRef} className={className} />;
}
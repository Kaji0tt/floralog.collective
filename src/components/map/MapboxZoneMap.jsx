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
const CLAIM_PULSE_CYCLE_MS = 2600;
const DISCOVERY_SINGLE_RADIUS_PX = 20;
const DISCOVERY_BASIC_RADIUS_PX = 11;
const CLUSTER_EXTRA_PADDING_PX = 2;
const MAX_CLUSTER_GEO_SPREAD_M = 450;
 

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
          <span style="font-weight:700;">Multiplikator:</span> x${zoneMultiplier.toFixed(2)}
        </div>
        <div style="margin-bottom:4px;color:${mutedColor};">
          Start bei x1.50, sinkt pro weiterem Scan in dieser Zone.
        </div>
        ${radiusDisplay ? `<div style="color:${mutedColor};">Radius: ${radiusDisplay}</div>` : ""}
      </div>
    </div>
  `;
};

const buildClaimPopupHtml = (props, isLightUi) => {
  const ownerName = escapeHtml(props.ownerName || "Unbekannt");
  const ownerScanCount = Math.max(0, Number(props.ownerScanCount || 0));
  const ownerBorderColor = props.ownerBorderColor || "#f0e5a5";
  const tileX = Number(props.tileX);
  const tileY = Number(props.tileY);

  const cardBg = isLightUi ? "rgba(255,255,255,0.94)" : "rgba(12,14,17,0.88)";
  const cardBorder = isLightUi ? "rgba(200,172,98,0.55)" : "rgba(240,229,165,0.38)";
  const titleColor = isLightUi ? "#292524" : "#fde68a";
  const bodyColor = isLightUi ? "#44403c" : "#d6d3d1";
  const mutedColor = isLightUi ? "#78716c" : "#a8a29e";

  return `
    <div style="font-family:sans-serif;min-width:176px;max-width:228px;padding:6px 4px;background:${cardBg};border:1px solid ${cardBorder};border-radius:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${ownerBorderColor};flex-shrink:0;"></span>
        <strong style="font-size:14px;color:${titleColor};">Claimed Tile</strong>
      </div>
      <div style="font-size:12px;color:${bodyColor};line-height:1.58;">
        <div><span style="font-weight:700;">Owner:</span> ${ownerName}</div>
        <div><span style="font-weight:700;">Scans im Tile:</span> ${ownerScanCount}</div>
        <div style="color:${mutedColor};margin-top:4px;">Tile ${tileX}/${tileY}</div>
      </div>
    </div>
  `;
};

const buildClaimPulseGradient = (phase) => {
  if (!Number.isFinite(phase) || phase < 0 || phase > 1) {
    return ["interpolate", ["linear"], ["line-progress"], 0, "rgba(255,255,255,0)", 1, "rgba(255,255,255,0)"];
  }

  const fadeInStart = Math.max(0, phase - 0.16);
  const fadeInMid = Math.max(0, phase - 0.1);
  const glowStart = Math.max(0, phase - 0.04);
  const glowEnd = Math.min(1, phase + 0.04);
  const fadeOutMid = Math.min(1, phase + 0.1);
  const fadeOutEnd = Math.min(1, phase + 0.16);

  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    "rgba(255,255,255,0)",
    fadeInStart,
    "rgba(255,255,255,0)",
    fadeInMid,
    "rgba(255,255,255,0.2)",
    glowStart,
    "rgba(255,255,255,0.72)",
    phase,
    "rgba(255,255,255,0.98)",
    glowEnd,
    "rgba(255,255,255,0.72)",
    fadeOutMid,
    "rgba(255,255,255,0.2)",
    fadeOutEnd,
    "rgba(255,255,255,0)",
    1,
    "rgba(255,255,255,0)",
  ];
};

const getPulsePhaseContinuous = (cycleMs) => {
  const t = Date.now() % cycleMs;
  return t / cycleMs;
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

const createDiscoveryClusterMarkerElement = (scanCount) => {
  const markerEl = document.createElement("button");
  markerEl.type = "button";
  markerEl.setAttribute("aria-label", `${scanCount} Scans gebuendelt`);
  markerEl.style.padding = "0";
  markerEl.style.border = "0";
  markerEl.style.background = "transparent";
  markerEl.style.cursor = "pointer";
  markerEl.style.position = "relative";

  const base = document.createElement("span");
  base.style.display = "inline-flex";
  base.style.alignItems = "center";
  base.style.justifyContent = "center";
  base.style.width = "38px";
  base.style.height = "38px";
  base.style.borderRadius = "999px";
  base.style.border = "1px solid rgba(240,229,165,0.52)";
  base.style.background = "radial-gradient(circle at 35% 30%, rgba(120,120,120,0.45), rgba(24,24,24,0.78))";
  base.style.boxShadow = "0 4px 10px rgba(0,0,0,0.28)";
  base.style.color = "#f8fafc";
  base.style.fontSize = "12px";
  base.style.fontWeight = "700";
  base.textContent = String(scanCount);
  markerEl.appendChild(base);

  const glyph = document.createElement("span");
  glyph.textContent = "●";
  glyph.style.position = "absolute";
  glyph.style.right = "-1px";
  glyph.style.bottom = "-2px";
  glyph.style.fontSize = "8px";
  glyph.style.color = "rgba(240,229,165,0.88)";
  markerEl.appendChild(glyph);

  return markerEl;
};

const getDiscoveryFootprintPx = (point) => {
  const hasCustomLogo = Boolean(
    String(point?.scannerLogoBorderUrl || "").trim() ||
    String(point?.scannerLogoPlantUrl || "").trim() ||
    String(point?.scannerLogoFaceUrl || "").trim()
  );
  return hasCustomLogo ? DISCOVERY_SINGLE_RADIUS_PX : DISCOVERY_BASIC_RADIUS_PX;
};

const buildDiscoveryRenderGroups = (points = [], map) => {
  if (!map || points.length === 0) return [];

  const canvas = map.getCanvas();
  const viewWidth = Number(canvas?.clientWidth || 0);
  const viewHeight = Number(canvas?.clientHeight || 0);
  const viewMarginPx = 96;

  const projected = points
    .map((point) => {
      const lng = Number(point?.lng);
      const lat = Number(point?.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      const projectedPoint = map.project([lng, lat]);
      const isWithinViewport =
        projectedPoint.x >= -viewMarginPx &&
        projectedPoint.y >= -viewMarginPx &&
        projectedPoint.x <= viewWidth + viewMarginPx &&
        projectedPoint.y <= viewHeight + viewMarginPx;
      if (!isWithinViewport) return null;

      return {
        point,
        lng,
        lat,
        x: projectedPoint.x,
        y: projectedPoint.y,
        radius: getDiscoveryFootprintPx(point),
      };
    })
    .filter(Boolean);

  if (projected.length === 0) return [];

  projected.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const consumed = new Array(projected.length).fill(false);
  const groups = [];

  for (let i = 0; i < projected.length; i += 1) {
    if (consumed[i]) continue;

    const anchor = projected[i];
    const members = [anchor];
    consumed[i] = true;

    for (let j = i + 1; j < projected.length; j += 1) {
      if (consumed[j]) continue;

      const candidate = projected[j];
      const dx = candidate.x - anchor.x;
      const dy = candidate.y - anchor.y;
      const pixelDistance = Math.hypot(dx, dy);
      const overlapThreshold = anchor.radius + candidate.radius + CLUSTER_EXTRA_PADDING_PX;
      if (pixelDistance > overlapThreshold) continue;

      const geoDistance = calculateDistanceMetersRaw(anchor.lat, anchor.lng, candidate.lat, candidate.lng);
      if (!Number.isFinite(geoDistance) || geoDistance > MAX_CLUSTER_GEO_SPREAD_M) continue;

      consumed[j] = true;
      members.push(candidate);
    }

    groups.push(members);
  }

  return groups.map((entries) => {
    if (entries.length === 1) {
      return {
        type: "single",
        point: entries[0].point,
        scanCount: 1,
      };
    }

    const representative = entries[0].point;
    const centroid = entries.reduce(
      (acc, item) => {
        acc.lat += item.lat;
        acc.lng += item.lng;
        return acc;
      },
      { lat: 0, lng: 0 }
    );
    const divisor = entries.length;

    return {
      type: "cluster",
      point: {
        ...representative,
        lng: centroid.lng / divisor,
        lat: centroid.lat / divisor,
      },
      scanCount: entries.length,
    };
  });
};

const createClaimLogoMarkerElement = (claim) => {
  const ownerScanCount = Math.max(0, Number(claim?.ownerScanCount || 0));
  const normalized = clamp(ownerScanCount, 1, 15);
  const sizePx = Math.round(34 + ((normalized - 1) / 14) * 24);

  const markerEl = document.createElement("div");
  markerEl.style.width = `${sizePx}px`;
  markerEl.style.height = `${sizePx}px`;
  markerEl.style.borderRadius = "999px";
  markerEl.style.pointerEvents = "auto";
  markerEl.style.display = "flex";
  markerEl.style.alignItems = "center";
  markerEl.style.justifyContent = "center";
  markerEl.style.filter = "drop-shadow(0 4px 10px rgba(0,0,0,0.42))";

  const borderUrl = String(claim?.ownerLogoBorderUrl || "").trim();
  const plantUrl = String(claim?.ownerLogoPlantUrl || "").trim();
  const faceUrl = String(claim?.ownerLogoFaceUrl || "").trim();
  const borderColor = String(claim?.ownerBorderColor || "").trim();

  if (!borderUrl && !plantUrl && !faceUrl) {
    const fallbackDot = document.createElement("span");
    fallbackDot.style.width = "14px";
    fallbackDot.style.height = "14px";
    fallbackDot.style.borderRadius = "999px";
    fallbackDot.style.background = borderColor || "#f0e5a5";
    fallbackDot.style.border = "1px solid rgba(255,255,255,0.8)";
    markerEl.appendChild(fallbackDot);
    return markerEl;
  }

  const ring = document.createElement("span");
  ring.style.display = "block";
  ring.style.width = "100%";
  ring.style.height = "100%";
  ring.style.borderRadius = "999px";
  ring.style.border = "1px solid rgba(240,229,165,0.72)";
  ring.style.background = "rgba(0,0,0,0.24)";
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

  const badge = document.createElement("span");
  badge.textContent = String(ownerScanCount);
  badge.style.position = "absolute";
  badge.style.right = "-3px";
  badge.style.bottom = "-4px";
  badge.style.minWidth = "20px";
  badge.style.height = "20px";
  badge.style.padding = "0 5px";
  badge.style.borderRadius = "999px";
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.fontSize = "11px";
  badge.style.fontWeight = "700";
  badge.style.color = "#f8fafc";
  badge.style.border = "1px solid rgba(240,229,165,0.62)";
  badge.style.background = "rgba(17,24,39,0.84)";
  badge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
  markerEl.style.position = "relative";
  markerEl.appendChild(badge);

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

const calculateDistanceMetersRaw = (lat1, lon1, lat2, lon2) => {
  const earthRadiusMeters = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  isLightUi = false,
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
  const claimLogoMarkersRef = useRef([]);
  const claimPulseIntervalRef = useRef(null);
  const lastCenteredRef = useRef({ lat: null, lng: null });

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
      dragRotate: true,
      touchZoomRotate: true,
      scrollZoom: true,
      doubleClickZoom: true,
      touchPitch: true,
      pitchWithRotate: true,
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

    const userLng = Number(userLocation?.lng);
    const userLat = Number(userLocation?.lat);
    const fallbackLng = Number(fallbackCenter?.lng);
    const fallbackLat = Number(fallbackCenter?.lat);
    const renderCenterLng = Number.isFinite(userLng) ? userLng : fallbackLng;
    const renderCenterLat = Number.isFinite(userLat) ? userLat : fallbackLat;
    const MAX_DISCOVERY_RENDER_DISTANCE_M = 3500;

    const renderDynamicMarkers = () => { // This line is unchanged
      if (claimPulseIntervalRef.current) {
        window.clearInterval(claimPulseIntervalRef.current);
        claimPulseIntervalRef.current = null;
      }

      if (map.getLayer("hero-claims-pulse")) {
        claimPulseIntervalRef.current = window.setInterval(() => {
          if (!map.getLayer("hero-claims-pulse")) return;
          const phase = getPulsePhaseContinuous(CLAIM_PULSE_CYCLE_MS);
          map.setPaintProperty("hero-claims-pulse", "line-gradient", buildClaimPulseGradient(phase));
        }, 55);
      }

      claimLogoMarkersRef.current.forEach((marker) => marker.remove());
      claimLogoMarkersRef.current = [];

      claimedTiles
        .filter((claim) => Number.isFinite(claim?.centerLat) && Number.isFinite(claim?.centerLng))
        .forEach((claim) => {
          const claimMarkerElement = createClaimLogoMarkerElement(claim);
          const claimMarker = new mapboxgl.Marker({
            element: claimMarkerElement,
            anchor: "center",
            pitchAlignment: "viewport",
            rotationAlignment: "viewport",
          })
            .setLngLat([Number(claim.centerLng), Number(claim.centerLat)])
            .addTo(map);

          claimLogoMarkersRef.current.push(claimMarker);
        });

      discoveryMarkersRef.current.forEach((marker) => marker.remove());
      discoveryMarkersRef.current = [];

      const filteredDiscoveryPoints = discoveryPoints
        .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
        .filter((point) => {
          if (!Number.isFinite(renderCenterLat) || !Number.isFinite(renderCenterLng)) {
            return true;
          }

          const distanceM = calculateDistanceMetersRaw(
            renderCenterLat,
            renderCenterLng,
            Number(point.lat),
            Number(point.lng)
          );

          return Number.isFinite(distanceM) && distanceM <= MAX_DISCOVERY_RENDER_DISTANCE_M;
        });

      const renderGroups = buildDiscoveryRenderGroups(filteredDiscoveryPoints, map);

      renderGroups.forEach((group) => {
        const point = group.point;
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

        const markerElement = group.type === "cluster"
          ? createDiscoveryClusterMarkerElement(group.scanCount)
          : createDiscoveryMarkerElement(point);

        markerElement.addEventListener("click", (domEvent) => {
          domEvent.preventDefault();
          domEvent.stopPropagation();

          if (group.type === "cluster") {
            map.easeTo({
              center: [lng, lat],
              zoom: Math.max(map.getZoom() + 1.6, 16.2),
              duration: 450,
            });
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

        const marker = new mapboxgl.Marker({
          element: markerElement,
          anchor: "center",
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat([lng, lat])
          .addTo(map);
        discoveryMarkersRef.current.push(marker);
      });
    };

    const updateMapData = ({ shouldRecenter = true } = {}) => {
      const targetLng = Number.isFinite(userLng) ? userLng : Number(fallbackCenter?.lng);
      const targetLat = Number.isFinite(userLat) ? userLat : Number(fallbackCenter?.lat);

      const lastLat = Number(lastCenteredRef.current.lat);
      const lastLng = Number(lastCenteredRef.current.lng);
      const centerChanged = !Number.isFinite(lastLat) || !Number.isFinite(lastLng)
        || Math.abs(lastLat - targetLat) > 0.00008
        || Math.abs(lastLng - targetLng) > 0.00008;

      if (shouldRecenter && Number.isFinite(targetLng) && Number.isFinite(targetLat) && centerChanged) {
        map.easeTo({
          center: [targetLng, targetLat],
          zoom: 13,
          pitch: 58,
          bearing: -18,
          duration: 600,
        });
        lastCenteredRef.current = { lat: targetLat, lng: targetLng };
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
          id: "hero-zones-hit",
          type: "fill",
          source: "hero-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0,
          },
        });

        map.addLayer({
          id: "hero-zones-fill",
          type: "fill",
          source: "hero-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.08,
          },
          layout: {
            visibility: "visible",
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
          const popupHtml = buildZonePopupHtml(props, isLightUi);
          new mapboxgl.Popup({ closeButton: true, maxWidth: "240px", className: "hero-zone-popup" })
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
            "fill-opacity": 0.22,
          },
        });

        map.on("click", "hero-claims-fill", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const props = feature.properties || {};

          const popupHtml = buildClaimPopupHtml(props, isLightUi);

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
            "line-gradient": buildClaimPulseGradient(getPulsePhaseContinuous(CLAIM_PULSE_CYCLE_MS)),
          },
        });
      }

      if (map.getLayer("hero-claims-borders")) {
        map.setLayoutProperty("hero-claims-borders", "visibility", "visible");
        map.moveLayer("hero-claims-borders");
      }
      if (map.getLayer("hero-claims-pulse")) {
        map.setLayoutProperty("hero-claims-pulse", "visibility", "visible");
        map.moveLayer("hero-claims-pulse");
      }

      renderDynamicMarkers();
    };

    if (map.isStyleLoaded()) {
      updateMapData({ shouldRecenter: true });
    } else {
      map.once("style.load", () => updateMapData({ shouldRecenter: true }));
    }

    const handleInitialIdle = () => {
      updateMapData({ shouldRecenter: false });
      map.off("idle", handleInitialIdle);
    };

    map.on("idle", handleInitialIdle);


    const handleViewChangeEnd = () => {
      renderDynamicMarkers();
    };

    map.on("zoomend", handleViewChangeEnd);
    map.on("moveend", handleViewChangeEnd);
    map.on("pitchend", handleViewChangeEnd);
    map.on("rotateend", handleViewChangeEnd);

    return () => {
      map.off("idle", handleInitialIdle);
      map.off("zoomend", handleViewChangeEnd);
      map.off("moveend", handleViewChangeEnd);
      map.off("pitchend", handleViewChangeEnd);
      map.off("rotateend", handleViewChangeEnd);
    };
  }, [
    allowDiscoveryLike,
    claimedTiles,
    currentAuthId,
    discoveryPoints,
    fallbackCenter?.lat,
    fallbackCenter?.lng,
    isLightUi,
    onDiscoveryImageClick,
    onDiscoveryLike,
    userLocation?.lat,
    userLocation?.lng,
    zones,
  ]);

  return <div ref={mapContainerRef} className={className} />;
}
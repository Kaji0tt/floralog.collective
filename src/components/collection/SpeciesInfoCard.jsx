import React from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ExternalLink, Info, Leaf, X } from "lucide-react";
import {
  getConservationFromPlant,
} from "@/lib/conservationStatus";
import {
  getRarityAccentClasses,
  getRarityBadgeClass,
  getRarityGlowColor,
  getRarityReflectionColor,
  getRarityStars,
  getRarityAnimationClass,
  getRarityGlowBorderClass,
  computeRarityLabel,
} from "@/lib/plantRarity";

const NATURADB_BASE_URL = "https://www.naturadb.de/pflanzen/";
const DISPLAY_PREFS_STORAGE_KEY = "floralog.speciesInfoCard.displayPrefs.v1";

const readDisplayPrefs = () => {
  if (typeof window === "undefined") return null;
  try {
    const rawValue = window.localStorage.getItem(DISPLAY_PREFS_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

/** @param {{ infoOpen: boolean, ecologyOpen: boolean, regionOpen?: boolean }} prefs */
const writeDisplayPrefs = (prefs) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISPLAY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage write errors (private mode/quota)
  }
};

const normalizeSlug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const buildNaturaDbUrl = (plant) => {
  if (plant?.naturadb_url) return plant.naturadb_url;
  const scientificName = plant?.scientific_name || plant?.aiData?.scientific_name;
  const slug = normalizeSlug(scientificName);
  if (!slug) return NATURADB_BASE_URL;
  return `${NATURADB_BASE_URL}${slug}/`;
};

const toDisplayOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

const toQuarterOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/\b([0-4])\s*\/\s*4\b/);
  if (!match) return null;
  return `${match[1]}/4`;
};

const resolveField = (plant, key) => {
  if (plant?.[key] !== undefined && plant?.[key] !== null && plant?.[key] !== "") {
    return plant[key];
  }
  if (plant?.aiData?.[key] !== undefined && plant?.aiData?.[key] !== null && plant?.aiData?.[key] !== "") {
    return plant.aiData[key];
  }
  return null;
};

const getRegionText = (plant) => {
  const nativeRegion = resolveField(plant, "native_region");
  if (nativeRegion) return String(nativeRegion);

  const distribution = resolveField(plant, "distribution");
  if (!distribution) return null;

  if (typeof distribution === "string") {
    return distribution;
  }

  if (typeof distribution === "object") {
    const isEuropean = distribution?.is_european;
    const countries = Array.isArray(distribution?.regions?.[0]?.countries)
      ? distribution.regions[0].countries.map((c) => c?.code).filter(Boolean).slice(0, 5)
      : [];
    const originLabel = isEuropean === true
      ? "Heimisch oder eingebürgert in Europa"
      : isEuropean === false
        ? "Nicht in Europa heimisch"
        : null;

    if (!originLabel && countries.length === 0) return null;
    if (countries.length === 0) return originLabel;
    return `${originLabel || "Verbreitung"} (${countries.join(" · ")})`;
  }

  return null;
};

const ecologyItems = (plant) => [
  { label: "Wildbienen", value: toDisplayOrNull(plant?.wild_bees_count) },
  { label: "Schmetterlinge", value: toDisplayOrNull(plant?.butterflies_count) },
  { label: "Raupen", value: toDisplayOrNull(plant?.caterpillars_count) },
  { label: "Schwebfliegen", value: toDisplayOrNull(plant?.hoverflies_count) },
  { label: "Käfer", value: toDisplayOrNull(plant?.beetles_count) },
  { label: "Bestand", value: toDisplayOrNull(plant?.red_list_population) },
  { label: "Gefährdung", value: toDisplayOrNull(plant?.red_list_threat) },
  { label: "Nektarwert", value: toQuarterOrNull(plant?.nectar_value) },
  { label: "Pollenwert", value: toQuarterOrNull(plant?.pollen_value) },
].filter((item) => item.value !== null);

export default function SpeciesInfoCard({
  plant,
  imageUrl,
  isLightUi = false,
  compact = false,
  disableThreatEffects = false,
  showPrimaryImage = compact,
  showScientificMeta = compact,
  showNarrative = true,
  titlePrefix,
  topRight,
  previewStackImages = [],
  onPreviewSwipeLeft,
  onPreviewSwipeRight,
}) {
  const PREVIEW_SWIPE_SETTLE_MS = 260;
  const PREVIEW_SWIPE_COMMIT_MS = PREVIEW_SWIPE_SETTLE_MS;
  const PREVIEW_SWIPE_THRESHOLD_PX = 56;
  const safePlant = plant || {};
  const naturadbUrl = buildNaturaDbUrl(safePlant);
  const image = imageUrl || safePlant.image_url || null;
  const scientificName = resolveField(safePlant, "scientific_name") || "-";
  const conservation = getConservationFromPlant(safePlant);
  // plant.rarity ist die kanonische, Rote-Liste-abgeleitete Seltenheitsstufe (max aus Bestand+Gefaehrdung).
  // Fallback fuer Pflanzen ohne bereits berechneten Wert (vor Backfill).
  const plantRarityLabel = resolveField(safePlant, "rarity") || computeRarityLabel(conservation.populationRaw, conservation.threatRaw);
  const rarityAccent = getRarityAccentClasses(plantRarityLabel, isLightUi);
  const rarityBadgeClass = getRarityBadgeClass(plantRarityLabel);
  const rarityStars = getRarityStars(plantRarityLabel);
  const rarityGlowColor = getRarityGlowColor(plantRarityLabel);
  const rarityReflectionColor = getRarityReflectionColor(plantRarityLabel);
  const threatAnimationClass = getRarityAnimationClass(plantRarityLabel);
  const threatGlowClass = getRarityGlowBorderClass(plantRarityLabel);
  const appliedThreatAnimationClass = disableThreatEffects ? "" : threatAnimationClass;
  const appliedThreatGlowClass = disableThreatEffects ? "" : threatGlowClass;
  const regionText = getRegionText(safePlant);
  const descriptionText = resolveField(safePlant, "description");
  const identificationText = resolveField(safePlant, "identification_features");
  const funFactText = resolveField(safePlant, "fun_fact");
  const [infoOpen, setInfoOpen] = React.useState(() => {
    const prefs = readDisplayPrefs();
    return typeof prefs?.infoOpen === "boolean" ? prefs.infoOpen : !compact;
  });
  const [ecologyOpen, setEcologyOpen] = React.useState(() => {
    const prefs = readDisplayPrefs();
    return typeof prefs?.ecologyOpen === "boolean" ? prefs.ecologyOpen : false;
  });
  const [regionOpen, setRegionOpen] = React.useState(() => {
    const prefs = readDisplayPrefs();
    return typeof prefs?.regionOpen === "boolean" ? prefs.regionOpen : false;
  });
  const [infoModalOpen, setInfoModalOpen] = React.useState(false);
  const [redListTooltipOpen, setRedListTooltipOpen] = React.useState(/** @type {string | null} */ (null));
  const [previewDragX, setPreviewDragX] = React.useState(0);
  const [previewPhase, setPreviewPhase] = React.useState("idle");
  const [commitDirection, setCommitDirection] = React.useState(0);
  const [commitPreviewStack, setCommitPreviewStack] = React.useState(
    /** @type {string[]} */ ([])
  );
  const previewTouchStartRef = React.useRef({ x: 0, y: 0, active: false });
  const previewMouseStartRef = React.useRef({ x: 0, y: 0, active: false });
  const previewCommitTimeoutRef = React.useRef(0);
  const commitImageRef = React.useRef(null);

  const mergedEcologyPlant = {
    ...safePlant,
    wild_bees_count: resolveField(safePlant, "wild_bees_count"),
    butterflies_count: resolveField(safePlant, "butterflies_count"),
    caterpillars_count: resolveField(safePlant, "caterpillars_count"),
    hoverflies_count: resolveField(safePlant, "hoverflies_count"),
    beetles_count: resolveField(safePlant, "beetles_count"),
    red_list_threat: resolveField(safePlant, "red_list_threat"),
    red_list_population: resolveField(safePlant, "red_list_population"),
    nectar_value: resolveField(safePlant, "nectar_value"),
    pollen_value: resolveField(safePlant, "pollen_value"),
  };
  const visibleEcologyItems = ecologyItems(mergedEcologyPlant);
  const previewStackBase = Array.isArray(previewStackImages) ? previewStackImages.filter(Boolean) : [];
  const isPreviewLocked = previewPhase === "settling" || previewPhase === "waiting-sync";
  const stackedPreviewImages = isPreviewLocked
    && Array.isArray(commitPreviewStack)
    && commitPreviewStack.length > 0
    ? commitPreviewStack
    : previewStackBase;
  const nextImage = stackedPreviewImages[1] || null;
  const secondNextImage = stackedPreviewImages[2] || null;
  const hasStackedPreview = stackedPreviewImages.length > 1;
  const hasThreePlusPreview = stackedPreviewImages.length > 2;
  const frontPreviewWidth = hasStackedPreview ? 85 : 100;
  const secondPreviewSlot = hasThreePlusPreview
    ? { left: 85, top: 6, width: 10, height: 90, opacity: 0.44, zIndex: 20 }
    : { left: 85, top: 6, width: 15, height: 90, opacity: 0.44, zIndex: 20 };
  const thirdPreviewSlot = hasThreePlusPreview
    ? { left: 95, top: 12, width: 5, height: 82, opacity: 0.3, zIndex: 10 }
    : { left: 85, top: 6, width: 15, height: 90, opacity: 0.3, zIndex: 10 };
  const recyclePreviewSlot = hasThreePlusPreview ? thirdPreviewSlot : secondPreviewSlot;
  const previousPreviewSlot = {
    left: -secondPreviewSlot.width,
    top: secondPreviewSlot.top,
    width: secondPreviewSlot.width,
    height: secondPreviewSlot.height,
    opacity: 0.34,
    zIndex: 20,
  };
  const previousImage = stackedPreviewImages.length > 1 ? stackedPreviewImages[stackedPreviewImages.length - 1] : null;
  const dragProgress = Math.min(Math.abs(previewDragX) / PREVIEW_SWIPE_THRESHOLD_PX, 1);
  const activeDirection = previewPhase === "dragging"
    ? (previewDragX < 0 ? -1 : previewDragX > 0 ? 1 : 0)
    : ((previewPhase === "settling" || previewPhase === "waiting-sync") ? commitDirection : 0);
  const leftSwipeProgress = activeDirection === -1 ? dragProgress : 0;
  const rightSwipeProgress = activeDirection === 1 ? dragProgress : 0;
  const transitionStyle = previewPhase === "dragging" || previewPhase === "sync-reset"
    ? "none"
    : previewPhase === "settling"
      ? `all ${PREVIEW_SWIPE_SETTLE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
      : "all 340ms cubic-bezier(0.22, 1, 0.36, 1)";

  const lerp = (from, to, progress) => from + (to - from) * progress;

  const clampPreviewDrag = (deltaX) => Math.max(-86, Math.min(86, deltaX));

  const updatePreviewDrag = (deltaX, deltaY = 0) => {
    if (stackedPreviewImages.length <= 1) return;
    if (previewPhase === "settling" || previewPhase === "waiting-sync") return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 0.9) return;
    setPreviewPhase("dragging");
    setPreviewDragX(clampPreviewDrag(deltaX));
  };

  const resetPreviewDrag = () => {
    setPreviewDragX(0);
    setPreviewPhase("idle");
    setCommitDirection(0);
    commitImageRef.current = null;
    setCommitPreviewStack([]);
  };

  const clearPreviewCommitTimeout = () => {
    if (previewCommitTimeoutRef.current) {
      window.clearTimeout(previewCommitTimeoutRef.current);
      previewCommitTimeoutRef.current = 0;
    }
  };

  const triggerPreviewSwipe = (deltaX, deltaY = 0) => {
    if (stackedPreviewImages.length <= 1) return false;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (previewPhase === "settling" || previewPhase === "waiting-sync") return true;
    if (absX < 24 || absX < absY * 1.1) return false;

    const direction = deltaX < 0 ? "left" : "right";
    const commitTravel = Math.max(
      Math.abs(clampPreviewDrag(deltaX)),
      PREVIEW_SWIPE_THRESHOLD_PX * 1.18
    );
    const commitSign = direction === "left" ? -1 : 1;

    clearPreviewCommitTimeout();
    setCommitPreviewStack(stackedPreviewImages.slice());
    setCommitDirection(commitSign);
    setPreviewPhase("settling");
    setPreviewDragX(commitSign * commitTravel);
    commitImageRef.current = image;

    previewCommitTimeoutRef.current = window.setTimeout(() => {
      if (direction === "left") {
        onPreviewSwipeLeft?.();
      } else {
        onPreviewSwipeRight?.();
      }

      setPreviewPhase("waiting-sync");
      previewCommitTimeoutRef.current = 0;
    }, PREVIEW_SWIPE_COMMIT_MS);

    return true;
  };

  React.useLayoutEffect(() => {
    if (previewPhase !== "waiting-sync") return;
    if (!commitImageRef.current) return;
    if (image !== commitImageRef.current) {
      clearPreviewCommitTimeout();
      setPreviewPhase("sync-reset");
      setPreviewDragX(0);
      setCommitDirection(0);
      commitImageRef.current = null;
      setCommitPreviewStack([]);

      const rafId = window.requestAnimationFrame(() => {
        setPreviewPhase("idle");
      });

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }
  }, [image, previewPhase]);

  React.useEffect(() => {
    return () => {
      clearPreviewCommitTimeout();
    };
  }, []);

  React.useEffect(() => {
    writeDisplayPrefs({ infoOpen, ecologyOpen, regionOpen });
  }, [infoOpen, ecologyOpen, regionOpen]);

  const handleSwipeRelease = (deltaX, deltaY = 0) => {
    const didSwipe = triggerPreviewSwipe(deltaX, deltaY);
    if (!didSwipe) {
      resetPreviewDrag();
    }
  };

  const handlePreviewTouchStart = (event) => {
    if (previewPhase === "settling" || previewPhase === "waiting-sync") return;
    event.stopPropagation();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) return;
    setPreviewPhase("idle");
    setPreviewDragX(0);
    previewTouchStartRef.current = { x: touch.clientX, y: touch.clientY, active: true };
  };

  const handlePreviewTouchEnd = (event) => {
    event.stopPropagation();
    const touch = event.changedTouches?.[0];
    const start = previewTouchStartRef.current;
    previewTouchStartRef.current = { x: 0, y: 0, active: false };
    if (!touch || !start.active) return;
    handleSwipeRelease(touch.clientX - start.x, touch.clientY - start.y);
  };

  const handlePreviewTouchMove = (event) => {
    const touch = event.touches?.[0];
    const start = previewTouchStartRef.current;
    if (!touch || !start.active) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    updatePreviewDrag(deltaX, deltaY);
    if (Math.abs(deltaX) > Math.abs(deltaY) * 0.9) {
      event.preventDefault();
    }
    event.stopPropagation();
  };

  const handlePreviewTouchCancel = (event) => {
    event.stopPropagation();
    previewTouchStartRef.current = { x: 0, y: 0, active: false };
    clearPreviewCommitTimeout();
    resetPreviewDrag();
  };

  const handlePreviewMouseDown = (event) => {
    if (previewPhase === "settling" || previewPhase === "waiting-sync") return;
    event.stopPropagation();
    setPreviewPhase("idle");
    setPreviewDragX(0);
    previewMouseStartRef.current = { x: event.clientX, y: event.clientY, active: true };
  };

  const handlePreviewMouseMove = (event) => {
    if (event.buttons !== 1) return;
    event.stopPropagation();
    const start = previewMouseStartRef.current;
    if (!start.active) return;
    updatePreviewDrag(event.clientX - start.x, event.clientY - start.y);
  };

  const handlePreviewMouseUp = (event) => {
    event.stopPropagation();
    const start = previewMouseStartRef.current;
    previewMouseStartRef.current = { x: 0, y: 0, active: false };
    if (!start.active) return;
    handleSwipeRelease(event.clientX - start.x, event.clientY - start.y);
  };

  const handlePreviewMouseLeave = () => {
    if (previewPhase === "settling" || previewPhase === "waiting-sync") return;
    previewMouseStartRef.current = { x: 0, y: 0, active: false };
    resetPreviewDrag();
  };

  const previewWrapperClass = compact
    ? "mb-2 w-full"
    : "float-right ml-3 mb-2 w-1/3";

  // -- Ecology helpers (shared by compact + non-compact) --
  /** Returns 0-100 bar width for ecology values, or null for text-only values */
  const getEcologyBarPercent = (label, value) => {
    const strVal = String(value || "");
    // "2/4" → nectar/pollen fraction
    const fractionMatch = strVal.match(/^(\d+)\s*\/\s*4$/);
    if (fractionMatch) return (parseInt(fractionMatch[1]) / 4) * 100;
    const num = parseFloat(strVal);
    if (isNaN(num)) return null;
    const maxMap = {
      "Wildbienen": 300, "Schmetterlinge": 200, "Raupen": 200,
      "Schwebfliegen": 100, "Käfer": 50,
    };
    return Math.min((num / (maxMap[label] || 100)) * 100, 100);
  };

  /** Convert Red List text to 1–6 star level (higher = rarer/more threatened) */
  const getRedListStars = (label, val) => {
    const v = String(val || "").toLowerCase();
    if (label === "Bestand") {
      if (v.includes("extrem selten")) return 6;
      if (v.includes("sehr selten")) return 5;
      if (v.includes("selten")) return 4;
      if (v.includes("m\u00e4\u00dfig") || v.includes("maessig")) return 3;
      if (v.includes("sehr h\u00e4ufig") || v.includes("sehr haufig")) return 1;
      if (v.includes("h\u00e4ufig") || v.includes("haufig")) return 2;
      return 3;
    }
    if (label === "Gef\u00e4hrdung") {
      if (v.includes("ausgestorben") || v === "0") return 6;
      if (v.includes("vom aussterben") || v === "1") return 5;
      if (v.includes("stark gef\u00e4hrd") || v.includes("stark gefaehrd") || v === "2") return 4;
      if (v.includes("gef\u00e4hrd") || v.includes("gefaehrd") || v === "3") return 3;
      if (v.includes("vorwarnstufe") || v === "v") return 2;
      if (v.includes("ungef\u00e4hrd") || v.includes("ungefaehrd") || v === "u") return 1;
      return 2;
    }
    return 3;
  };

  const COUNT_LABELS = new Set(["Wildbienen", "Schmetterlinge", "Raupen", "Schwebfliegen", "K\u00e4fer"]);
  const countItems = visibleEcologyItems.filter(item => COUNT_LABELS.has(item.label));
  const nektarItem = visibleEcologyItems.find(item => item.label === "Nektarwert") ?? null;
  const pollenItem = visibleEcologyItems.find(item => item.label === "Pollenwert") ?? null;
  const bestandItem = visibleEcologyItems.find(item => item.label === "Bestand") ?? null;
  const gefaehrdungItem = visibleEcologyItems.find(item => item.label === "Gef\u00e4hrdung") ?? null;
  const countRows = [];
  for (let i = 0; i < countItems.length; i += 2) {
    countRows.push([countItems[i], countItems[i + 1] ?? null]);
  }
  const hasPolNektar = nektarItem !== null || pollenItem !== null;
  const hasRoteList = bestandItem !== null || gefaehrdungItem !== null;

  // -- COMPACT: QUARTETT CARD --
  if (compact) {
    return (
      <div
        className={`relative rounded-2xl ${appliedThreatAnimationClass} ${appliedThreatGlowClass}`}
        style={/** @type {any} */ ({
          "--threat-glow-color": rarityGlowColor,
          "--rarity-reflection-color": rarityReflectionColor,
        })}
      >
        {/* === QUARTETT CARD === */}
        <div
          className={`flex flex-col rounded-2xl overflow-hidden border-2 select-none ${rarityAccent.imageBorder || (isLightUi ? "border-stone-300" : "border-stone-600/60")} ${isLightUi ? "bg-white" : "bg-gradient-to-b from-[#111a13] to-[#0c1410]"}`}
        >
          {/* ── HEADER: Name + Wissenschaftlicher Name + NaturaDB ── */}
          <div className={`px-2.5 pt-2 pb-1.5 flex items-start justify-between gap-1 ${isLightUi ? "border-b border-stone-100" : "border-b border-stone-700/40"}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {titlePrefix ? <span className="shrink-0 leading-none">{titlePrefix}</span> : null}
                <h3 className={`text-[11px] font-bold leading-tight line-clamp-2 ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                  {safePlant.species_name || "Unbekannte Pflanze"}
                </h3>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <p className={`text-[9px] italic truncate ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>{scientificName}</p>
                <a
                  href={naturadbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shrink-0 transition-colors ${isLightUi ? "text-emerald-700 hover:text-emerald-600" : "text-emerald-400 hover:text-emerald-300"}`}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="NaturaDB"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <Badge
                variant="secondary"
                className={`h-4 ${rarityBadgeClass} text-[9px] px-1 py-0 rounded-full`}
                title={plantRarityLabel}
              >
                {rarityStars}
              </Badge>
              {topRight ? <div className="w-6 h-6 overflow-hidden rounded-full shrink-0">{topRight}</div> : null}
            </div>
          </div>

          {/* ── IMAGE (swipeable carousel, mit Spielkarten-Rahmen) ── */}
          <div className={`px-1.5 ${isLightUi ? "bg-white" : "bg-[#0c1410]"}`}>
          <div
            className={`relative w-full overflow-hidden rounded-lg border ${isLightUi ? "border-stone-200" : "border-stone-700/50"}`}
            style={{ aspectRatio: "4/3" }}
            onTouchStart={handlePreviewTouchStart}
            onTouchEnd={handlePreviewTouchEnd}
            onTouchMove={handlePreviewTouchMove}
            onTouchCancel={handlePreviewTouchCancel}
            onMouseDown={handlePreviewMouseDown}
            onMouseUp={handlePreviewMouseUp}
            onMouseMove={handlePreviewMouseMove}
            onMouseLeave={handlePreviewMouseLeave}
          >
            {[
              ...(activeDirection === -1
                ? [
                    { key: `carousel-front-${image || "empty"}`, src: image, from: { left: 0, top: 0, width: frontPreviewWidth, height: 100, opacity: 1, zIndex: 30 }, to: recyclePreviewSlot },
                    { key: `carousel-next-${nextImage || "empty"}`, src: nextImage, from: secondPreviewSlot, to: { left: 0, top: 0, width: frontPreviewWidth, height: 100, opacity: 1, zIndex: 32 } },
                    { key: `carousel-next2-${secondNextImage || "empty"}`, src: secondNextImage, from: thirdPreviewSlot, to: secondPreviewSlot },
                  ]
                : activeDirection === 1
                  ? [
                      { key: `carousel-prev-${previousImage || "empty"}`, src: previousImage, from: previousPreviewSlot, to: { left: 0, top: 0, width: frontPreviewWidth, height: 100, opacity: 1, zIndex: 32 } },
                      { key: `carousel-front-${image || "empty"}`, src: image, from: { left: 0, top: 0, width: frontPreviewWidth, height: 100, opacity: 1, zIndex: 30 }, to: secondPreviewSlot },
                      { key: `carousel-next-${nextImage || "empty"}`, src: nextImage, from: secondPreviewSlot, to: thirdPreviewSlot },
                    ]
                  : [
                      { key: `carousel-front-${image || "empty"}`, src: image, from: { left: 0, top: 0, width: frontPreviewWidth, height: 100, opacity: 1, zIndex: 30 }, to: { left: 0, top: 0, width: frontPreviewWidth, height: 100, opacity: 1, zIndex: 30 } },
                      { key: `carousel-next-${nextImage || "empty"}`, src: nextImage, from: secondPreviewSlot, to: secondPreviewSlot },
                      { key: `carousel-next2-${secondNextImage || "empty"}`, src: secondNextImage, from: thirdPreviewSlot, to: thirdPreviewSlot },
                    ]),
            ]
              .filter((card) => !!card.src || card.key.includes("front"))
              .map((card) => {
                const progress = activeDirection === -1 ? leftSwipeProgress : activeDirection === 1 ? rightSwipeProgress : 0;
                return (
                  <div
                    key={card.key}
                    className="absolute overflow-hidden"
                    style={{
                      left: `${lerp(card.from.left, card.to.left, progress)}%`,
                      top: `${lerp(card.from.top, card.to.top, progress)}%`,
                      width: `${lerp(card.from.width, card.to.width, progress)}%`,
                      height: `${lerp(card.from.height, card.to.height, progress)}%`,
                      opacity: lerp(card.from.opacity, card.to.opacity, progress),
                      zIndex: Math.round(lerp(card.from.zIndex, card.to.zIndex, progress)),
                      pointerEvents: "none",
                      transition: transitionStyle,
                    }}
                  >
                    {card.src ? (
                      <img src={card.src} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={"w-full h-full flex items-center justify-center " + (isLightUi ? "bg-stone-100" : "bg-stone-900/80")}>
                        <Leaf className={"w-8 h-8 " + (isLightUi ? "text-stone-300" : "text-stone-600")} />
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Foto-Zähler */}
            {stackedPreviewImages.length > 1 && (
              <div className="absolute bottom-1 right-1 z-40 rounded-full bg-black/70 text-white text-[9px] px-1.5 py-0.5 leading-none pointer-events-none">
                +{Math.max(stackedPreviewImages.length - 1, 0)}
              </div>
            )}
          </div>
          </div>{/* end image frame wrapper */}

          {/* ── ÖKOLOGIE-WERTE (2-spaltig, Quartett-style) ── */}
          {(countRows.length > 0 || hasPolNektar || hasRoteList) && (
            <div className={`px-2.5 py-1.5 space-y-[3px] border-t ${isLightUi ? "border-stone-100" : "border-stone-700/40"}`}>

              {/* Zähl-Werte: je 2 pro Zeile */}
              {countRows.map(([a, b], rowIdx) => {
                const barBg = `flex-1 h-[3px] rounded-full overflow-hidden ${isLightUi ? "bg-stone-200" : "bg-stone-700/50"}`;
                const lblCls = `text-[9px] shrink-0 w-[3rem] truncate ${isLightUi ? "text-stone-500" : "text-stone-400"}`;
                const valCls = `text-[10px] font-bold shrink-0 tabular-nums w-6 text-right pr-1 ${isLightUi ? "text-stone-800" : "text-stone-100"}`;
                const cell = (item) => !item ? <div /> : (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={lblCls}>{item.label}</span>
                    <div className={barBg}>
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${getEcologyBarPercent(item.label, item.value) ?? 0}%` }} />
                    </div>
                    <span className={valCls}>{item.value}</span>
                  </div>
                );
                return (
                  <div key={rowIdx} className="grid grid-cols-2 gap-x-2">
                    {cell(a)}{cell(b)}
                  </div>
                );
              })}

              {/* Nektar + Pollen Zeile */}
              {hasPolNektar && (
                <div>
                  <div className="grid grid-cols-2 gap-x-2">
                    {[nektarItem ? { item: nektarItem, emoji: "\uD83C\uDF6F" } : null,
                      pollenItem ? { item: pollenItem, emoji: "\uD83C\uDF38" } : null].map((entry, idx) =>
                      entry ? (
                        <div key={idx} className="flex items-center gap-1 min-w-0">
                          <button
                            type="button"
                            className={`text-[10px] shrink-0 leading-none transition-opacity ${redListTooltipOpen === entry.item.label ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                            onClick={(e) => { e.stopPropagation(); setRedListTooltipOpen(prev => prev === entry.item.label ? null : entry.item.label); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setRedListTooltipOpen(prev => prev === entry.item.label ? null : entry.item.label); }}
                          >{entry.emoji}</button>
                          <div className={`flex-1 h-[3px] rounded-full overflow-hidden ${isLightUi ? "bg-stone-200" : "bg-stone-700/50"}`}>
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${getEcologyBarPercent(entry.item.label, entry.item.value) ?? 0}%` }} />
                          </div>
                            <span className={`text-[10px] font-bold shrink-0 tabular-nums w-7 text-right pr-1 ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{entry.item.value}</span>
                        </div>
                      ) : <div key={idx} />
                    )}
                  </div>
                  {(redListTooltipOpen === "Nektarwert" || redListTooltipOpen === "Pollenwert") && (() => {
                    const tooltipItem = redListTooltipOpen === "Nektarwert" ? nektarItem : pollenItem;
                    return tooltipItem ? (
                      <p className={`text-[9px] leading-snug mt-0.5 ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                        <span className="font-medium">{redListTooltipOpen}:</span> {tooltipItem.value}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Rote-Liste Zeile (Bestand + Gefährdung) */}
              {hasRoteList && (
                <div>
                  <div className="grid grid-cols-2 gap-x-2">
                    {[bestandItem, gefaehrdungItem].map((item, idx) => {
                      if (!item) return <div key={idx} />;
                      const stars = getRedListStars(item.label, item.value);
                      const isOpen = redListTooltipOpen === item.label;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          className={`flex items-center gap-1 min-w-0 text-left rounded transition-colors ${isOpen ? (isLightUi ? "bg-stone-100/80" : "bg-stone-800/50") : ""}`}
                          onClick={(e) => { e.stopPropagation(); setRedListTooltipOpen(prev => prev === item.label ? null : item.label); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setRedListTooltipOpen(prev => prev === item.label ? null : item.label); }}
                        >
                          <span className={`text-[10px] font-bold shrink-0 ${isOpen ? "text-amber-300" : "text-amber-400/80"}`}>{stars}★</span>
                          <span className={`text-[9px] truncate ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {redListTooltipOpen && (() => {
                    const tooltipItem = redListTooltipOpen === "Bestand" ? bestandItem : redListTooltipOpen === "Gef\u00e4hrdung" ? gefaehrdungItem : null;
                    return tooltipItem ? (
                      <p className={`text-[9px] leading-snug mt-0.5 ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                        <span className="font-medium">{redListTooltipOpen}:</span> {tooltipItem.value}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── NON-COMPACT: original design ─────────────────────────────────
  return (
    <div
      className={`space-y-3 ${appliedThreatAnimationClass} ${appliedThreatGlowClass}`}
      style={/** @type {any} */ ({
        "--threat-glow-color": rarityGlowColor,
        "--rarity-reflection-color": rarityReflectionColor,
      })}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1 min-w-0">
              {titlePrefix ? <span className="mt-0.5 shrink-0">{titlePrefix}</span> : null}
              <h3 className={"text-base font-bold break-words leading-tight " + (isLightUi ? "text-stone-900" : "text-stone-100")}>
                {safePlant.species_name || "Unbekannte Pflanze"}
              </h3>
            </div>
            {showScientificMeta && (
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className={"text-xs italic break-words min-w-0 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
                  {scientificName}
                  <a
                    href={naturadbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={"inline-flex items-center gap-1 ml-2 text-[11px] not-italic font-normal " + (isLightUi ? "text-emerald-700" : "text-emerald-300")}
                  >
                    NaturaDB
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={`h-5 ${rarityBadgeClass} text-[10px] px-1.5 py-0 rounded-full shrink-0`}
              title={plantRarityLabel}
            >
              {rarityStars}
            </Badge>
            {topRight || null}
          </div>
        </div>

        {!compact && showPrimaryImage && image && (
          <div className="w-full overflow-hidden rounded-xl border border-[#f0e5a5]/35 bg-black/20 rarity-reflection-host">
            <img
              src={image}
              alt={safePlant.species_name || "Gescanntes Pflanzenbild"}
              className="w-full h-56 md:h-72 object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {showNarrative && (
        <div className="space-y-2">
          <div className={"w-full rounded-md border " + (isLightUi
            ? "border-stone-200 bg-white text-stone-700"
            : "border-stone-600/60 bg-black/25 text-stone-200")}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setEcologyOpen((prev) => !prev);
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              className="w-full px-2 py-1.5 flex items-center justify-between text-left"
            >
              <span className="text-xs font-semibold">Ökologie</span>
              {ecologyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {ecologyOpen && (
              <div className="px-2 pb-2 pt-1 space-y-1">

                {/* Z\u00e4hl-Werte: je 2 pro Zeile */}
                {countRows.map(([a, b], rowIdx) => {
                  const barBg = `flex-1 h-[3px] rounded-full overflow-hidden ${isLightUi ? "bg-stone-200" : "bg-stone-700/50"}`;
                  const lblCls = `text-[10px] shrink-0 w-[3.5rem] truncate ${isLightUi ? "text-stone-500" : "text-stone-400"}`;
                  const valCls = `text-[11px] font-bold shrink-0 tabular-nums w-7 text-right pr-1 ${isLightUi ? "text-stone-800" : "text-stone-100"}`;
                  const cell = (item) => !item ? <div /> : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={lblCls}>{item.label}</span>
                      <div className={barBg}>
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${getEcologyBarPercent(item.label, item.value) ?? 0}%` }} />
                      </div>
                      <span className={valCls}>{item.value}</span>
                    </div>
                  );
                  return (
                    <div key={rowIdx} className="grid grid-cols-2 gap-x-3">
                      {cell(a)}{cell(b)}
                    </div>
                  );
                })}

                {/* Nektar + Pollen */}
                {hasPolNektar && (
                  <div>
                    <div className="grid grid-cols-2 gap-x-3">
                      {[nektarItem ? { item: nektarItem, emoji: "\uD83C\uDF6F" } : null,
                        pollenItem ? { item: pollenItem, emoji: "\uD83C\uDF38" } : null].map((entry, idx) =>
                        entry ? (
                          <div key={idx} className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              className={`text-[11px] shrink-0 leading-none transition-opacity ${redListTooltipOpen === entry.item.label ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                              onClick={(e) => { e.stopPropagation(); setRedListTooltipOpen(prev => prev === entry.item.label ? null : entry.item.label); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setRedListTooltipOpen(prev => prev === entry.item.label ? null : entry.item.label); }}
                            >{entry.emoji}</button>
                            <div className={`flex-1 h-[3px] rounded-full overflow-hidden ${isLightUi ? "bg-stone-200" : "bg-stone-700/50"}`}>
                              <div className="h-full rounded-full bg-amber-400" style={{ width: `${getEcologyBarPercent(entry.item.label, entry.item.value) ?? 0}%` }} />
                            </div>
                            <span className={`text-[11px] font-bold shrink-0 tabular-nums w-8 text-right pr-1 ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{entry.item.value}</span>
                          </div>
                        ) : <div key={idx} />
                      )}
                    </div>
                    {(redListTooltipOpen === "Nektarwert" || redListTooltipOpen === "Pollenwert") && (() => {
                      const tooltipItem = redListTooltipOpen === "Nektarwert" ? nektarItem : pollenItem;
                      return tooltipItem ? (
                        <p className={`text-[10px] leading-snug mt-0.5 ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                          <span className="font-medium">{redListTooltipOpen}:</span> {tooltipItem.value}
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Rote Liste (Bestand + Gef\u00e4hrdung) */}
                {hasRoteList && (
                  <div>
                    <div className="grid grid-cols-2 gap-x-3">
                      {[bestandItem, gefaehrdungItem].map((item, idx) => {
                        if (!item) return <div key={idx} />;
                        const stars = getRedListStars(item.label, item.value);
                        const isOpen = redListTooltipOpen === item.label;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            className={`flex items-center gap-1 min-w-0 text-left rounded transition-colors ${isOpen ? (isLightUi ? "bg-stone-100/80" : "bg-stone-800/50") : ""}`}
                            onClick={(e) => { e.stopPropagation(); setRedListTooltipOpen(prev => prev === item.label ? null : item.label); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setRedListTooltipOpen(prev => prev === item.label ? null : item.label); }}
                          >
                            <span className={`text-[11px] font-bold shrink-0 ${isOpen ? "text-amber-300" : "text-amber-400/80"}`}>{stars}★</span>
                            <span className={`text-[10px] truncate ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {redListTooltipOpen && (() => {
                      const tooltipItem = redListTooltipOpen === "Bestand" ? bestandItem : redListTooltipOpen === "Gef\u00e4hrdung" ? gefaehrdungItem : null;
                      return tooltipItem ? (
                        <p className={`text-[10px] leading-snug mt-0.5 ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                          <span className="font-medium">{redListTooltipOpen}:</span> {tooltipItem.value}
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                {!visibleEcologyItems.length && (
                  <p className={"text-[11px] leading-relaxed " + (isLightUi ? "text-stone-500" : "text-stone-300")}>
                    - Keine Werte verf\u00fcgbar -
                  </p>
                )}
              </div>
            )}
          </div>

          <div className={"w-full rounded-md border " + (isLightUi
            ? "border-stone-200 bg-white text-stone-700"
            : "border-stone-600/60 bg-black/25 text-stone-200")}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setInfoOpen((prev) => !prev);
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              className="w-full px-2 py-1.5 flex items-center justify-between text-left"
            >
              <span className="text-xs font-semibold">Info</span>
              {infoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {infoOpen && (
              <div className="px-2 pb-2 pt-1 space-y-2">
                {!!descriptionText && (
                  <div className={"rounded-md border p-2 " + (isLightUi ? "border-sky-200 bg-sky-50" : "border-sky-300/50 bg-sky-500/10")}>
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-sky-800" : "text-sky-200")}>Beschreibung</p>
                    <p className={"text-sm leading-relaxed " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{descriptionText}</p>
                  </div>
                )}
                {!!identificationText && (
                  <div className={"rounded-md border p-2 " + (isLightUi ? "border-amber-200 bg-amber-50" : "border-amber-300/50 bg-amber-500/10")}>
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-amber-800" : "text-amber-200")}>Erkennungsmerkmale</p>
                    <p className={"text-sm leading-relaxed " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{identificationText}</p>
                  </div>
                )}
                {!!funFactText && (
                  <div className={"rounded-md border p-2 " + (isLightUi ? "border-emerald-200 bg-emerald-50" : "border-emerald-300/50 bg-emerald-500/10")}>
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-emerald-800" : "text-emerald-200")}>Fun Fact</p>
                    <p className={"text-sm leading-relaxed " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{funFactText}</p>
                  </div>
                )}
                {!!regionText && (
                  <div className={"rounded-md border p-2 " + (isLightUi ? "border-violet-200 bg-violet-50" : "border-violet-300/50 bg-violet-500/10")}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRegionOpen((prev) => !prev);
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onTouchEnd={(event) => event.stopPropagation()}
                      className="w-full px-0 py-0 flex items-center justify-between text-left"
                    >
                      <span className={"text-xs font-semibold " + (isLightUi ? "text-violet-800" : "text-violet-200")}>Heimat</span>
                      {regionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {regionOpen && (
                      <p className={"text-sm leading-relaxed mt-1 " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{regionText}</p>
                    )}
                  </div>
                )}
                {!descriptionText && !identificationText && !funFactText && !regionText && (
                  <p className={"text-[11px] leading-relaxed " + (isLightUi ? "text-stone-500" : "text-stone-300")}>
                    - Keine Infos verfügbar -
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

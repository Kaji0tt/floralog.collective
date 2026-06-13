import React from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ExternalLink, Leaf } from "lucide-react";

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

/** @param {{ infoOpen: boolean, ecologyOpen: boolean }} prefs */
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
  const slug = normalizeSlug(plant?.scientific_name);
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
  { label: "Gefährdung", value: toDisplayOrNull(plant?.red_list_threat) },
  { label: "Nektarwert", value: toQuarterOrNull(plant?.nectar_value) },
  { label: "Pollenwert", value: toQuarterOrNull(plant?.pollen_value) },
].filter((item) => item.value !== null);

const getRarityColor = (rarity) => {
  switch (rarity) {
    case "Häufig":
      return "bg-gray-500";
    case "Gelegentlich":
      return "bg-green-500";
    case "Selten":
      return "bg-fuchsia-500";
    case "Sehr Selten":
    case "Sehr selten":
      return "bg-orange-500";
    case "Extrem Selten":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getRarityAccentClasses = (rarity, isLightUi) => {
  switch (rarity) {
    case "Extrem Selten":
      return isLightUi
        ? { border: "border-red-400/80", softBg: "bg-red-100/55", imageBorder: "border-red-400/85" }
        : { border: "border-red-400/75", softBg: "bg-red-500/12", imageBorder: "border-red-400/80" };
    case "Sehr Selten":
    case "Sehr selten":
      return isLightUi
        ? { border: "border-orange-400/80", softBg: "bg-orange-100/55", imageBorder: "border-orange-400/85" }
        : { border: "border-orange-300/75", softBg: "bg-orange-500/12", imageBorder: "border-orange-300/80" };
    case "Selten":
      return isLightUi
        ? { border: "border-fuchsia-400/80", softBg: "bg-fuchsia-100/50", imageBorder: "border-fuchsia-400/85" }
        : { border: "border-fuchsia-300/75", softBg: "bg-fuchsia-500/12", imageBorder: "border-fuchsia-300/80" };
    case "Gelegentlich":
      return isLightUi
        ? { border: "border-emerald-500/75", softBg: "bg-emerald-100/50", imageBorder: "border-emerald-500/80" }
        : { border: "border-emerald-300/70", softBg: "bg-emerald-500/12", imageBorder: "border-emerald-300/75" };
    case "Häufig":
    default:
      return isLightUi
        ? { border: "border-stone-300", softBg: "bg-stone-100/70", imageBorder: "border-stone-400/70" }
        : { border: "border-stone-500/60", softBg: "bg-stone-500/10", imageBorder: "border-stone-400/70" };
  }
};

const getRarityStars = (rarity) => {
  switch (rarity) {
    case "Häufig":
      return "⭐";
    case "Gelegentlich":
      return "⭐⭐";
    case "Selten":
      return "⭐⭐⭐";
    case "Sehr Selten":
    case "Sehr selten":
      return "⭐⭐⭐⭐";
    case "Extrem Selten":
      return "⭐⭐⭐⭐⭐";
    default:
      return "⭐";
  }
};

export default function SpeciesInfoCard({
  plant,
  imageUrl,
  isLightUi = false,
  compact = false,
  showNarrative = true,
  showScientificName = compact,
  showLargeImage = false,
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
  const rarity = resolveField(safePlant, "rarity") || "Gelegentlich";
  const rarityAccent = getRarityAccentClasses(rarity, isLightUi);
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
    writeDisplayPrefs({ infoOpen, ecologyOpen });
  }, [infoOpen, ecologyOpen]);

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

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1 min-w-0">
              {titlePrefix ? <span className="mt-0.5 shrink-0">{titlePrefix}</span> : null}
              <h3 className={"text-base font-bold break-words leading-tight " + (isLightUi ? "text-stone-900" : "text-stone-100")}>
                {safePlant.species_name || "Unbekannte Pflanze"}
              </h3>
            </div>
            {showScientificName && (
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className={"text-xs italic break-words min-w-0 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
                  {safePlant.scientific_name || "-"}
                  <a
                    href={naturadbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={"inline-flex items-center gap-1 ml-2 text-[11px] not-italic font-normal " + (isLightUi ? "text-emerald-700" : "text-emerald-300")}
                  >
                   
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Badge className={`h-5 ${getRarityColor(rarity)} text-white text-[10px] px-1.5 py-0 rounded-full shrink-0`}>
              {getRarityStars(rarity)}
            </Badge>
            {topRight || null}
          </div>
        </div>

        {compact && (
          <div className="flow-root">
            <div
              className={previewWrapperClass}
              onTouchStart={handlePreviewTouchStart}
              onTouchEnd={handlePreviewTouchEnd}
              onTouchMove={handlePreviewTouchMove}
              onTouchCancel={handlePreviewTouchCancel}
              onMouseDown={handlePreviewMouseDown}
              onMouseUp={handlePreviewMouseUp}
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
            >
              <div className="relative w-full aspect-square">
                {[
                  ...(activeDirection === -1
                    ? [
                        {
                          key: `carousel-front-${image || "empty"}`,
                          src: image,
                          from: { left: 0, top: 0, width: 74, height: 100, opacity: 1, zIndex: 30 },
                          to: { left: 50, top: 15, width: 50, height: 78, opacity: 0.28, zIndex: 12 },
                        },
                        {
                          key: `carousel-next-${nextImage || "empty"}`,
                          src: nextImage,
                          from: { left: 34, top: 7, width: 56, height: 86, opacity: 0.42, zIndex: 20 },
                          to: { left: 0, top: 0, width: 74, height: 100, opacity: 1, zIndex: 32 },
                        },
                        {
                          key: `carousel-next2-${secondNextImage || "empty"}`,
                          src: secondNextImage,
                          from: { left: 50, top: 15, width: 50, height: 78, opacity: 0.3, zIndex: 10 },
                          to: { left: 34, top: 7, width: 56, height: 86, opacity: 0.42, zIndex: 20 },
                        },
                      ]
                    : activeDirection === 1
                      ? [
                          {
                            key: `carousel-prev-${previousImage || "empty"}`,
                            src: previousImage,
                            from: { left: -18, top: 7, width: 56, height: 86, opacity: 0.34, zIndex: 20 },
                            to: { left: 0, top: 0, width: 74, height: 100, opacity: 1, zIndex: 32 },
                          },
                          {
                            key: `carousel-front-${image || "empty"}`,
                            src: image,
                            from: { left: 0, top: 0, width: 74, height: 100, opacity: 1, zIndex: 30 },
                            to: { left: 34, top: 7, width: 56, height: 86, opacity: 0.42, zIndex: 20 },
                          },
                          {
                            key: `carousel-next-${nextImage || "empty"}`,
                            src: nextImage,
                            from: { left: 34, top: 7, width: 56, height: 86, opacity: 0.42, zIndex: 20 },
                            to: { left: 50, top: 15, width: 50, height: 78, opacity: 0.3, zIndex: 10 },
                          },
                        ]
                      : [
                          {
                            key: `carousel-front-${image || "empty"}`,
                            src: image,
                            from: { left: 0, top: 0, width: 74, height: 100, opacity: 1, zIndex: 30 },
                            to: { left: 0, top: 0, width: 74, height: 100, opacity: 1, zIndex: 30 },
                          },
                          {
                            key: `carousel-next-${nextImage || "empty"}`,
                            src: nextImage,
                            from: { left: 34, top: 7, width: 56, height: 86, opacity: 0.42, zIndex: 20 },
                            to: { left: 34, top: 7, width: 56, height: 86, opacity: 0.42, zIndex: 20 },
                          },
                          {
                            key: `carousel-next2-${secondNextImage || "empty"}`,
                            src: secondNextImage,
                            from: { left: 50, top: 15, width: 50, height: 78, opacity: 0.3, zIndex: 10 },
                            to: { left: 50, top: 15, width: 50, height: 78, opacity: 0.3, zIndex: 10 },
                          },
                        ]),
                ]
                  .filter((card) => !!card.src || card.key.includes("front"))
                  .map((card) => {
                    const progress = activeDirection === -1 ? leftSwipeProgress : activeDirection === 1 ? rightSwipeProgress : 0;

                    return (
                      <div
                        key={card.key}
                        className={`absolute rounded-lg border overflow-hidden ${rarityAccent.imageBorder}`}
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
                          <img src={card.src} alt="Weitere Scan-Variante" className="w-full h-full object-cover" />
                        ) : (
                          <div className={"w-full h-full flex items-center justify-center " + (isLightUi ? "bg-stone-100" : "bg-stone-900/70")}>
                            <Leaf className={"w-7 h-7 " + (isLightUi ? "text-stone-400" : "text-stone-500")} />
                          </div>
                        )}

                        {!compact && showLargeImage && image && (
                          <div className="overflow-hidden rounded-xl border border-[#f0e5a5]/30">
                            <img
                              src={image}
                              alt={safePlant.species_name || "Gescanntes Bild"}
                              className="w-full h-72 md:h-96 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                {stackedPreviewImages.length > 1 && (
                  <div className="absolute -bottom-1 -right-1 z-30 rounded-full bg-black/70 text-white text-[10px] px-1.5 py-0.5 leading-none">
                    +{Math.max(stackedPreviewImages.length - 1, 0)}
                  </div>
                )}
              </div>
            </div>
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
              <div className="px-2 pb-2 pt-1">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {visibleEcologyItems.length > 0 ? (
                    visibleEcologyItems.map((item) => (
                      <div key={item.label} className="text-[11px] flex items-center justify-between gap-2">
                        <span className={isLightUi ? "text-stone-600" : "text-stone-300"}>{item.label}</span>
                        <span className={"font-semibold " + (isLightUi ? "text-stone-900" : "text-stone-100")}>{item.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className={"text-[11px] leading-relaxed " + (isLightUi ? "text-stone-500" : "text-stone-300") }>
                      - Keine Werte verfügbar -
                    </p>
                  )}
                </div>
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
                    <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-violet-800" : "text-violet-200")}>Heimat</p>
                    <p className={"text-sm leading-relaxed " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{regionText}</p>
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

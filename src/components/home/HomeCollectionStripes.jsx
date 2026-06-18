import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Leaf } from "lucide-react";
import { hexToFilter } from "@/lib/hexToFilter";
import { LockedTooltip } from "@/components/ui/locked-tooltip";

const SWIPE_THRESHOLD_PX = 36;

const clampIndex = (index, size) => {
  if (!Number.isFinite(index) || size <= 0) return 0;
  if (index < 0) return size - 1;
  if (index >= size) return 0;
  return index;
};

const formatCompactValue = (value) => {
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue < 1000) return String(Math.round(safeValue));
  if (safeValue < 1000000) return `${Math.round(safeValue / 1000)}k`;
  return `${Math.round(safeValue / 1000000)}m`;
};

const BADGE_RANK_ICON_STYLE = {
  gray: "text-[#9ca3af]",
  white: "text-white",
  bronze: "text-[#cd7f32]",
  silver: "text-[#c0c7d1]",
  gold: "text-[#f5c542]",
};

export default function HomeCollectionStripes({
  isLightUi,
  equippedLogoAssets,
  selectedProfileBadges = [],
  onLogoClick,
  playerSeeds,
  milestoneFeed,
  onMilestoneAction,
  onMilestonePreviewClick,
  favoriteCollections,
  onOpenCollection,
  favoriteBackendHint,
  className = "",
}) {
  const [stripeTwoIndex, setStripeTwoIndex] = useState(0);
  const [stripeTwoContentHeight, setStripeTwoContentHeight] = useState(null);
  const stripeTwoTouchStartX = useRef(null);
  const stripeTwoMeasureRefs = useRef(new Map());

  const stripeTwoSlides = useMemo(() => {
    const milestones = Array.isArray(milestoneFeed)
      ? milestoneFeed.map((item) => ({
          id: `milestone-${item.id}`,
          kind: "milestone",
          title: item.title,
          detail: item.detail,
          previewImageUrl: item.previewImageUrl || "",
          payload: item,
        }))
      : [];

    const followingCollections = Array.isArray(favoriteCollections)
      ? favoriteCollections.map((item) => ({
          id: `collection-${item.id}`,
          kind: "collection",
          title: item.title,
          detail: `${item.discovered}/${item.total} entdeckt · ${item.missingCount} fehlen`,
          payload: item,
          progressPercent: Math.max(0, Math.min(100, Number(item.percent) || 0)),
        }))
      : [];

    const merged = [...milestones, ...followingCollections];

    if (merged.length === 0) {
      merged.push({
        id: "fallback-empty",
        kind: "fallback",
        title: "Noch keine Highlights verfügbar",
        detail: favoriteBackendHint
          ? "Following-Kollektionen erscheinen, sobald die Favoriten-Migration auf dem Ziel-Backend aktiv ist."
          : "Sobald Milestones oder Following-Kollektionen vorliegen, erscheinen sie hier.",
        payload: null,
      });
    }

    return merged;
  }, [milestoneFeed, favoriteCollections, favoriteBackendHint]);

  const stripeTwoCount = stripeTwoSlides.length;
  const currentStripeTwoSlide = stripeTwoSlides[clampIndex(stripeTwoIndex, stripeTwoCount)] || null;

  const renderStripeTwoSlideBody = (slide) => {
    if (!slide) return null;

    const isCollectionSlide = slide.kind === "collection";
    const hasMilestonePreview = slide.kind === "milestone" && Boolean(slide.previewImageUrl);
    const milestonePayload = slide.kind === "milestone" ? slide.payload : null;
    const genusName = String(milestonePayload?.genusName || "").trim();
    const canOpenOwnGenus =
      Boolean(milestonePayload?.actionType === "open_genus" && milestonePayload?.genusId && genusName);

    const handleOpenMilestoneGenus = (event) => {
      if (!canOpenOwnGenus) return;
      event.preventDefault();
      event.stopPropagation();
      onMilestoneAction?.(milestonePayload);
    };

    const renderTextWithClickableGenus = (text, keyPrefix) => {
      if (!canOpenOwnGenus || typeof text !== "string" || !text.includes(genusName)) {
        return text;
      }

      const chunks = text.split(genusName);
      const nodes = [];

      chunks.forEach((chunk, index) => {
        if (chunk) {
          nodes.push(<span key={`${keyPrefix}-chunk-${index}`}>{chunk}</span>);
        }

        if (index < chunks.length - 1) {
          nodes.push(
            <span
              key={`${keyPrefix}-genus-${index}`}
              onClick={handleOpenMilestoneGenus}
              className="cursor-pointer italic"
            >
              {genusName}
            </span>
          );
        }
      });

      return nodes;
    };

    return (
      <>
        <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${isLightUi ? "text-emerald-800/85" : "text-emerald-200/85"}`}>
          {isCollectionSlide ? "Following Collection" : renderTextWithClickableGenus(slide.title, `${slide.id}-title`)}
        </p>
        {isCollectionSlide ? (
          <p className="text-[1.1rem] font-semibold leading-snug line-clamp-2">
            {slide.title}
          </p>
        ) : null}
        {hasMilestonePreview ? (
          <div className="mt-1 flex items-start gap-3">
            <div
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${isLightUi ? "border-[#c8ac62]/45 bg-white/55" : "border-[#f0e5a5]/35 bg-black/35"}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (slide.kind === "milestone" && slide.payload) {
                  onMilestonePreviewClick?.(slide.payload);
                }
              }}
            >
              <img
                src={slide.previewImageUrl}
                alt={`Vorschau ${slide.title}`}
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 38%" }}
                loading="lazy"
              />
            </div>
            <p className={`pt-0.5 text-[0.88rem] leading-snug line-clamp-3 ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
              {renderTextWithClickableGenus(slide.detail, `${slide.id}-detail`)}
            </p>
          </div>
        ) : (
          <p className={`mt-1 text-[0.88rem] leading-snug line-clamp-2 ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
            {renderTextWithClickableGenus(slide.detail, `${slide.id}-detail`)}
          </p>
        )}
        {isCollectionSlide && Number.isFinite(slide.progressPercent) ? (
          <div className="mt-2 h-1.5 rounded-full bg-black/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/85"
              style={{ width: `${slide.progressPercent}%` }}
            />
          </div>
        ) : null}
        {isCollectionSlide ? (
          <p className={`mt-2 text-[11px] font-medium ${isLightUi ? "text-emerald-800/80" : "text-emerald-200/85"}`}>
            Tippen zum Öffnen
          </p>
        ) : null}
      </>
    );
  };

  const setStripeTwoMeasureRef = useCallback(
    (slideId) => (node) => {
      if (node) {
        stripeTwoMeasureRefs.current.set(slideId, node);
      } else {
        stripeTwoMeasureRefs.current.delete(slideId);
      }
    },
    []
  );

  const measureStripeTwoHeight = useCallback(() => {
    const heights = stripeTwoSlides.map((slide) => {
      const node = stripeTwoMeasureRefs.current.get(slide.id);
      return node ? node.getBoundingClientRect().height : 0;
    });

    const maxHeight = Math.ceil(Math.max(0, ...heights));
    setStripeTwoContentHeight((prev) => {
      if (!maxHeight) return prev;
      return prev === maxHeight ? prev : maxHeight;
    });
  }, [stripeTwoSlides]);

  useEffect(() => {
    setStripeTwoIndex((prev) => clampIndex(prev, stripeTwoCount));
  }, [stripeTwoCount]);

  useEffect(() => {
    if (stripeTwoCount <= 1) return undefined;
    const id = window.setInterval(() => {
      setStripeTwoIndex((prev) => clampIndex(prev + 1, stripeTwoCount));
    }, 6500);
    return () => window.clearInterval(id);
  }, [stripeTwoCount]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      measureStripeTwoHeight();
    });

    const handleResize = () => {
      measureStripeTwoHeight();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, [measureStripeTwoHeight]);

  const borderFilter = equippedLogoAssets?.borderColor
    ? `brightness(0) saturate(100%) ${hexToFilter(equippedLogoAssets.borderColor)}`
    : undefined;
  const logoVisualScale = 1.3;
  const selectedBadges = Array.isArray(selectedProfileBadges)
    ? selectedProfileBadges.filter(Boolean).slice(0, 3)
    : [];
  const badgeSlots = Array.from({ length: 3 }, (_, index) => selectedBadges[index] || null);
  const primaryFollowedCollection = useMemo(() => {
    const collections = Array.isArray(favoriteCollections)
      ? favoriteCollections.filter(Boolean)
      : [];
    return collections[0] || null;
  }, [favoriteCollections]);
  const followedCollectionProgressPercent = Math.max(
    0,
    Math.min(100, Number(primaryFollowedCollection?.percent) || 0)
  );

  const resolveBadgeValueLabel = (badge) => {
    if (!badge) return "-";
    if (badge.id === "seed_rank_medal") {
      return formatCompactValue(playerSeeds);
    }
    if (badge.id === "distance_waypoints") {
      return String(badge.valueLabel || "-").replace(/\s*km$/i, "").trim();
    }
    return String(badge.valueLabel || "-");
  };

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      <div className="shrink-0 rounded-2xl bg-black/50 px-2 py-2 backdrop-blur-sm text-stone-100">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onLogoClick?.()}
            className="relative -my-2.5 -ml-1 h-[5.25rem] w-[5.25rem] shrink-0"
            aria-label="Florabot Overlay öffnen"
          >
            <div
              className="absolute inset-0"
              style={{ transform: `scale(${logoVisualScale})`, transformOrigin: "center" }}
            >
              {equippedLogoAssets?.border?.imageUrl && (
                <img
                  src={equippedLogoAssets.border.imageUrl}
                  alt="Logo Rahmen"
                  className="absolute inset-0 h-full w-full object-contain"
                  style={borderFilter ? { filter: borderFilter } : undefined}
                />
              )}
              {equippedLogoAssets?.plant?.imageUrl && (
                <img
                  src={equippedLogoAssets.plant.imageUrl}
                  alt="Logo Pflanze"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
              {equippedLogoAssets?.face?.imageUrl && (
                <img
                  src={equippedLogoAssets.face.imageUrl}
                  alt="Logo Gesicht"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
              {!equippedLogoAssets?.border?.imageUrl &&
                !equippedLogoAssets?.plant?.imageUrl &&
                !equippedLogoAssets?.face?.imageUrl && (
                  <div className="h-full w-full rounded-full border border-white/35 flex items-center justify-center">
                    <Leaf className="h-4 w-4 text-emerald-300" />
                  </div>
                )}
            </div>
          </button>

          <div className="min-w-0 flex-1 h-[5.25rem]" aria-label="Ausgewaehlte Abzeichen">
            <div className="h-full grid grid-cols-3 gap-1.5">
              {badgeSlots.map((badge, slotIndex) => {
                if (!badge) {
                  return (
                    <div
                      key={`badge-slot-empty-${slotIndex}`}
                      className={`h-full rounded-xl flex items-center justify-center text-[9px] font-medium ${
                        isLightUi
                          ? "text-white/55"
                          : "text-stone-300/65"
                      }`}
                    >
                      Leer
                    </div>
                  );
                }

                const Icon = badge?.Icon || Leaf;
                const rankKey = String(badge?.rankKey || "gray").toLowerCase();
                const rankLabel = badge?.rankMeta?.label || "Grau";
                const iconToneClass = BADGE_RANK_ICON_STYLE[rankKey] || BADGE_RANK_ICON_STYLE.gray;
                const valueLabel = resolveBadgeValueLabel(badge);

                return (
                  <LockedTooltip
                    key={badge.id}
                    content={(
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">{badge.label}</p>
                        <p className="text-[11px] leading-snug">{badge.description}</p>
                        <p className="text-[11px]"><span className="font-semibold">Wert:</span> {valueLabel}</p>
                        <p className="text-[11px]"><span className="font-semibold">Rang:</span> {rankLabel}</p>
                      </div>
                    )}
                    contentClassName={isLightUi ? "" : "text-white/90"}
                  >
                    <button
                      type="button"
                      className="h-full w-full rounded-xl flex flex-col items-center justify-center gap-2 px-1"
                      aria-label={`${badge.label}: ${valueLabel}, Rang ${rankLabel}`}
                    >
                      <Icon className={`h-8 w-8 ${iconToneClass}`} />
                      <span className="w-full text-center text-[12px] leading-none font-bold text-stone-100">
                        {valueLabel}
                      </span>
                    </button>
                  </LockedTooltip>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className={`relative h-full flex flex-col overflow-visible rounded-2xl border px-3 py-2.5 backdrop-blur-sm ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/58 text-stone-900"
              : "border-[#f0e5a5]/45 bg-black/34 text-stone-100"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: isLightUi
                  ? "linear-gradient(140deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0.16) 100%)"
                  : "linear-gradient(140deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0.08) 100%)",
              }}
            />
            <div
              className={`absolute inset-x-6 top-0 h-px ${isLightUi ? "bg-white/80" : "bg-white/40"}`}
            />
          </div>

          <div
            className="relative z-[1] px-10 flex-1 min-h-0 flex flex-col justify-center"
            style={stripeTwoContentHeight ? { minHeight: `${stripeTwoContentHeight}px` } : undefined}
            onTouchStart={(event) => {
              stripeTwoTouchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = stripeTwoTouchStartX.current;
              const end = event.changedTouches?.[0]?.clientX ?? null;
              stripeTwoTouchStartX.current = null;
              if (!Number.isFinite(start) || !Number.isFinite(end)) return;
              const delta = end - start;
              if (Math.abs(delta) < SWIPE_THRESHOLD_PX || stripeTwoCount <= 1) return;
              setStripeTwoIndex((prev) => clampIndex(prev + (delta < 0 ? 1 : -1), stripeTwoCount));
            }}
          >
            {currentStripeTwoSlide ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStripeTwoSlide.kind === "milestone" && currentStripeTwoSlide.payload) {
                    onMilestoneAction?.(currentStripeTwoSlide.payload);
                  }
                  if (currentStripeTwoSlide.kind === "collection" && currentStripeTwoSlide.payload) {
                    onOpenCollection?.(currentStripeTwoSlide.payload);
                  }
                }}
                className="flex h-full w-full flex-col overflow-hidden text-left"
              >
                {renderStripeTwoSlideBody(currentStripeTwoSlide)}
              </button>
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[-1] opacity-0" aria-hidden="true">
            <div className="px-10">
              {stripeTwoSlides.map((slide) => (
                <div key={`measure-${slide.id}`} ref={setStripeTwoMeasureRef(slide.id)} className="w-full">
                  {renderStripeTwoSlideBody(slide)}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-[1] mt-2 shrink-0 flex items-center justify-center gap-2">
            {stripeTwoSlides.map((slide, index) => {
              const isActive = index === stripeTwoIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setStripeTwoIndex(index)}
                  className={`rounded-full transition-all ${isActive ? "w-3 h-3" : "w-2 h-2"} ${
                    isActive
                      ? (isLightUi ? "bg-[#f7d989]" : "bg-[#f0e5a5]")
                      : (isLightUi ? "bg-[#f7d989]/50" : "bg-[#f0e5a5]/40")
                  }`}
                  aria-label={`Feed-Item ${index + 1}`}
                />
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStripeTwoIndex((prev) => clampIndex(prev - 1, stripeTwoCount))}
          disabled={stripeTwoCount <= 1}
          className={`absolute z-30 h-9 w-9 rounded-full border backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.35)] flex items-center justify-center disabled:opacity-40 ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/58 text-amber-800"
              : "border-[#f0e5a5]/40 bg-black/30 text-[#f4e9c9]"
          }`}
          style={{ left: "-18px", top: "50%", transform: "translateY(-50%)" }}
          aria-label="Vorheriges Feed-Item"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setStripeTwoIndex((prev) => clampIndex(prev + 1, stripeTwoCount))}
          disabled={stripeTwoCount <= 1}
          className={`absolute z-30 h-9 w-9 rounded-full border backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.35)] flex items-center justify-center disabled:opacity-40 ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/58 text-amber-800"
              : "border-[#f0e5a5]/40 bg-black/30 text-[#f4e9c9]"
          }`}
          style={{ right: "-18px", top: "50%", transform: "translateY(-50%)" }}
          aria-label="Nächstes Feed-Item"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <button
          type="button"
          onClick={() => {
            if (primaryFollowedCollection) {
              onOpenCollection?.(primaryFollowedCollection);
            }
          }}
          disabled={!primaryFollowedCollection}
          className={`h-full w-full rounded-xl flex flex-col px-3 py-2.5 text-left ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/58 backdrop-blur-sm border"
              : "border-[#f0e5a5]/45 bg-black/34 backdrop-blur-sm border"
          } relative overflow-hidden disabled:opacity-80`}
          aria-label={primaryFollowedCollection
            ? `Gefolgte Kollektion ${primaryFollowedCollection.title}. ${primaryFollowedCollection.discovered}/${primaryFollowedCollection.total} entdeckt.`
            : "Noch keine gefolgte Kollektion verfuegbar"}
        >
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background: isLightUi
                  ? "linear-gradient(140deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0.16) 100%)"
                  : "linear-gradient(140deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0.08) 100%)",
              }}
            />
            <div className={`absolute inset-x-2 top-0 h-px ${isLightUi ? "bg-white/80" : "bg-white/40"}`} />
          </div>

          <div className="relative z-[1] min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${isLightUi ? "text-emerald-800/85" : "text-emerald-200/85"}`}>
              Gefolgte Kollektion
            </p>
            <p className="mt-1 text-[1rem] font-semibold leading-snug truncate">
              {primaryFollowedCollection?.title || "Noch keine gefolgte Kollektion"}
            </p>
            <p className={`mt-1 text-[0.84rem] leading-snug ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
              {primaryFollowedCollection
                ? `${primaryFollowedCollection.discovered}/${primaryFollowedCollection.total} entdeckt · ${primaryFollowedCollection.missingCount} fehlen`
                : (favoriteBackendHint
                  ? "Following-Kollektionen erscheinen, sobald die Favoriten-Migration aktiv ist."
                  : "Folge einer Kollektion, um sie hier direkt zu sehen.")}
            </p>

            {primaryFollowedCollection ? (
              <>
                <div className="mt-2 h-1.5 rounded-full bg-black/25 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/85"
                    style={{ width: `${followedCollectionProgressPercent}%` }}
                  />
                </div>
                <p className={`mt-2 text-[11px] font-medium ${isLightUi ? "text-emerald-800/80" : "text-emerald-200/85"}`}>
                  Tippen zum Oeffnen
                </p>
              </>
            ) : null}
          </div>
        </button>
      </div>
    </div>
  );
}

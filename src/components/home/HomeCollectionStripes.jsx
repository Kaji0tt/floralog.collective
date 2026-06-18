import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeartPulse, InspectionPanel, Leaf } from "lucide-react";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";

const SWIPE_THRESHOLD_PX = 36;
const SLIDE_DURATION_MS = 6500;
const PROGRESS_TICK_MS = 50;
const OVERLAY_EXIT_FADE_MS = 350;

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

export function HomeMilestoneStripe({
  isLightUi,
  milestoneFeed,
  onMilestoneAction,
  onMilestonePreviewClick,
  className = "",
}) {
  const [stripeTwoIndex, setStripeTwoIndex] = useState(0);
  const [stripeTwoContentHeight, setStripeTwoContentHeight] = useState(null);
  const [stripeProgressPercent, setStripeProgressPercent] = useState(0);
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

    const merged = [...milestones];

    if (merged.length === 0) {
      merged.push({
        id: "fallback-empty",
        kind: "fallback",
        title: "Noch keine Highlights verfügbar",
        detail: "Sobald neue Meilensteine vorliegen, erscheinen sie hier.",
        payload: null,
      });
    }

    return merged;
  }, [milestoneFeed]);

  const stripeTwoCount = stripeTwoSlides.length;
  const currentStripeTwoSlide = stripeTwoSlides[clampIndex(stripeTwoIndex, stripeTwoCount)] || null;
  const isMissingSpeciesMilestone = (() => {
    const normalizedText = `${currentStripeTwoSlide?.title || ""} ${currentStripeTwoSlide?.detail || ""}`.toLowerCase();
    const hasMissingPhrase = /dir\s+fehl(?:t|en)\s+nur\s+noch/.test(normalizedText);
    const hasSpeciesKeyword = /\bart(?:en)?\b/.test(normalizedText);
    return hasMissingPhrase && hasSpeciesKeyword;
  })();
  const currentSlidePreviewImage =
    currentStripeTwoSlide?.kind === "milestone" && currentStripeTwoSlide?.previewImageUrl
      ? currentStripeTwoSlide.previewImageUrl
      : "";
  const canOpenCurrentSlidePreview =
    currentStripeTwoSlide?.kind === "milestone" &&
    Boolean(currentStripeTwoSlide?.payload) &&
    Boolean(onMilestonePreviewClick);

  const renderStripeTwoSlideBody = (slide) => {
    if (!slide) return null;

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
        <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 text-right ${isLightUi ? "text-emerald-200/90" : "text-emerald-200/85"}`}>
          {renderTextWithClickableGenus(slide.title, `${slide.id}-title`)}
        </p>
        <p className={`mt-1 text-right text-[0.88rem] leading-snug line-clamp-3 ${isLightUi ? "text-stone-100/90" : "text-stone-200/90"}`}>
          {renderTextWithClickableGenus(slide.detail, `${slide.id}-detail`)}
        </p>
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
    if (stripeTwoCount <= 1) {
      setStripeProgressPercent(100);
      return undefined;
    }

    setStripeProgressPercent(0);
    const startedAt = Date.now();

    const id = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const nextProgress = Math.min(100, (elapsedMs / SLIDE_DURATION_MS) * 100);
      setStripeProgressPercent(nextProgress);

      if (elapsedMs >= SLIDE_DURATION_MS) {
        window.clearInterval(id);
        setStripeTwoIndex((prev) => clampIndex(prev + 1, stripeTwoCount));
      }
    }, PROGRESS_TICK_MS);

    return () => window.clearInterval(id);
  }, [stripeTwoCount, stripeTwoIndex]);

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

  return (
    <div className={`relative min-h-0 flex-1 ${className}`}>
      <div
        className="relative h-full flex flex-col overflow-hidden rounded-2xl border border-[#f0e5a5]/45 bg-black/52 px-3 py-2.5 text-stone-100"
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          {currentSlidePreviewImage ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${currentSlidePreviewImage})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% auto",
                backgroundPosition: "50% 50%",
                filter: "saturate(1.08) contrast(1.04)",
              }}
            />
          ) : null}

          <div
            className="absolute inset-0"
            style={{
              background: isMissingSpeciesMilestone ? "rgba(0,0,0,0.52)" : "rgba(0,0,0,0.34)",
            }}
          />

          {currentSlidePreviewImage ? (
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                maskImage:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,1) 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,1) 100%)",
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0.18) 100%)",
              }}
            />
          ) : null}

          <div
            className="absolute inset-x-6 top-0 h-px bg-[#f0e5a5]/40"
          />
        </div>

        <div
          className="relative z-[1] flex-1 min-h-0"
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
            <>
              <button
                type="button"
                onClick={() => {
                  if (canOpenCurrentSlidePreview) {
                    onMilestonePreviewClick?.(currentStripeTwoSlide.payload);
                  }
                }}
                disabled={!canOpenCurrentSlidePreview}
                className={`absolute inset-y-0 left-0 z-[2] w-1/2 ${canOpenCurrentSlidePreview ? "cursor-pointer" : "cursor-default"}`}
                aria-label={canOpenCurrentSlidePreview ? "Scan-Detail öffnen" : "Kein Scan-Detail verfügbar"}
              />

              <div className="absolute inset-y-0 right-0 z-[2] w-1/2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStripeTwoSlide.kind === "milestone" && currentStripeTwoSlide.payload) {
                      onMilestoneAction?.(currentStripeTwoSlide.payload);
                    }
                  }}
                  className="flex h-full w-full min-w-0 flex-col justify-center overflow-hidden px-3 text-right sm:px-4"
                >
                  {renderStripeTwoSlideBody(currentStripeTwoSlide)}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 z-[-1] w-1/2 min-w-0 opacity-0" aria-hidden="true">
          <div className="px-3 sm:px-4">
            {stripeTwoSlides.map((slide) => (
              <div key={`measure-${slide.id}`} ref={setStripeTwoMeasureRef(slide.id)} className="w-full">
                {renderStripeTwoSlideBody(slide)}
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-[1px] bottom-0 z-[4] h-[2px] overflow-hidden rounded-full bg-[#f0e5a5]/12" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[#f0e5a5]/45 transition-[width] duration-75 ease-linear"
            style={{ width: `${stripeProgressPercent}%` }}
          />
        </div>

      </div>
    </div>
  );
}

export default function HomeCollectionStripes({
  isLightUi,
  profile,
  logoAssets = [],
  selectedProfileBadges = [],
  onLogoClick,
  elevateLogo = false,
  playerSeeds = 0,
  playerSeedsDisplay = "0",
  conqueredZonesDisplay = "0",
  healthSeedBonusDisplay = 0,
  className = "",
}) {
  const logoButtonRef = useRef(null);
  const floatingLogoUnmountTimeoutRef = useRef(null);
  const [floatingLogoRect, setFloatingLogoRect] = useState(null);
  const [isFloatingLogoMounted, setIsFloatingLogoMounted] = useState(false);
  const [isFloatingLogoVisible, setIsFloatingLogoVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (floatingLogoUnmountTimeoutRef.current) {
        window.clearTimeout(floatingLogoUnmountTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (floatingLogoUnmountTimeoutRef.current) {
      window.clearTimeout(floatingLogoUnmountTimeoutRef.current);
      floatingLogoUnmountTimeoutRef.current = null;
    }

    if (elevateLogo) {
      setIsFloatingLogoMounted(true);
      const rafId = window.requestAnimationFrame(() => {
        setIsFloatingLogoVisible(true);
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    setIsFloatingLogoVisible(false);
    floatingLogoUnmountTimeoutRef.current = window.setTimeout(() => {
      setIsFloatingLogoMounted(false);
      setFloatingLogoRect(null);
      floatingLogoUnmountTimeoutRef.current = null;
    }, OVERLAY_EXIT_FADE_MS);

    return undefined;
  }, [elevateLogo]);

  const updateFloatingLogoRect = useCallback(() => {
    if (!elevateLogo) {
      return;
    }

    const node = logoButtonRef.current;
    if (!node) {
      return;
    }

    const nextRect = node.getBoundingClientRect();
    if (!nextRect.width || !nextRect.height) {
      return;
    }

    setFloatingLogoRect((prevRect) => {
      if (
        prevRect &&
        Math.abs(prevRect.left - nextRect.left) < 0.5 &&
        Math.abs(prevRect.top - nextRect.top) < 0.5 &&
        Math.abs(prevRect.width - nextRect.width) < 0.5 &&
        Math.abs(prevRect.height - nextRect.height) < 0.5
      ) {
        return prevRect;
      }

      return {
        left: nextRect.left,
        top: nextRect.top,
        width: nextRect.width,
        height: nextRect.height,
      };
    });
  }, [elevateLogo]);

  useEffect(() => {
    if (!elevateLogo) {
      return undefined;
    }

    let firstRaf = null;
    let secondRaf = null;

    const scheduleMeasure = () => {
      if (firstRaf) {
        window.cancelAnimationFrame(firstRaf);
      }
      firstRaf = window.requestAnimationFrame(() => {
        updateFloatingLogoRect();
      });
    };

    // Measure twice at startup to settle transforms/responsive layout before pinning.
    scheduleMeasure();
    secondRaf = window.requestAnimationFrame(() => {
      updateFloatingLogoRect();
    });

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleMeasure);
    viewport?.addEventListener("scroll", scheduleMeasure);

    return () => {
      if (firstRaf) {
        window.cancelAnimationFrame(firstRaf);
      }
      if (secondRaf) {
        window.cancelAnimationFrame(secondRaf);
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [elevateLogo, updateFloatingLogoRect]);

  const floatingLogoPortal =
    isFloatingLogoMounted &&
    floatingLogoRect &&
    typeof document !== "undefined" &&
    document.body
      ? createPortal(
          <div
            className="pointer-events-none fixed transition-opacity duration-[350ms] ease-out"
            aria-hidden="true"
            style={{
              left: `${floatingLogoRect.left}px`,
              top: `${floatingLogoRect.top}px`,
              width: `${floatingLogoRect.width}px`,
              height: `${floatingLogoRect.height}px`,
              zIndex: 320,
              opacity: isFloatingLogoVisible ? 1 : 0,
            }}
          >
            <FlorabotLogo
              profile={profile}
              logoAssets={logoAssets}
              sizeClass="w-full h-full"
              padding="p-[7%]"
              className="drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]"
            />
          </div>,
          document.body
        )
      : null;

  const selectedBadges = Array.isArray(selectedProfileBadges)
    ? selectedProfileBadges.filter(Boolean).slice(0, 3)
    : [];
  const badgeSlots = Array.from({ length: 3 }, (_, index) => selectedBadges[index] || null);
  const badgeArcPositions = [
    "left-1/2 top-[3.3rem] -translate-x-[6.5rem]",
    "left-1/2 top-[1.05rem] -translate-x-1/2",
    "left-1/2 top-[3.3rem] translate-x-[2.5rem]",
  ];
  const badgeGlassClassName = "border-[#f0e5a5]/55 bg-black/88 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl";

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
      <div className="relative min-h-[17.25rem] flex-1 text-stone-100 sm:min-h-[19.25rem]" aria-label="Florabot und Abzeichen">
        <div className="absolute inset-x-0 top-0 z-20 h-[7.25rem]" aria-label="Ausgewaehlte Abzeichen">
          {badgeSlots.map((badge, slotIndex) => {
            const positionClassName = badgeArcPositions[slotIndex] || badgeArcPositions[1];

            if (!badge) {
              return (
                <div
                  key={`badge-slot-empty-${slotIndex}`}
                  className={`absolute ${positionClassName} h-16 w-16 overflow-hidden rounded-full border flex items-center justify-center text-[9px] font-medium ${badgeGlassClassName}`}
                >
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.34),rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_66%)]" />
                  <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10" />
                  <span className="relative z-[1] text-stone-300/70">Leer</span>
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
                  className={`absolute ${positionClassName} h-16 w-16 overflow-hidden rounded-full border flex flex-col items-center justify-center gap-1 ${badgeGlassClassName}`}
                  aria-label={`${badge.label}: ${valueLabel}, Rang ${rankLabel}`}
                >
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.34),rgba(255,255,255,0.08)_34%,rgba(255,255,255,0)_66%)]" />
                  <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10" />
                  <Icon className={`relative z-[1] h-6 w-6 ${iconToneClass}`} />
                  <span className="relative z-[1] w-full max-w-[3.3rem] text-center text-[10px] leading-none font-bold text-stone-100">
                    {valueLabel}
                  </span>
                </button>
              </LockedTooltip>
            );
          })}
        </div>

        <div className="absolute inset-x-0 bottom-0 top-[3.25rem] flex items-center justify-center pt-8 sm:top-[3.75rem]">
          <button
            type="button"
            ref={logoButtonRef}
            onClick={() => onLogoClick?.()}
            className={`relative shrink-0 translate-y-3 scale-[1.2] sm:translate-y-4 ${elevateLogo ? "z-[260]" : ""}`}
            aria-label="Florabot Overlay öffnen"
          >
            <FlorabotLogo
              profile={profile}
              logoAssets={logoAssets}
              sizeClass="w-48 h-48 sm:w-56 sm:h-56"
              padding="p-[7%]"
              className="drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]"
            />
          </button>
        </div>
      </div>

      <div className="shrink-0 px-1 py-1">
        <div className="grid grid-cols-3 gap-2">
          <div
            className={`px-2 py-1 flex items-center justify-center gap-1.5 ${
              isLightUi ? "text-stone-700/85" : "text-stone-200/80"
            }`}
            aria-label={`Samen: ${playerSeedsDisplay}`}
          >
            <Leaf className={`h-3.5 w-3.5 ${isLightUi ? "text-emerald-700/85" : "text-emerald-300/85"}`} />
            <span className="text-[11px] font-medium leading-none">{playerSeedsDisplay}</span>
          </div>

          <div
            className={`px-2 py-1 flex items-center justify-center gap-1.5 ${
              isLightUi ? "text-stone-700/85" : "text-stone-200/80"
            }`}
            aria-label={`Eroberte Zonen: ${conqueredZonesDisplay}`}
          >
            <InspectionPanel className={`h-3.5 w-3.5 ${isLightUi ? "text-sky-700/85" : "text-sky-300/85"}`} />
            <span className="text-[11px] font-medium leading-none">{conqueredZonesDisplay}</span>
          </div>

          <div
            className={`px-2 py-1 flex items-center justify-center gap-1.5 ${
              isLightUi ? "text-stone-700/85" : "text-stone-200/80"
            }`}
            aria-label={`Gesundheitsbonus: +${healthSeedBonusDisplay} Samen`}
          >
            <HeartPulse className={`h-3.5 w-3.5 ${isLightUi ? "text-rose-700/85" : "text-rose-300/85"}`} />
            <span className="text-[11px] font-medium leading-none">+{healthSeedBonusDisplay}</span>
          </div>
        </div>
      </div>

      {floatingLogoPortal}
    </div>
  );
}

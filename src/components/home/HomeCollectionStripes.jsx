import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, CheckCircle2, HeartPulse, InspectionPanel, Leaf, Target } from "lucide-react";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";

const SWIPE_THRESHOLD_PX = 36;
const SLIDE_DURATION_MS = 6500;
const PROGRESS_TICK_MS = 50;
const OVERLAY_EXIT_FADE_MS = 350;
const FLOW_TEXT_SINGLE_LINE_MAX_CHARS = 84;
const BADGE_LOGO_MIN_SCALE = 0.24;
const BADGE_LOGO_MAX_SCALE = 1.56;
const BADGE_LOGO_FILL_HEIGHT_RATIO = 0.98;
const BADGE_LOGO_FILL_WIDTH_RATIO = 0.96;
const BADGE_LOGO_VISIBLE_HEIGHT_RATIO = 0.72;
const BADGE_LOGO_UNIT_HEIGHT_REM = 10;
const BADGE_LOGO_UNIT_MAX_WIDTH_REM = 22;
const BADGE_ROW_HEIGHT_REM = 7.25;
const LOGO_ROW_TOP_REM = 4.9;
const BADGE_TOP_SIDE_REM = 2.9;
const BADGE_TOP_CENTER_REM = 1.1;
const FLORABOT_NAME_FALLBACK = "Florabot";

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
  kpiSummary = null,
  controlsScale = 1,
  onMilestoneAction,
  onMilestonePreviewClick,
  className = "",
}) {
  const stripeRootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [stripeTwoIndex, setStripeTwoIndex] = useState(0);
  const [stripeTwoContentHeight, setStripeTwoContentHeight] = useState(null);
  const [stripeProgressPercent, setStripeProgressPercent] = useState(0);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const stripeTwoTouchStartX = useRef(null);
  const stripeTwoMeasureRefs = useRef(new Map());
  const scanButtonHeightRem = Math.max(2.8, 3.35 * (Number(controlsScale) || 1));

  const stripeTwoSlides = useMemo(() => {
    const slides = [];

    if (Array.isArray(milestoneFeed)) {
      milestoneFeed.forEach((item) => {
        if (item?.kind === "quest") {
          slides.push({
            id: item.id || "weekly-quest",
            kind: "quest",
            title: item.title || "Wöchentliche Quest",
            payload: item.payload || {},
            actionPayload: item,
          });
        } else if (item?.kind === "kpi") {
          slides.push({
            id: item.id || "kpi-overview",
            kind: "kpi",
            title: item.title || "Deine KPI",
            previewImageUrl: "",
            payload: {
              playerSeedsDisplay: String(item.kpiSummary?.playerSeedsDisplay || kpiSummary?.playerSeedsDisplay || "0"),
              conqueredZonesDisplay: String(item.kpiSummary?.conqueredZonesDisplay || kpiSummary?.conqueredZonesDisplay || "0"),
              healthSeedBonusDisplay: Math.max(0, Math.round(Number(item.kpiSummary?.healthSeedBonusDisplay || kpiSummary?.healthSeedBonusDisplay) || 0)),
              securedMultiplier: Number.isFinite(Number(item.kpiSummary?.securedMultiplier || kpiSummary?.securedMultiplier))
                ? Number(item.kpiSummary?.securedMultiplier || kpiSummary?.securedMultiplier)
                : null,
              zoneHintText: String(item.kpiSummary?.zoneHintText || kpiSummary?.zoneHintText || "").trim(),
              nearestZoneDirectionIcon: String(item.kpiSummary?.nearestZoneDirectionIcon || kpiSummary?.nearestZoneDirectionIcon || "").trim(),
              nearestZoneDistanceKm: Number.isFinite(Number(item.kpiSummary?.nearestZoneDistanceKm || kpiSummary?.nearestZoneDistanceKm))
                ? Number(item.kpiSummary?.nearestZoneDistanceKm || kpiSummary?.nearestZoneDistanceKm)
                : null,
            },
          });
        } else {
          slides.push({
            id: `milestone-${item.id}`,
            kind: "milestone",
            title: item.title,
            detail: item.detail,
            previewImageUrl: item.previewImageUrl || "",
            payload: item,
          });
        }
      });
    }

    if (slides.length === 0) {
      slides.push({
        id: "fallback-empty",
        kind: "fallback",
        title: "Noch keine Highlights verfügbar",
        detail: "Sobald neue Meilensteine vorliegen, erscheinen sie hier.",
        previewImageUrl: "",
        payload: null,
      });
    }

    return slides;
  }, [kpiSummary, milestoneFeed]);

  const stripeTwoCount = stripeTwoSlides.length;
  const currentStripeTwoSlide = stripeTwoSlides[clampIndex(stripeTwoIndex, stripeTwoCount)] || null;
  const shouldGrowStripeForFlowText =
    isCompactLayout &&
    currentStripeTwoSlide?.kind === "milestone" &&
    String(currentStripeTwoSlide?.detail || "").trim().length > FLOW_TEXT_SINGLE_LINE_MAX_CHARS;
  const compactStripeHeightRem = shouldGrowStripeForFlowText
    ? Math.max(scanButtonHeightRem + 0.85, scanButtonHeightRem * 1.25)
    : scanButtonHeightRem;
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
  const currentSlideUsesFullWidth =
    currentStripeTwoSlide?.kind !== "milestone" || !currentSlidePreviewImage;

  const renderStripeTwoSlideBody = (slide) => {
    if (!slide) return null;

    if (slide.kind === "quest") {
      const q = slide.payload || {};
      const rawProgress = Number(q.progress || 0);
      const required = Number(q.required_discoveries || 0);
      const displayProgress = required > 0 ? Math.min(rawProgress, required) : rawProgress;
      const progressPercent = required > 0 ? Math.min(100, (rawProgress / required) * 100) : 0;
      const isCompleted = Boolean(q.isCompleted);

      if (isCompactLayout) {
        return (
          <div className="flex h-full w-full items-center justify-between gap-1.5 text-[0.72rem] leading-none text-stone-100">
            <span className="inline-flex shrink-0 items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-300/90" />
              <span className="text-[0.68rem] font-medium text-emerald-200/90">Wöchentlich</span>
            </span>
            <span className="min-w-0 flex-1 truncate text-center font-semibold">{q.title}</span>
            {isCompleted ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : required > 0 ? (
              <span className="shrink-0 text-[0.68rem] text-stone-300/80">{displayProgress}/{required}</span>
            ) : null}
          </div>
        );
      }

      return (
        <div className="flex h-full w-full flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
              <CalendarDays className="h-3 w-3" />
              Wöchentlich
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-green-400/30 bg-green-500/25 px-1.5 py-0.5 text-[10px] font-medium text-green-200">
                <CheckCircle2 className="h-3 w-3" />
                Abgeschlossen
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-[0.88rem] font-semibold leading-tight text-white/95">{q.title}</p>
          {q.description && (
            <p className="line-clamp-1 text-[0.75rem] leading-snug text-stone-300/80">{q.description}</p>
          )}
          {required > 0 && (
            <div className="mt-0.5 space-y-0.5">
              <div className="flex justify-between text-[10px] text-stone-300/70">
                <span>Fortschritt</span>
                <span className="font-semibold text-stone-200/90">{displayProgress} / {required}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-emerald-400/80 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    if (slide.kind === "kpi") {
      const payload = slide.payload || {};
      const multiplierLabel =
        Number.isFinite(payload.securedMultiplier) && payload.securedMultiplier > 0
          ? `x${payload.securedMultiplier.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`
          : "x1";
      const nearestDistanceLabel =
        Number.isFinite(payload.nearestZoneDistanceKm) && payload.nearestZoneDistanceKm >= 0
          ? `${payload.nearestZoneDistanceKm.toFixed(1).replace(".", ",")} km`
          : "";
      const nearestHintRaw = [payload.nearestZoneDirectionIcon, payload.zoneHintText, nearestDistanceLabel]
        .filter(Boolean)
        .join(" ");

      if (isCompactLayout) {
        return (
          <div className="flex h-full w-full items-center justify-between gap-1.5 text-[0.72rem] leading-none text-stone-100">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Leaf className="h-3.5 w-3.5 shrink-0 text-emerald-200/90" />
              <span className="truncate font-semibold">{payload.playerSeedsDisplay}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <InspectionPanel className="h-3.5 w-3.5 shrink-0 text-sky-200/90" />
              <span className="truncate font-semibold">{payload.conqueredZonesDisplay}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <HeartPulse className="h-3.5 w-3.5 shrink-0 text-rose-200/90" />
              <span className="truncate font-semibold">+{payload.healthSeedBonusDisplay}</span>
            </span>
            <span className="truncate text-[0.68rem] text-stone-200/90">{multiplierLabel}</span>
          </div>
        );
      }

      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLightUi ? "text-emerald-200/95" : "text-emerald-200/85"}`}>
            {slide.title}
          </p>
          <div className="flex w-full items-center justify-between gap-2 text-stone-100">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[0.8rem]">
              <Leaf className="h-3.5 w-3.5 shrink-0 text-emerald-200/90" />
              <span className="truncate font-semibold">{payload.playerSeedsDisplay}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[0.8rem]">
              <InspectionPanel className="h-3.5 w-3.5 shrink-0 text-sky-200/90" />
              <span className="truncate font-semibold">{payload.conqueredZonesDisplay}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[0.8rem]">
              <HeartPulse className="h-3.5 w-3.5 shrink-0 text-rose-200/90" />
              <span className="truncate font-semibold">+{payload.healthSeedBonusDisplay}</span>
            </span>
          </div>
          <p className="truncate text-right text-[10px] text-stone-200/85">
            {nearestHintRaw ? `${nearestHintRaw}  |  Nächster Scan ${multiplierLabel}` : `Nächster Scan ${multiplierLabel}`}
          </p>
        </div>
      );
    }

    const milestonePayload = slide.kind === "milestone" ? slide.payload : null;
    const genusName = String(milestonePayload?.genusName || "").trim();
    const canOpenOwnGenus =
      Boolean(milestonePayload?.actionType === "open_genus" && milestonePayload?.genusId && genusName);
    const shouldRelaxCompactMilestoneText =
      isCompactLayout && String(slide.detail || "").trim().length > FLOW_TEXT_SINGLE_LINE_MAX_CHARS;
    const milestoneTitleClass = isCompactLayout
      ? `text-[10px] font-semibold uppercase tracking-wide mb-0.5 text-right ${
          isLightUi ? "text-emerald-200/90" : "text-emerald-200/85"
        }`
      : `text-[11px] font-semibold uppercase tracking-wide mb-1 text-right ${
          isLightUi ? "text-emerald-200/90" : "text-emerald-200/85"
        }`;
    const milestoneDetailClass = isCompactLayout
      ? shouldRelaxCompactMilestoneText
        ? `mt-0.5 text-right text-[0.8rem] leading-snug ${isLightUi ? "text-stone-100/90" : "text-stone-200/90"}`
        : `mt-0.5 whitespace-nowrap truncate text-right text-[0.8rem] leading-tight ${isLightUi ? "text-stone-100/90" : "text-stone-200/90"}`
      : `mt-1 text-right text-[0.88rem] leading-snug line-clamp-3 ${isLightUi ? "text-stone-100/90" : "text-stone-200/90"}`;

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
        <p className={milestoneTitleClass}>
          {renderTextWithClickableGenus(slide.title, `${slide.id}-title`)}
        </p>
        <p className={milestoneDetailClass}>
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
    const rootNode = stripeRootRef.current;
    if (!rootNode) return undefined;

    const compactThresholdPx = scanButtonHeightRem * 16 * 1.75;

    /** @type {number | null} */
    let rafId = null;
    const scheduleCompactMeasure = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const availableHeight = rootNode.clientHeight;
        setIsCompactLayout(availableHeight > 0 && availableHeight <= compactThresholdPx);
      });
    };

    scheduleCompactMeasure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleCompactMeasure()) : null;
    observer?.observe(rootNode);
    window.addEventListener("resize", scheduleCompactMeasure);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", scheduleCompactMeasure);
    };
  }, [scanButtonHeightRem]);

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
    <div ref={stripeRootRef} className={`relative min-h-0 flex-1 ${className}`}>
      <div
        className={`relative h-full flex flex-col overflow-hidden rounded-2xl border border-[#f0e5a5]/45 bg-black/52 text-stone-100 ${
          isCompactLayout ? "px-2.5 py-1.5" : "px-3 py-2.5"
        }`}
        style={isCompactLayout ? { height: `${compactStripeHeightRem.toFixed(2)}rem` } : undefined}
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
              {currentStripeTwoSlide.kind === "kpi" ? (
                <div className="absolute inset-0 z-[2] flex min-w-0 items-center px-1">
                  {renderStripeTwoSlideBody(currentStripeTwoSlide)}
                </div>
              ) : currentStripeTwoSlide.kind === "quest" ? (
                <button
                  type="button"
                  onClick={() => onMilestoneAction?.(currentStripeTwoSlide.actionPayload)}
                  className="absolute inset-0 z-[2] flex min-w-0 flex-col justify-center px-3 text-left"
                >
                  {renderStripeTwoSlideBody(currentStripeTwoSlide)}
                </button>
              ) : (
                <>
                  {!currentSlideUsesFullWidth ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (canOpenCurrentSlidePreview) {
                          onMilestonePreviewClick?.(currentStripeTwoSlide.payload);
                        }
                      }}
                      disabled={!canOpenCurrentSlidePreview}
                      className={`absolute inset-y-0 left-0 z-[2] w-[20%] sm:w-1/2 ${canOpenCurrentSlidePreview ? "cursor-pointer" : "cursor-default"}`}
                      aria-label={canOpenCurrentSlidePreview ? "Scan-Detail öffnen" : "Kein Scan-Detail verfügbar"}
                    />
                  ) : null}

                  <div
                    className={`absolute inset-y-0 right-0 z-[2] min-w-0 ${
                      currentSlideUsesFullWidth ? "left-0 w-full" : "w-[80%] sm:w-1/2"
                    }`}
                  >
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
              )}
            </>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-0 z-[-1] opacity-0" aria-hidden="true">
          <div className="h-full px-1 sm:px-2">
            {stripeTwoSlides.map((slide) => (
              <div
                key={`measure-${slide.id}`}
                ref={setStripeTwoMeasureRef(slide.id)}
                className={`${
                  slide.kind === "kpi" || slide.kind === "quest" || !slide.previewImageUrl ? "w-full" : "ml-auto w-[80%] sm:w-1/2"
                }`}
              >
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
  className = "",
}) {
  const collectionRootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const badgeLogoViewportRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const badgeLogoUnitRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const logoButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const floatingLogoUnmountTimeoutRef = useRef(/** @type {number | null} */ (null));
  const [floatingLogoRect, setFloatingLogoRect] = useState(/** @type {{left:number,top:number,width:number,height:number} | null} */ (null));
  const [isFloatingLogoMounted, setIsFloatingLogoMounted] = useState(false);
  const [isFloatingLogoVisible, setIsFloatingLogoVisible] = useState(false);
  const [badgeLogoScale, setBadgeLogoScale] = useState(1);
  const badgeLogoScaleRef = useRef(1);

  useEffect(() => {
    badgeLogoScaleRef.current = badgeLogoScale;
  }, [badgeLogoScale]);

  const updateBadgeLogoScale = useCallback(() => {
    const viewportNode = badgeLogoViewportRef.current;
    const unitNode = badgeLogoUnitRef.current;
    if (!viewportNode || !unitNode) return;

    const availableHeight = Math.max(1, viewportNode.clientHeight);
    const availableWidth = Math.max(1, viewportNode.clientWidth);
    const currentUnitScale = Math.max(0.01, badgeLogoScaleRef.current || 1);
    const unitRect = unitNode.getBoundingClientRect();
    const unitHeight = Math.max(1, unitRect.height / currentUnitScale);
    const unitWidth = Math.max(1, unitRect.width / currentUnitScale);

    const logoNode = logoButtonRef.current;
    const logoRect = logoNode?.getBoundingClientRect();
    // logoHeight: height of logo button in unit-coordinate space (removes unit scale, keeps button's own scale-[1.24])
    const logoHeight = Math.max(1, (logoRect?.height || 0) / currentUnitScale);

    // Effective content bottom in unit's natural coordinate system:
    // = top offset of logo button + visible portion of logo height.
    // pxPerRem derived from the unit's own measured height to respect non-default font sizes.
    const pxPerRem = unitHeight / BADGE_LOGO_UNIT_HEIGHT_REM;
    const logoRowTopPx = LOGO_ROW_TOP_REM * pxPerRem;
    const effectiveUnitHeight = Math.max(1, logoRowTopPx + logoHeight * BADGE_LOGO_VISIBLE_HEIGHT_RATIO);

    const heightScale = (availableHeight * BADGE_LOGO_FILL_HEIGHT_RATIO) / effectiveUnitHeight;
    const widthScale = (availableWidth * BADGE_LOGO_FILL_WIDTH_RATIO) / unitWidth;
    const nextScale = Math.max(
      BADGE_LOGO_MIN_SCALE,
      Math.min(BADGE_LOGO_MAX_SCALE, heightScale, widthScale)
    );

    setBadgeLogoScale((prevScale) => (Math.abs(prevScale - nextScale) < 0.01 ? prevScale : nextScale));
  }, []);

  useEffect(() => {
    /** @type {number | null} */
    let rafId = null;
    const scheduleUpdate = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateBadgeLogoScale();
      });
    };

    scheduleUpdate();

    window.addEventListener("resize", scheduleUpdate);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleUpdate()) : null;
    if (observer && badgeLogoViewportRef.current) {
      observer.observe(badgeLogoViewportRef.current);
    }
    if (observer && badgeLogoUnitRef.current) {
      observer.observe(badgeLogoUnitRef.current);
    }
    if (observer && logoButtonRef.current) {
      observer.observe(logoButtonRef.current);
    }

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [updateBadgeLogoScale]);

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

    /** @type {number | null} */
    let firstRaf = null;
    /** @type {number | null} */
    let secondRaf = null;

    const scheduleMeasure = () => {
      if (firstRaf) {
        window.cancelAnimationFrame(firstRaf);
      }
      firstRaf = window.requestAnimationFrame(() => {
        updateFloatingLogoRect();
      });
    };

    // IMPORTANT (AI patch note): Keep this effect dependent on layout toggles that can move
    // the logo without resize/scroll events (e.g. centerBadgeLogoUnit).
    // HomeFlorabotOverlay measures the portal rect to render its ring animation; stale rects
    // break centering and the logo is no longer correctly encircled.
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
  }, [badgeLogoScale, elevateLogo, updateFloatingLogoRect]);

  const selectedBadges = Array.isArray(selectedProfileBadges)
    ? selectedProfileBadges.filter(Boolean).slice(0, 3)
    : [];
  const badgeSlots = Array.from({ length: 3 }, (_, index) => selectedBadges[index] || null);
  const badgeArcPositions = [
    { left: "16.6667%", topRem: BADGE_TOP_SIDE_REM },
    { left: "50%", topRem: BADGE_TOP_CENTER_REM },
    { left: "83.3333%", topRem: BADGE_TOP_SIDE_REM },
  ];
  const badgeGlassClassName = "border-[#f0e5a5]/55 bg-black/88 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl";
  const florabotName = String(profile?.bot_name || FLORABOT_NAME_FALLBACK).trim() || FLORABOT_NAME_FALLBACK;
  const florabotNameLabel = florabotName.length > 26 ? `${florabotName.slice(0, 25)}…` : florabotName;
  const florabotNameBadgeClassName = `inline-flex max-w-[11.5rem] items-center justify-center rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.04em] ${badgeGlassClassName}`;

  const renderFlorabotNameBadge = (extraClassName = "") => (
    <div
      className={`${florabotNameBadgeClassName} ${extraClassName}`.trim()}
      aria-label={`Florabot Name: ${florabotName}`}
      title={florabotName}
    >
      <span className="truncate">{florabotNameLabel}</span>
    </div>
  );

  const floatingLogoPortal =
    isFloatingLogoMounted &&
    floatingLogoRect &&
    typeof document !== "undefined" &&
    document.body
      ? createPortal(
          <div
            className="pointer-events-none fixed transition-opacity duration-[350ms] ease-out"
            aria-hidden="true"
            data-floating-logo-overlay="true"
            style={{
              left: `${floatingLogoRect.left}px`,
              top: `${floatingLogoRect.top}px`,
              width: `${floatingLogoRect.width}px`,
              height: `${floatingLogoRect.height}px`,
              zIndex: 320,
              opacity: isFloatingLogoVisible ? 1 : 0,
            }}
          >
            <div className="relative h-full w-full">
              <FlorabotLogo
                profile={profile}
                logoAssets={logoAssets}
                sizeClass="w-full h-full"
                padding="p-[7%]"
                className="drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]"
              />
              <div className="absolute left-1/2 top-[calc(100%+0.45rem)] -translate-x-1/2">
                {renderFlorabotNameBadge()}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

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
    <div ref={collectionRootRef} className={`flex min-h-0 flex-col gap-2 ${className}`}>
      <div
        ref={badgeLogoViewportRef}
        className="relative min-h-0 flex-1 overflow-hidden text-stone-100"
        aria-label="Florabot und Abzeichen"
      >
        <div
          className="absolute inset-0 flex justify-center items-start"
          style={{ pointerEvents: "none" }}
        >
          <div
            ref={badgeLogoUnitRef}
            className="relative w-[20rem] max-w-full"
            style={{
              maxWidth: `${BADGE_LOGO_UNIT_MAX_WIDTH_REM}rem`,
              height: `${BADGE_LOGO_UNIT_HEIGHT_REM}rem`,
              transform: `scale(${badgeLogoScale})`,
              transformOrigin: "top center",
              pointerEvents: "auto",
            }}
          >
          <div
          className="absolute inset-x-0 top-0 z-[220] pointer-events-none"
          style={{ height: `${BADGE_ROW_HEIGHT_REM}rem` }}
          aria-label="Ausgewaehlte Abzeichen"
        >
            {badgeSlots.map((badge, slotIndex) => {
              const badgePosition = badgeArcPositions[slotIndex] || badgeArcPositions[1];
              const badgePositionStyle = {
                left: badgePosition.left,
                top: `${badgePosition.topRem}rem`,
              };

              if (!badge) {
                return (
                  <div
                    key={`badge-slot-empty-${slotIndex}`}
                    style={badgePositionStyle}
                    className={`pointer-events-auto absolute -translate-x-1/2 h-16 w-16 overflow-hidden rounded-full border flex items-center justify-center text-[9px] font-medium ${badgeGlassClassName}`}
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
                    style={badgePositionStyle}
                    className={`pointer-events-auto absolute -translate-x-1/2 h-16 w-16 overflow-hidden rounded-full border flex flex-col items-center justify-center gap-1 ${badgeGlassClassName}`}
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

          <div className="absolute inset-x-0 z-[120] flex justify-center" style={{ top: `${LOGO_ROW_TOP_REM}rem` }}>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                ref={logoButtonRef}
                onClick={() => onLogoClick?.()}
                className={`relative shrink-0 scale-[1.24] ${elevateLogo ? "z-[260]" : ""}`}
                aria-label="Florabot Overlay öffnen"
              >
                <FlorabotLogo
                  profile={profile}
                  logoAssets={logoAssets}
                  sizeClass="w-[12.75rem] h-[12.75rem] sm:w-[14.75rem] sm:h-[14.75rem]"
                  padding="p-[7%]"
                  className="drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]"
                />
              </button>
              {renderFlorabotNameBadge("pointer-events-auto")}
            </div>
          </div>
          </div>
        </div>
      </div>

      {floatingLogoPortal}
    </div>
  );
}

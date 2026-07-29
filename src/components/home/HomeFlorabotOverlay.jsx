import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, HeartPulse, Sparkles, Gem, ArrowLeft } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import FlorabotOverlayShell from "@/components/florabot/FlorabotOverlayShell";
import ShopFeatureRoot from "@/components/shop/ShopFeatureRoot";
import { trackAction } from "@/api/analyticsService";

const PLAYFUL_CARE_ANIMATION_KEYS = Object.freeze(["flip", "squash", "orbit"]);
const PORTAL_CARE_DEBUG_PREFIX = "[PortalCareDebug]";
const TOOLTIP_COPY = {
  de: {
    sparks: "Funken sind die Ingame-Währung. Du bekommst sie für Teilnahme und aktive Nutzung der App.",
    amber: "Bernstein ist eine kaufbare Premium-Währung für besondere Inhalte und Vorteile.",
    status: "Der Pflanzenstatus ist dein Gesamtzustand aus Energie, Datenqualität und Pflege. Ein hoher Status verbessert Belohnungen und stabilisiert deinen täglichen Fortschritt.",
    watering: "Gießen startet Pflegeaktionen. Tippe mich an, um mit mir zu interagieren. Wer mag das nicht?",
    stat: {
      energy: "Energie bekommst du vor allem durch gelaufene Scan-Distanz. Mehr Energie vergrößert deine Zone und verbessert den täglichen Energiegewinn.",
      "data-quality": "Datenqualität bekommst du durch Scans innerhalb aktiver Zonen. Mehr Datenqualität erhöht die Anzahl deiner täglichen Zonen.",
      care: "Pflege bekommst du durch Gießen und den ersten Scan des Tages, sowie erhaltene Likes. Mehr Pflege erhöht den Samen-Multiplikator und gewährt zusätzliche Zone-Rerolls.",
    },
    aria: {
      sparks: "Funken Info",
      amber: "Bernstein Info",
      status: "Pflanzenstatus Info",
      watering: "Gießen Info",
      stat: "Statuswert Info",
    },
  },
  en: {
    sparks: "Sparks are the in-game currency. You earn them through participation and active app usage.",
    amber: "Amber is a purchasable premium currency for special content and advantages.",
    status: "Plant status is your overall state from Energy, Data Quality, and Care. Higher status improves rewards and daily progress stability.",
    watering: "Watering triggers care actions. Tap the speech bubble or care button while daily attempts are available. More care improves your care value and rewards.",
    stat: {
      energy: "You gain Energy mainly from scanned walking distance. More Energy expands your zone and improves daily energy gain.",
      "data-quality": "You gain Data Quality by scanning within active zones. Higher Data Quality increases your daily zone count.",
      care: "You gain Care through watering and additional interactions. Higher Care boosts reward multipliers and extra zone rerolls.",
    },
    aria: {
      sparks: "Sparks info",
      amber: "Amber info",
      status: "Plant status info",
      watering: "Watering info",
      stat: "Status stat info",
    },
  },
};

/** @param {unknown} value */
const normalizeLanguageCode = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace("_", "-");
};

/** @param {...unknown} values */
const resolveTooltipLanguage = (...values) => {
  for (const rawValue of values) {
    const language = normalizeLanguageCode(rawValue);
    if (!language) continue;
    if (language.startsWith("en")) return "en";
    if (language.startsWith("de")) return "de";
  }
  return "de";
};

/** @param {unknown} source */
const extractLanguageCandidates = (source) => {
  if (!source || typeof source !== "object") return [];
  const record = /** @type {Record<string, unknown>} */ (source);
  const keys = ["app_language", "preferred_language", "language", "locale"];
  return keys
    .map((key) => normalizeLanguageCode(record[key]))
    .filter(Boolean);
};

/**
 * @param {EventTarget | null} target
 */
const getEventTargetLabel = (target) => {
  if (!target || typeof target !== "object") return "unknown";
  const element = /** @type {{ tagName?: string, className?: string }} */ (target);
  const tag = String(element.tagName || "node").toLowerCase();
  const className = String(element.className || "").trim();
  if (!className) return tag;
  const shortClasses = className.split(/\s+/).slice(0, 3).join(".");
  return `${tag}.${shortClasses}`;
};

/**
 * @param {{left:number,top:number,width:number,height:number} | DOMRect} rect
 */
const rectToCenterPx = (rect) => ({
  x: Number((rect.left + rect.width / 2).toFixed(2)),
  y: Number((rect.top + rect.height / 2).toFixed(2)),
});

/**
 * @param {{left:number,top:number,width:number,height:number} | DOMRect | null | undefined} rect
 */
const toDebugRect = (rect) => {
  if (!rect) return null;
  return {
    left: Number(rect.left.toFixed(2)),
    top: Number(rect.top.toFixed(2)),
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
  };
};

export default function HomeFlorabotOverlay({
  profile,
  authId = null,
  currentUser = null,
  badgeMetrics = null,
  initialShopCategory = "root",
  logoAssets = [],
  playerSparks,
  playerAmber,
  plantHealthState,
  healthStats = [],
  ambientMessage,
  quizAvailable = false,
  onQuizClick,
  wateringCountToday = 0,
  wateringLimitPerDay = 3,
  remainingWatersToday = 0,
  isDailyCareLoading = false,
  isWateringPending = false,
  onWaterPlant = () => {},
  onSpawnBubble,
  onCustomize,
  onUserUpdated,
  onClose,
}) {
  const { isLightUi } = useUiTheme();
  const tooltipLanguage = resolveTooltipLanguage(
    ...extractLanguageCandidates(currentUser),
    ...extractLanguageCandidates(profile),
    typeof navigator !== "undefined" ? navigator.language : ""
  );
  const tooltipCopy = TOOLTIP_COPY[tooltipLanguage] || TOOLTIP_COPY.de;
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [isSpeechBubbleVisible, setIsSpeechBubbleVisible] = useState(Boolean(ambientMessage) || quizAvailable);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [activeShopCategory, setActiveShopCategory] = useState(initialShopCategory || "root");
  const [isHealthPanelCompact, setIsHealthPanelCompact] = useState(false);
  const [activePlayfulCareAnimation, setActivePlayfulCareAnimation] = useState("");
  const [careAnimationVisualTarget, setCareAnimationVisualTarget] = useState("bubble");
  const [playfulCareAnimationNonce, setPlayfulCareAnimationNonce] = useState(0);
  const [floatingLogoHitRect, setFloatingLogoHitRect] = useState(/** @type {{left:number,top:number,width:number,height:number} | null} */ (null));
  const [shopActionState, setShopActionState] = useState({
    label: "Kaufen",
    disabled: true,
    isBusy: false,
    onAction: () => {},
  });
  const [shopBackState, setShopBackState] = useState({
    canGoBack: false,
    onBack: () => {},
  });
  const [shopViewportHeight, setShopViewportHeight] = useState(/** @type {number | null} */ (null));
  const onCustomizeRef = useRef(onCustomize);

  const statusPanelSlotRef = useRef(null);
  const speechBubbleRef = useRef(null);
  const fixedFooterRef = useRef(null);
  const shopViewportRef = useRef(null);
  const careAnimationTimeoutRef = useRef(/** @type {number | null} */ (null));
  const lastPortalTapTsRef = useRef(0);
  const lastLogoAlignmentLogKeyRef = useRef("");
    useEffect(() => {
      onCustomizeRef.current = onCustomize;
    }, [onCustomize]);

  const fixedFooterReservedHeightExpression = "7.5rem + env(safe-area-inset-bottom)";
  const shopFooterGapPx = 10;

  const shouldRenderSpeechBubble = !isShopOpen && isSpeechBubbleVisible && (showHealthDetails || Boolean(ambientMessage) || quizAvailable);

  useEffect(() => {
    console.log(`${PORTAL_CARE_DEBUG_PREFIX} overlay render state`, {
      isShopOpen,
      isSpeechBubbleVisible,
      showHealthDetails,
      hasAmbientMessage: Boolean(ambientMessage),
      shouldRenderSpeechBubble,
    });
  }, [isShopOpen, isSpeechBubbleVisible, showHealthDetails, ambientMessage, shouldRenderSpeechBubble]);

  useEffect(() => {
    setActiveShopCategory(initialShopCategory || "root");
  }, [initialShopCategory]);

  useEffect(() => {
    if (isShopOpen || typeof document === "undefined") {
      setFloatingLogoHitRect(null);
      return;
    }

    const measureFloatingLogoRect = () => {
      const floatingNode = document.querySelector('[data-floating-logo-overlay="true"]');
      if (!floatingNode || typeof floatingNode.getBoundingClientRect !== "function") {
        setFloatingLogoHitRect(null);
        return;
      }

      const nextRect = floatingNode.getBoundingClientRect();
      if (!nextRect.width || !nextRect.height) {
        setFloatingLogoHitRect(null);
        return;
      }

      setFloatingLogoHitRect((prev) => {
        if (
          prev &&
          Math.abs(prev.left - nextRect.left) < 0.5 &&
          Math.abs(prev.top - nextRect.top) < 0.5 &&
          Math.abs(prev.width - nextRect.width) < 0.5 &&
          Math.abs(prev.height - nextRect.height) < 0.5
        ) {
          return prev;
        }

        console.log(`${PORTAL_CARE_DEBUG_PREFIX} portal logo measured`, {
          portalRectPx: toDebugRect(nextRect),
          portalCenterPx: rectToCenterPx(nextRect),
        });

        return {
          left: nextRect.left,
          top: nextRect.top,
          width: nextRect.width,
          height: nextRect.height,
        };
      });
    };

    let rafId = window.requestAnimationFrame(measureFloatingLogoRect);
    const onLayoutChange = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(measureFloatingLogoRect);
    };

    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [isShopOpen]);

  useEffect(() => {
    if (isShopOpen || typeof document === "undefined") return;

    const floatingNode = document.querySelector('[data-floating-logo-overlay="true"]');
    const portalRect = floatingNode && typeof floatingNode.getBoundingClientRect === "function"
      ? floatingNode.getBoundingClientRect()
      : null;

    const portalCenterPx = portalRect ? rectToCenterPx(portalRect) : null;
    const animationCenterPx = floatingLogoHitRect ? rectToCenterPx(floatingLogoHitRect) : null;
    const deltaPx = portalCenterPx && animationCenterPx
      ? {
          dx: Number((animationCenterPx.x - portalCenterPx.x).toFixed(2)),
          dy: Number((animationCenterPx.y - portalCenterPx.y).toFixed(2)),
        }
      : null;

    const logKey = JSON.stringify({
      portalCenterPx,
      animationCenterPx,
      hasAnimation: Boolean(activePlayfulCareAnimation),
      careAnimationVisualTarget,
    });
    if (lastLogoAlignmentLogKeyRef.current === logKey) return;
    lastLogoAlignmentLogKeyRef.current = logKey;

    console.log(`${PORTAL_CARE_DEBUG_PREFIX} overlay logo center alignment`, {
      portalRectPx: toDebugRect(portalRect),
      portalCenterPx,
      animationRectPx: toDebugRect(floatingLogoHitRect),
      animationCenterPx,
      deltaPx,
      hasAnimation: Boolean(activePlayfulCareAnimation),
      careAnimationVisualTarget,
    });
  }, [floatingLogoHitRect, isShopOpen, activePlayfulCareAnimation, careAnimationVisualTarget, playfulCareAnimationNonce]);

  useEffect(() => {
    const target = statusPanelSlotRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries?.[0];
      if (!entry) return;
      const availableHeight = entry.contentRect?.height || 0;
      setIsHealthPanelCompact(availableHeight > 0 && availableHeight < 220);
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isShopOpen) {
      setShopViewportHeight(null);
      return;
    }

    const measureShopViewport = () => {
      const shopViewportEl = shopViewportRef.current;
      const fixedFooterEl = fixedFooterRef.current;
      if (!shopViewportEl || !fixedFooterEl) return;

      const shopTop = shopViewportEl.getBoundingClientRect().top;
      const footerTop = fixedFooterEl.getBoundingClientRect().top;
      const nextHeight = Math.max(0, Math.floor(footerTop - shopTop - shopFooterGapPx));

      setShopViewportHeight((prev) => {
        if (prev != null && Math.abs(prev - nextHeight) < 2) return prev;
        return nextHeight;
      });
    };

    let rafId = null;
    const scheduleMeasure = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measureShopViewport();
      });
    };

    scheduleMeasure();

    const canObserve = typeof ResizeObserver !== "undefined";
    const observer = canObserve ? new ResizeObserver(() => scheduleMeasure()) : null;
    if (observer) {
      if (fixedFooterRef.current) observer.observe(fixedFooterRef.current);
      if (shopViewportRef.current) observer.observe(shopViewportRef.current);
      if (statusPanelSlotRef.current) observer.observe(statusPanelSlotRef.current);
    }

    window.addEventListener("resize", scheduleMeasure);

    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [isShopOpen]);

  useEffect(() => {
    return () => {
      onCustomizeRef.current?.(false);
      if (careAnimationTimeoutRef.current) {
        window.clearTimeout(careAnimationTimeoutRef.current);
        careAnimationTimeoutRef.current = null;
      }
    };
  }, []);

  const safeWateringLimitPerDay = Math.max(1, Number(wateringLimitPerDay) || 3);
  const safeWateringCountToday = Math.max(0, Math.min(safeWateringLimitPerDay, Number(wateringCountToday) || 0));
  const canPerformCareAction = !isDailyCareLoading && !isWateringPending && safeWateringCountToday < safeWateringLimitPerDay;
  const triggerPlayfulCareAnimation = (visualTarget = "bubble") => {
    const randomIndex = Math.floor(Math.random() * PLAYFUL_CARE_ANIMATION_KEYS.length);
    const nextAnimation = PLAYFUL_CARE_ANIMATION_KEYS[randomIndex] || PLAYFUL_CARE_ANIMATION_KEYS[0];

    if (careAnimationTimeoutRef.current) {
      window.clearTimeout(careAnimationTimeoutRef.current);
    }

    setCareAnimationVisualTarget(visualTarget);
    setActivePlayfulCareAnimation(nextAnimation);
    setPlayfulCareAnimationNonce((prev) => prev + 1);

    careAnimationTimeoutRef.current = window.setTimeout(() => {
      setActivePlayfulCareAnimation("");
      setCareAnimationVisualTarget("bubble");
      careAnimationTimeoutRef.current = null;
    }, 920);

    return nextAnimation;
  };

  const handlePortalCopyTap = (source = "unknown") => {
    const now = Date.now();
    const tapIntervalMs = now - lastPortalTapTsRef.current;
    console.log(`${PORTAL_CARE_DEBUG_PREFIX} tap received`, {
      source,
      tapIntervalMs,
      showHealthDetails,
      hasAmbientMessage: Boolean(ambientMessage),
      isWateringPending,
      isDailyCareLoading,
      wateringCountToday: safeWateringCountToday,
      wateringLimitPerDay: safeWateringLimitPerDay,
      remainingWatersToday: Number(remainingWatersToday) || 0,
      canPerformCareAction,
    });

    if (now - lastPortalTapTsRef.current < 220) {
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} tap ignored (throttled)`, {
        source,
        tapIntervalMs,
      });
      return;
    }
    lastPortalTapTsRef.current = now;

    if (showHealthDetails) {
      console.log(`${PORTAL_CARE_DEBUG_PREFIX} tap ignored (health details open)`);
      return;
    }

    // Logo-hit: spawn a soap bubble instead of directly triggering care
    if (source.startsWith("logo-hit")) {
      if (canPerformCareAction) {
        console.log(`${PORTAL_CARE_DEBUG_PREFIX} logo-hit → spawn bubble`);
        onSpawnBubble?.();
      } else {
        console.log(`${PORTAL_CARE_DEBUG_PREFIX} logo-hit ignored (care not available)`);
      }
      return;
    }

    // Speech bubble tap: no animation, no care action (care only via soap bubble)
    console.log(`${PORTAL_CARE_DEBUG_PREFIX} bubble tap — no action (use soap bubble for care)`);
  };

  const handleStatusToggle = () => {
    if (!showHealthDetails) {
      trackAction("home_overlay_health_stats", { sourcePage: "HomeOverlay" });
      setShowHealthDetails(true);
      setIsSpeechBubbleVisible(true);
      return;
    }

    setShowHealthDetails(false);
    setIsSpeechBubbleVisible(false);
  };

  const handleBackAction = () => {
    if (isShopOpen) {
      if (shopBackState?.canGoBack) {
        shopBackState.onBack?.();
        return;
      }

      setIsShopOpen(false);
      setShowHealthDetails(false);
      setIsSpeechBubbleVisible(Boolean(ambientMessage) || quizAvailable);
      onCustomize?.(false);
      return;
    }

    handleStatusToggle();
  };

  const handleOpenShopInOverlay = () => {
    trackAction("home_overlay_shop_open", { sourcePage: "HomeOverlay" });
    setShowHealthDetails(false);
    setIsSpeechBubbleVisible(false);
    setActiveShopCategory(initialShopCategory || "root");
    setShopBackState({ canGoBack: false, onBack: () => {} });
    setIsShopOpen(true);
    onCustomize?.(true);
  };

  const handleOpenBernsteinShop = () => {
    setShowHealthDetails(false);
    setIsSpeechBubbleVisible(false);
    setActiveShopCategory("bernstein");
    setShopBackState({ canGoBack: false, onBack: () => {} });
    setIsShopOpen(true);
    onCustomize?.(true);
  };

  const handleCloseOverlay = () => {
    onCustomize?.(false);
    onClose?.();
  };

  useEffect(() => {
    if (isShopOpen) return;
    setShopBackState({ canGoBack: false, onBack: () => {} });
  }, [isShopOpen]);

  const currencyLine = (
    <span className="inline-flex items-center gap-3 text-[13px] sm:text-sm font-semibold text-white">
      <LockedTooltip
        contentClassName={isLightUi ? "" : "text-white/90"}
        content={<span className="text-xs leading-relaxed">{tooltipCopy.sparks}</span>}
      >
        <button
          type="button"
          aria-label={tooltipCopy.aria.sparks}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 -my-0.5 transition-colors hover:bg-white/10"
        >
          <Sparkles className="w-4 h-4" />
          <span>{Math.max(0, Number(playerSparks) || 0)}</span>
        </button>
      </LockedTooltip>
      <span className="opacity-70">·</span>
      <LockedTooltip
        contentClassName={isLightUi ? "" : "text-white/90"}
        content={<span className="text-xs leading-relaxed">{tooltipCopy.amber}</span>}
      >
        <button
          type="button"
          onClick={handleOpenBernsteinShop}
          aria-label={tooltipCopy.aria.amber}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 -my-0.5 transition-colors hover:bg-white/10"
        >
          <Gem className="w-4 h-4" />
          <span>{Math.max(0, Number(playerAmber) || 0)}</span>
        </button>
      </LockedTooltip>
    </span>
  );

  const healthBadge = (
    <LockedTooltip
      contentClassName={isLightUi ? "" : "text-white/90"}
      content={<span className="text-xs leading-relaxed">{tooltipCopy.status}</span>}
    >
      <button
        type="button"
        aria-label={tooltipCopy.aria.status}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          isLightUi ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-300"
        }`}
      >
        <HeartPulse className="w-3.5 h-3.5" />
        {plantHealthState?.label || "Status unbekannt"}
      </button>
    </LockedTooltip>
  );

  const healthBadgeWithCare = (
    <div className="flex flex-col items-center gap-1">
      {healthBadge}
      <LockedTooltip
        contentClassName={isLightUi ? "" : "text-white/90"}
        content={<span className="text-xs leading-relaxed">{tooltipCopy.watering}</span>}
      >
        <button
          type="button"
          aria-label={tooltipCopy.aria.watering}
          className={`${isLightUi ? "text-stone-500" : "text-stone-400"} text-[10px] font-medium`}
        >
          Pflege: {safeWateringCountToday} / {safeWateringLimitPerDay}
        </button>
      </LockedTooltip>
    </div>
  );

  const logoAnimationPortal = !isShopOpen && typeof document !== "undefined" && document.body
    ? createPortal(
        <>
          <AnimatePresence mode="wait">
            {activePlayfulCareAnimation && careAnimationVisualTarget === "logo" ? (
              <motion.div
                key={`logo-${activePlayfulCareAnimation}-${playfulCareAnimationNonce}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.06 }}
                transition={{ duration: 0.16 }}
                className="pointer-events-none"
                style={floatingLogoHitRect
                  ? {
                      position: "fixed",
                      zIndex: 410,
                      left: `${floatingLogoHitRect.left}px`,
                      top: `${floatingLogoHitRect.top}px`,
                      width: `${floatingLogoHitRect.width}px`,
                      height: `${floatingLogoHitRect.height}px`,
                    }
                  : {
                      position: "fixed",
                      zIndex: 410,
                      left: "50%",
                      top: "50%",
                      width: "13rem",
                      height: "13rem",
                      transform: "translate(-50%, -50%)",
                    }}
                aria-hidden="true"
              >
                <motion.div
                  className="absolute inset-[-8%] rounded-full"
                  style={{
                    background: isLightUi
                      ? "radial-gradient(circle, rgba(163,230,53,0.42) 0%, rgba(163,230,53,0.22) 38%, rgba(163,230,53,0) 76%)"
                      : "radial-gradient(circle, rgba(190,242,100,0.55) 0%, rgba(190,242,100,0.28) 40%, rgba(190,242,100,0) 78%)",
                    filter: "blur(10px)",
                  }}
                  initial={{ opacity: 0, scale: 0.78 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.78, 1.08, 1.28] }}
                  transition={{ duration: 0.72, ease: "easeOut" }}
                />
                <motion.div
                  className={`absolute inset-0 rounded-full border-2 ${isLightUi ? "border-lime-400/70" : "border-lime-300/65"}`}
                  style={{
                    boxShadow: isLightUi
                      ? "0 0 26px rgba(132,204,22,0.75), 0 0 52px rgba(163,230,53,0.45)"
                      : "0 0 32px rgba(190,242,100,0.9), 0 0 60px rgba(190,242,100,0.5)",
                  }}
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.82, 1.04, 1.15] }}
                  transition={{ duration: 0.68, ease: "easeOut" }}
                />
                <motion.div
                  className={`absolute inset-3 rounded-full border ${isLightUi ? "border-emerald-300/60" : "border-emerald-200/55"}`}
                  style={{
                    boxShadow: isLightUi
                      ? "0 0 18px rgba(110,231,183,0.5)"
                      : "0 0 20px rgba(110,231,183,0.6)",
                  }}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: [0, 0.9, 0], scale: [0.92, 1, 1.1] }}
                  transition={{ duration: 0.64, ease: "easeOut", delay: 0.05 }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button
            type="button"
            onClick={(event) => {
              if (event.detail !== 0) return;
              handlePortalCopyTap("logo-hit-click");
            }}
            onPointerUp={() => handlePortalCopyTap("logo-hit-pointerup")}
            onPointerDown={(event) => {
              console.log(`${PORTAL_CARE_DEBUG_PREFIX} logo hit-target pointerdown`, {
                target: getEventTargetLabel(event.target),
                rect: floatingLogoHitRect,
              });
            }}
            className="rounded-full bg-transparent border-0 p-0"
            style={floatingLogoHitRect
              ? {
                  position: "fixed",
                  zIndex: 330,
                  left: `${floatingLogoHitRect.left}px`,
                  top: `${floatingLogoHitRect.top}px`,
                  width: `${floatingLogoHitRect.width}px`,
                  height: `${floatingLogoHitRect.height}px`,
                }
              : {
                  position: "fixed",
                  zIndex: 330,
                  left: "50%",
                  top: "50%",
                  width: "12rem",
                  height: "12rem",
                  transform: "translate(-50%, -50%)",
                }}
            aria-label="Pflege auslösen"
          />
        </>,
        document.body
      )
    : null;

  return (
    <>
      <FlorabotOverlayShell
        title="Florabot Schaltzentrale"
        titleSubline={currencyLine}
      titleSublineClassName="mt-1"
      titleBadge={isShopOpen ? null : healthBadgeWithCare}
      profile={profile}
      logoAssets={logoAssets}
      showLogo={false}
      logoSizeClass="w-48 h-48 sm:w-56 sm:h-56"
      logoPadding="p-[7%]"
      dockContentBottom
      overlayClassName={isShopOpen ? "px-0" : "px-3 sm:px-4"}
      dockContainerClassName={isShopOpen ? "px-0 py-0" : "py-1"}
      contentSectionClassName={isShopOpen ? "basis-auto flex-1 grow shrink items-stretch justify-start" : "basis-[34%]"}
      footerSectionClassName={isShopOpen
        ? "basis-auto grow-0 shrink-0"
        : "basis-[46%] justify-start overflow-hidden"}
      footer={(
        <div className="w-full max-w-[340px] h-full min-h-0 flex flex-col items-center pt-1">
          {!isShopOpen ? (
            <div
              ref={statusPanelSlotRef}
              className="w-full max-w-[340px] min-h-0 flex-1 overflow-y-auto hide-scrollbar flex items-start justify-center py-3 mx-auto"
              style={{ height: `calc(100% - (${fixedFooterReservedHeightExpression}))` }}
              onPointerDownCapture={(event) => {
                console.log(`${PORTAL_CARE_DEBUG_PREFIX} status panel pointerdown capture`, {
                  target: getEventTargetLabel(event.target),
                });
              }}
            >
              {shouldRenderSpeechBubble ? (
                <div className="w-full max-w-[340px] mx-auto" ref={speechBubbleRef}>
                  <div className="flex justify-center mb-[-1px]">
                    <div
                      className="w-0 h-0"
                      style={{
                        borderLeft: "10px solid transparent",
                        borderRight: "10px solid transparent",
                        borderBottom: isLightUi
                          ? "10px solid rgba(200,195,185,0.55)"
                          : "10px solid rgba(255,255,255,0.10)",
                      }}
                    />
                  </div>
                  <div
                    className={`rounded-2xl border ${
                      isHealthPanelCompact ? "px-4 py-3" : "px-5 py-4"
                    } ${
                      isLightUi
                        ? "bg-white/70 border-stone-200/60"
                        : "bg-white/8 border-white/10"
                    }`}
                  >
                    {showHealthDetails ? (
                      <div className={isHealthPanelCompact ? "space-y-1.5" : "space-y-2"}>
                        {healthStats.map((stat) => (
                          <div key={stat.id} className={isHealthPanelCompact ? "space-y-0.5" : "space-y-1"}>
                            <div className={`flex items-center justify-between ${isHealthPanelCompact ? "text-[10px]" : "text-[11px]"}`}>
                              <LockedTooltip
                                contentClassName={isLightUi ? "" : "text-white/90"}
                                content={
                                  <span className="text-xs leading-relaxed">
                                    {(/** @type {Record<string, string>} */ (tooltipCopy.stat))[String(stat.id)] || tooltipCopy.status}
                                  </span>
                                }
                              >
                                <button
                                  type="button"
                                  aria-label={`${stat.label} ${tooltipCopy.aria.stat}`}
                                  className={`font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}
                                >
                                  {stat.label}
                                </button>
                              </LockedTooltip>
                              <span className={isLightUi ? "text-stone-700" : "text-stone-200"}>{stat.value}%</span>
                            </div>
                            <div className={`${isHealthPanelCompact ? "h-1" : "h-1.5"} rounded-full ${isLightUi ? "bg-stone-200" : "bg-white/15"}`}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(0, Math.min(100, Number(stat.value) || 0))}%`,
                                  background: stat.color || "#22c55e",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="relative"
                        onPointerDownCapture={(event) => {
                          console.log(`${PORTAL_CARE_DEBUG_PREFIX} bubble pointerdown capture`, {
                            target: getEventTargetLabel(event.target),
                            currentTarget: getEventTargetLabel(event.currentTarget),
                          });
                        }}
                        onClickCapture={(event) => {
                          console.log(`${PORTAL_CARE_DEBUG_PREFIX} bubble click capture`, {
                            target: getEventTargetLabel(event.target),
                            currentTarget: getEventTargetLabel(event.currentTarget),
                          });
                        }}
                      >
                        {quizAvailable ? (
                          <button
                            type="button"
                            onClick={() => onQuizClick?.()}
                            className={`w-full border-0 bg-transparent p-0 cursor-pointer touch-manipulation ${isHealthPanelCompact ? "text-[13px]" : "text-sm"} leading-relaxed text-left transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] ${isLightUi ? "text-amber-700" : "text-amber-300"}`}
                          >
                            Ich habe ein paar Scans, die ich nicht mehr genau zuordnen kann. Kannst du mir dabei helfen? Klick hier, wenn du soweit bist!
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePortalCopyTap("click")}
                            onPointerUp={() => handlePortalCopyTap("pointerup")}
                            onPointerDown={(event) => {
                              console.log(`${PORTAL_CARE_DEBUG_PREFIX} portal button pointerdown`, {
                                target: getEventTargetLabel(event.target),
                              });
                            }}
                            className={`w-full border-0 bg-transparent p-0 cursor-pointer touch-manipulation ${isHealthPanelCompact ? "text-[13px]" : "text-sm"} leading-relaxed text-left transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] ${isLightUi ? "text-stone-600" : "text-stone-300"}`}
                          >
                            {ambientMessage}
                          </button>
                        )}

                        <AnimatePresence mode="wait">
                          {activePlayfulCareAnimation && careAnimationVisualTarget === "bubble" ? (
                            <motion.div
                              key={`${activePlayfulCareAnimation}-${playfulCareAnimationNonce}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.16 }}
                              className="pointer-events-none absolute inset-0"
                              aria-hidden="true"
                            >
                              <motion.div
                                className={`absolute -inset-2 rounded-2xl border ${isLightUi ? "border-emerald-300/70" : "border-emerald-200/60"}`}
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: [0, 1, 0], scale: [0.94, 1.02, 1.08] }}
                                transition={{ duration: 0.56, ease: "easeOut" }}
                              />

                              {activePlayfulCareAnimation === "flip" ? (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                                  {[-1, 0, 1].map((offset) => (
                                    <motion.span
                                      key={`flip-${offset}`}
                                      className={`inline-block h-1.5 w-1.5 rounded-full ${isLightUi ? "bg-sky-400/90" : "bg-sky-300/90"}`}
                                      initial={{ opacity: 0, y: 4, x: 0, scale: 0.7 }}
                                      animate={{
                                        opacity: [0, 1, 0],
                                        y: [4, -8, 6],
                                        x: [0, offset * 5, offset * 8],
                                        scale: [0.7, 1.05, 0.8],
                                      }}
                                      transition={{ duration: 0.56, ease: "easeOut", delay: (offset + 1) * 0.06 }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              {activePlayfulCareAnimation === "squash" ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <motion.span
                                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${isLightUi ? "bg-lime-200/80 text-lime-700" : "bg-lime-300/20 text-lime-200"}`}
                                    initial={{ opacity: 0, scale: 0.85, rotate: -7 }}
                                    animate={{
                                      opacity: [0, 1, 1, 0],
                                      scale: [0.85, 1.02, 0.98, 1],
                                      rotate: [-7, 7, -5, 0],
                                    }}
                                    transition={{ duration: 0.62, ease: "easeOut" }}
                                  >
                                    plopp
                                  </motion.span>
                                </div>
                              ) : null}

                              {activePlayfulCareAnimation === "orbit" ? (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                  {[0, 1, 2, 3, 4, 5].map((index) => {
                                    const angle = (index / 6) * Math.PI * 2;
                                    const x = Math.cos(angle) * 14;
                                    const y = Math.sin(angle) * 14;

                                    return (
                                      <motion.span
                                        key={`burst-${index}`}
                                        className={`absolute left-1/2 top-1/2 inline-block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm ${isLightUi ? "bg-amber-400/90" : "bg-amber-300/90"}`}
                                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                                        animate={{ opacity: [0, 1, 0], x: [0, x], y: [0, y], scale: [0.6, 1, 0.7] }}
                                        transition={{ duration: 0.54, ease: "easeOut", delay: index * 0.03 }}
                                      />
                                    );
                                  })}
                                </div>
                              ) : null}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            ref={fixedFooterRef}
            className="fixed inset-x-0 bottom-0 z-[230] px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pointer-events-none"
          >
            {isShopOpen ? (
              <div
                className={`absolute left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen border-t-2 ${
                  isLightUi ? "border-stone-300/70" : "border-[#f0e5a5]/20"
                }`}
                style={{ top: `-${shopFooterGapPx}px` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="mx-auto w-full max-w-[340px] pointer-events-auto flex flex-col gap-3">
              {isShopOpen ? (
                <div className="w-full flex gap-2">
                  <button
                    type="button"
                    onClick={handleBackAction}
                    className={`flex-1 h-9 rounded-xl px-3 text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center justify-center gap-1.5 ${
                      isLightUi
                        ? "bg-white/80 text-stone-800 border border-stone-200 hover:bg-white"
                        : "bg-white/10 text-stone-100 border border-white/20 hover:bg-white/15"
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Zurueck
                  </button>

                  <button
                    type="button"
                    onClick={() => shopActionState?.onAction?.()}
                    disabled={Boolean(shopActionState?.disabled || shopActionState?.isBusy)}
                    className={`relative overflow-hidden flex-1 h-9 rounded-xl px-3 text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed ${
                      isLightUi
                        ? "bg-amber-400 text-stone-900 border border-amber-500/70 hover:bg-amber-300"
                        : "bg-amber-500 text-black border border-amber-300/60 hover:bg-amber-400"
                    }`}
                  >
                    {shopActionState?.isBusy ? "Verarbeite..." : (shopActionState?.label || "Kaufen")}
                    {(shopActionState?.disabled || shopActionState?.isBusy) ? (
                      <span className="absolute inset-0 bg-black/45" aria-hidden="true" />
                    ) : null}
                  </button>
                </div>
              ) : (
                <div className="w-full flex gap-2">
                  <button
                    type="button"
                    onClick={handleBackAction}
                    className={`flex-1 h-9 rounded-xl px-3 text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center justify-center gap-1.5 ${
                      isLightUi
                        ? "bg-white/80 text-stone-800 border border-stone-200 hover:bg-white"
                        : "bg-white/10 text-stone-100 border border-white/20 hover:bg-white/15"
                    }`}
                  >
                    Status anzeigen
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenShopInOverlay}
                    className={`relative overflow-hidden flex-1 h-9 rounded-xl px-3 text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center justify-center gap-1.5 ${
                      isLightUi
                        ? "bg-lime-600 text-white border border-lime-700/70 hover:bg-lime-700"
                        : "bg-lime-500/85 text-black border border-lime-300/60 hover:bg-lime-400"
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Anpassen
                  </button>
                </div>
              )}

              <div className="w-full flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={handleCloseOverlay}
                  className={`inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1.5 text-[13px] font-medium leading-none transition-colors ${
                    isLightUi
                      ? "text-stone-400 hover:text-stone-600"
                      : "text-stone-600 hover:text-stone-400"
                  }`}
                >
                  Schliessen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    >
      {isShopOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: "easeInOut" }}
          className="h-full min-h-0 w-full max-w-none flex flex-col"
        >
          <div
            ref={shopViewportRef}
            className="min-h-0 overflow-hidden flex"
            style={shopViewportHeight != null
              ? { height: `${shopViewportHeight}px`, maxHeight: `${shopViewportHeight}px` }
              : { height: `calc(100% - (${fixedFooterReservedHeightExpression}) - ${shopFooterGapPx}px)` }}
          >
            <ShopFeatureRoot
              embedded
              showEmbeddedBottomDivider={false}
              authId={authId}
              currentUser={currentUser || profile}
              badgeMetrics={badgeMetrics}
              onHeaderMetaChange={() => {}}
              onUserUpdated={onUserUpdated}
              initialCategory={activeShopCategory}
              externalActionMode
              onActionStateChange={setShopActionState}
              onBackStateChange={setShopBackState}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          // IMPORTANT: keep this wrapper free of transform animations.
          // The logo ring + hit-target are rendered via createPortal in document.body
          // to avoid backdrop-filter / WebkitBackdropFilter creating a containing block
          // for position:fixed descendants (iOS Safari / Android WebView quirk).
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.26, ease: "easeInOut" }}
          className="relative h-full w-full"
        />
      )}
    </FlorabotOverlayShell>
    {logoAnimationPortal}
  </>
  );
}

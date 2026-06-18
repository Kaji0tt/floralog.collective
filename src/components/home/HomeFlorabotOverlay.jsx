import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Settings2, HeartPulse, Sparkles, Gem, ArrowLeft } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";
import FlorabotOverlayShell from "@/components/florabot/FlorabotOverlayShell";
import ShopFeatureRoot from "@/components/shop/ShopFeatureRoot";

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
  onCustomize,
  onUserUpdated,
  onClose,
}) {
  const { isLightUi } = useUiTheme();
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [isSpeechBubbleVisible, setIsSpeechBubbleVisible] = useState(Boolean(ambientMessage));
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [activeShopCategory, setActiveShopCategory] = useState(initialShopCategory || "root");
  const [isHealthPanelCompact, setIsHealthPanelCompact] = useState(false);
  const [shopActionState, setShopActionState] = useState({
    label: "Kaufen",
    disabled: true,
    isBusy: false,
    onAction: null,
  });
  const [shopViewportHeight, setShopViewportHeight] = useState(null);
  const onCustomizeRef = useRef(onCustomize);

  const statusPanelSlotRef = useRef(null);
  const speechBubbleRef = useRef(null);
  const fixedFooterRef = useRef(null);
  const shopViewportRef = useRef(null);
    useEffect(() => {
      onCustomizeRef.current = onCustomize;
    }, [onCustomize]);

  const fixedFooterReservedHeightExpression = "7.5rem + env(safe-area-inset-bottom)";
  const shopFooterGapPx = 10;

  const shouldRenderSpeechBubble = !isShopOpen && isSpeechBubbleVisible && (showHealthDetails || Boolean(ambientMessage));

  useEffect(() => {
    setActiveShopCategory(initialShopCategory || "root");
  }, [initialShopCategory]);

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
    };
  }, []);

  const handleStatusToggle = () => {
    if (!showHealthDetails) {
      setShowHealthDetails(true);
      setIsSpeechBubbleVisible(true);
      return;
    }

    setShowHealthDetails(false);
    setIsSpeechBubbleVisible(false);
  };

  const handleBackAction = () => {
    if (isShopOpen) {
      setIsShopOpen(false);
      setShowHealthDetails(false);
      setIsSpeechBubbleVisible(Boolean(ambientMessage));
      onCustomize?.(false);
      return;
    }

    handleStatusToggle();
  };

  const handleOpenShopInOverlay = () => {
    setShowHealthDetails(false);
    setIsSpeechBubbleVisible(false);
    setActiveShopCategory(initialShopCategory || "root");
    setIsShopOpen(true);
    onCustomize?.(true);
  };

  const handleCloseOverlay = () => {
    onCustomize?.(false);
    onClose?.();
  };

  const currencyLine = (
    <span className="inline-flex items-center gap-3 text-[13px] sm:text-sm font-semibold text-white">
      <span className="inline-flex items-center gap-1">
        <Sparkles className="w-4 h-4" />
        <span>{Math.max(0, Number(playerSparks) || 0)}</span>
      </span>
      <span className="opacity-70">·</span>
      <span className="inline-flex items-center gap-1">
        <Gem className="w-4 h-4" />
        <span>{Math.max(0, Number(playerAmber) || 0)}</span>
      </span>
    </span>
  );

  const healthBadge = (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      isLightUi ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-300"
    }`}>
      <HeartPulse className="w-3.5 h-3.5" />
      {plantHealthState?.label || "Status unbekannt"}
    </span>
  );

  return (
    <FlorabotOverlayShell
      title="Florabot Schaltzentrale"
      titleSubline={currencyLine}
      titleSublineClassName="mt-1"
      titleBadge={isShopOpen ? null : healthBadge}
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
                              <span className={isLightUi ? "text-stone-700" : "text-stone-200"}>{stat.label}</span>
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
                      <p className={`${isHealthPanelCompact ? "text-[13px]" : "text-sm"} leading-relaxed ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                        {ambientMessage}
                      </p>
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
                className={`absolute left-1/2 h-px w-full max-w-[340px] -translate-x-1/2 ${
                  isLightUi ? "bg-stone-300/70" : "bg-[#f0e5a5]/20"
                }`}
                style={{ top: `-${shopFooterGapPx}px` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="mx-auto w-full max-w-[340px] pointer-events-auto flex flex-col gap-2">
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

              <div className="w-full flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleCloseOverlay}
                  className={`text-xs leading-none transition-colors ${
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
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: "easeInOut" }}
          className="h-full w-full"
        />
      )}
    </FlorabotOverlayShell>
  );
}

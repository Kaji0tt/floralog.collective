import { Camera, Home as HouseIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import {
  BADGE_CIRCLE_BACKGROUND_GRADIENT,
  BADGE_CIRCLE_BORDER_GRADIENT,
} from "@/components/home/BadgeCircleIcon";

/**
 * @param {{
 * navItems: Array<{
 *   label: string,
 *   onClick: () => void,
 *   icon: React.ComponentType<any>,
 *   gradientClass: string,
 *   shadowStyle: string,
 *   showNotificationDot?: boolean,
 * }>,
 * controlsScale?: number,
 * showLabels?: boolean,
 * centerContext?: "inside" | "outside",
 * onCenterAction?: () => void,
 * }} props
 */
export default function HomeBottomNavigation({
  navItems,
  controlsScale = 1,
  showLabels = true,
  centerContext = "inside",
  onCenterAction,
  highlightCenterAction = false,
}) {
  const { isLightUi } = useUiTheme();
  const navButtonHeightRem = Math.min(3.2, Math.max(2.7, 2.9 * controlsScale));
  const centerSizeRem = Math.min(4.2, Math.max(3.6, 3.9 * controlsScale));
  const CenterIcon = centerContext === "outside" ? HouseIcon : Camera;
  const centerLabel = centerContext === "outside" ? "Zur Startseite" : "Scannen";
  const isHomeCenter = centerContext === "outside";
  const leftItems = Array.isArray(navItems) ? navItems.slice(0, 2) : [];
  const rightItems = Array.isArray(navItems) ? navItems.slice(2, 4) : [];

  const goldTone = isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]";
  const idleTone = isLightUi ? "text-stone-700" : "text-white/90";

  const renderNavButton = (item) => (
    <button
      key={item.label}
      onClick={item.onClick}
      aria-label={item.label}
      className="relative flex flex-col items-center hover:brightness-110 active:translate-y-px transition-all"
      style={{
        height: `${navButtonHeightRem.toFixed(2)}rem`,
        maxHeight: `${navButtonHeightRem.toFixed(2)}rem`,
        minHeight: `${navButtonHeightRem.toFixed(2)}rem`,
        justifyContent: "center",
        gap: showLabels ? `${(0.2 * controlsScale).toFixed(2)}rem` : "0rem",
      }}
    >
      {item.showNotificationDot && (
        <span
          className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border border-white/80"
          aria-hidden="true"
        />
      )}
      <item.icon
        className={item.isActive ? goldTone : idleTone}
        strokeWidth={1.25}
        style={{
          width: `${(1.24 * controlsScale).toFixed(2)}rem`,
          height: `${(1.24 * controlsScale).toFixed(2)}rem`,
        }}
      />
      {showLabels && (
        <span
          className={`home-tight-vh-label font-thin leading-tight ${item.isActive ? goldTone : idleTone}`}
          style={{ fontSize: `${(0.6 * controlsScale).toFixed(2)}rem` }}
        >
          {item.label}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-full select-none touch-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        data-ui="home-bottom-nav"
      >
        <GoldGradientCard
          blur
          borderClassName="gold-gradient-border-mask-thin"
          className="rounded-[1.75rem]"
          contentClassName="rounded-[1.75rem] px-3 py-2"
        >
        <div
          className="grid grid-cols-5 items-end"
          style={{ gap: `${(0.46 * controlsScale).toFixed(2)}rem` }}
        >
          {leftItems.map(renderNavButton)}

          <div className="relative z-20 flex justify-center" style={{ height: `${navButtonHeightRem.toFixed(2)}rem` }}>
            <motion.button
              type="button"
              onClick={onCenterAction}
              aria-label={centerLabel}
              whileTap={{ scale: 0.94 }}
              animate={highlightCenterAction ? { scale: [1, 1.05, 1] } : {}}
              transition={highlightCenterAction ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
              className={`absolute z-20 flex items-center justify-center rounded-full border-[3px] ${
                isHomeCenter
                  ? "border-[#4a3610]"
                  : `shadow-[0_10px_24px_rgba(16,185,129,0.4)] bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 ${isLightUi ? "border-white/80" : "border-[#0a1f14]/70"}`
              }`}
              style={{
                width: `${centerSizeRem.toFixed(2)}rem`,
                height: `${centerSizeRem.toFixed(2)}rem`,
                top: `-${(centerSizeRem * 0.32).toFixed(2)}rem`,
                ...(isHomeCenter
                  ? {
                      background: BADGE_CIRCLE_BACKGROUND_GRADIENT,
                      boxShadow: `0 0 0 2px rgba(255,245,137,0.16), 0 12px 28px rgba(143,107,34,0.48), 0 0 24px rgba(240,229,165,0.36)`,
                      outline: "2px solid transparent",
                      outlineOffset: "-4px",
                    }
                  : {}),
              }}
            >
              {isHomeCenter && (
                <span
                  className="pointer-events-none absolute inset-[-3px] rounded-full"
                  style={{ background: BADGE_CIRCLE_BORDER_GRADIENT, zIndex: -1 }}
                  aria-hidden="true"
                />
              )}
              <CenterIcon
                className={isHomeCenter ? "text-[#fff6bd] drop-shadow-[0_0_6px_rgba(240,229,165,0.7)]" : "text-white"}
                style={{
                  width: `${(centerSizeRem * 0.42).toFixed(2)}rem`,
                  height: `${(centerSizeRem * 0.42).toFixed(2)}rem`,
                }}
              />
            </motion.button>
          </div>

          {rightItems.map(renderNavButton)}
        </div>
        </GoldGradientCard>
      </motion.div>
    </div>
  );
}

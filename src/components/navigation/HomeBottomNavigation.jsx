import { Camera, Home as HouseIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";

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
  showLabels = false,
  centerContext = "inside",
  onCenterAction,
  highlightCenterAction = false,
}) {
  const { isLightUi } = useUiTheme();
  const navButtonHeightRem = Math.min(3.2, Math.max(2.7, 2.9 * controlsScale));
  const centerSizeRem = Math.min(4.2, Math.max(3.6, 3.9 * controlsScale));
  const CenterIcon = centerContext === "outside" ? HouseIcon : Camera;
  const centerLabel = centerContext === "outside" ? "Zur Startseite" : "Scannen";
  const leftItems = Array.isArray(navItems) ? navItems.slice(0, 2) : [];
  const rightItems = Array.isArray(navItems) ? navItems.slice(2, 4) : [];

  const renderNavButton = (item) => (
    <button
      key={item.label}
      onClick={item.onClick}
      aria-label={item.label}
      className={`relative rounded-2xl border border-[#f0e5a5]/45 ${item.gradientClass} hover:brightness-105 active:translate-y-px transition-all flex flex-col items-center backdrop-blur-[2px]`}
      style={{
        boxShadow: item.shadowStyle,
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
        className="text-white"
        style={{
          width: `${(1.24 * controlsScale).toFixed(2)}rem`,
          height: `${(1.24 * controlsScale).toFixed(2)}rem`,
        }}
      />
      {showLabels && (
        <span
          className={`home-tight-vh-label font-semibold ${isLightUi ? "text-stone-700" : "text-white/95"}`}
          style={{ fontSize: `${(0.78 * controlsScale).toFixed(2)}rem` }}
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
        <div
          className="grid grid-cols-5 items-end"
          style={{ gap: `${(0.46 * controlsScale).toFixed(2)}rem` }}
        >
          {leftItems.map(renderNavButton)}

          <div className="relative flex justify-center" style={{ height: `${navButtonHeightRem.toFixed(2)}rem` }}>
            <motion.button
              type="button"
              onClick={onCenterAction}
              aria-label={centerLabel}
              whileTap={{ scale: 0.94 }}
              animate={highlightCenterAction ? { scale: [1, 1.05, 1] } : {}}
              transition={highlightCenterAction ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
              className={`absolute flex items-center justify-center rounded-full border-[3px] shadow-[0_10px_24px_rgba(16,185,129,0.4)] bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 ${
                isLightUi ? "border-white/80" : "border-[#0a1f14]/70"
              }`}
              style={{
                width: `${centerSizeRem.toFixed(2)}rem`,
                height: `${centerSizeRem.toFixed(2)}rem`,
                top: `-${(centerSizeRem * 0.32).toFixed(2)}rem`,
              }}
            >
              <CenterIcon
                className="text-white"
                style={{
                  width: `${(centerSizeRem * 0.42).toFixed(2)}rem`,
                  height: `${(centerSizeRem * 0.42).toFixed(2)}rem`,
                }}
              />
            </motion.button>
          </div>

          {rightItems.map(renderNavButton)}
        </div>
      </motion.div>
    </div>
  );
}

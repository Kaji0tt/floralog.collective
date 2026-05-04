import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
 * }} props
 */
export default function HomeBottomNavigation({
  navItems,
  controlsScale = 1,
  showLabels = false,
}) {
  const { isLightUi } = useUiTheme();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const navButtonHeightRem = Math.min(3.2, Math.max(2.7, 2.9 * controlsScale));

  const toggleNavVisibility = () => {
    setIsNavVisible((prev) => !prev);
  };

  return (
    <div className="w-full space-y-[clamp(0.5rem,1.2vh,1rem)] select-none touch-none">
      {/* Trennlinie mit Dreieck */}
      <div className="relative w-full h-px flex items-center justify-center">
        {/* Linke Trennlinie */}
        <div
          className={`absolute left-0 h-px flex-1 ${
            isLightUi ? "bg-[#b99a48]/30" : "bg-[#f0e5a5]/20"
          }`}
          style={{ width: "calc(50% - 1.5rem)" }}
        />

        {/* Dreieck-Button */}
        <motion.button
          type="button"
          onClick={toggleNavVisibility}
          className={`relative z-10 w-8 h-8 rounded-full border backdrop-blur-sm flex items-center justify-center transition-colors ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80"
              : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"
          }`}
          aria-label={
            isNavVisible
              ? "Navigationleiste ausblenden"
              : "Navigationleiste einblenden"
          }
          aria-expanded={isNavVisible}
        >
          <motion.div
            animate={{ rotate: isNavVisible ? 0 : 180 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <ChevronDown
              className={`w-5 h-5 ${
                isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"
              }`}
            />
          </motion.div>
        </motion.button>

        {/* Rechte Trennlinie */}
        <div
          className={`absolute right-0 h-px flex-1 ${
            isLightUi ? "bg-[#b99a48]/30" : "bg-[#f0e5a5]/20"
          }`}
          style={{ width: "calc(50% - 1.5rem)" }}
        />
      </div>

      {/* Navigation Items mit Animation */}
      <AnimatePresence mode="wait">
        {isNavVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            data-ui="home-bottom-nav"
          >
            <div
              className="grid grid-cols-4"
              style={{ gap: `${(0.46 * controlsScale).toFixed(2)}rem` }}
            >
              {navItems.map((item) => (
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
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

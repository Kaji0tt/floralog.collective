import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function HomeBottomNavigation({
  navItems,
  controlsScale,
  leftChipLabel = null,
  rightChipLabel = null,
  rightChipTooltipTitle = null,
  rightChipTooltipBody = null,
}) {
  const { isLightUi } = useUiTheme();
  const [isNavVisible, setIsNavVisible] = useState(true);

  const toggleNavVisibility = () => {
    setIsNavVisible((prev) => !prev);
  };

  return (
    <div className="w-full space-y-[clamp(0.5rem,1.2vh,1rem)] select-none touch-none">
      {/* Trennlinie mit Dreieck */}
      <div className="relative w-full h-8 flex items-center justify-center">
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

        {leftChipLabel && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            <span
              className={`inline-flex items-center h-8 rounded-full border px-3 text-[11px] font-semibold backdrop-blur-sm ${
                isLightUi
                  ? "border-[#c8ac62]/55 bg-white/65 text-[#8f6b22]"
                  : "border-[#f0e5a5]/35 bg-black/35 text-[#f0e5a5]"
              }`}
            >
              {leftChipLabel}
            </span>
          </div>
        )}

        {rightChipLabel && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {rightChipTooltipBody ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center h-8 rounded-full border px-3 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                      isLightUi
                        ? "border-[#c8ac62]/55 bg-white/65 text-[#8f6b22] hover:bg-white/80"
                        : "border-[#f0e5a5]/35 bg-black/35 text-[#f0e5a5] hover:bg-black/50"
                    }`}
                  >
                    {rightChipLabel}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className={isLightUi
                    ? "w-72 border-[#c8ac62]/55 bg-white/95 text-stone-800"
                    : "w-72 bg-emerald-950/95 border-amber-600/40 text-amber-50/90"}
                >
                  <div className="space-y-2">
                    {rightChipTooltipTitle && (
                      <h3 className={`text-sm font-semibold ${isLightUi ? "text-[#8f6b22]" : "text-amber-300"}`}>
                        {rightChipTooltipTitle}
                      </h3>
                    )}
                    <p className={`text-xs ${isLightUi ? "text-stone-700" : "text-amber-50/80"}`}>
                      {rightChipTooltipBody}
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span
                className={`inline-flex items-center h-8 rounded-full border px-3 text-[11px] font-semibold backdrop-blur-sm ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/65 text-[#8f6b22]"
                    : "border-[#f0e5a5]/35 bg-black/35 text-[#f0e5a5]"
                }`}
              >
                {rightChipLabel}
              </span>
            )}
          </div>
        )}

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
                  className={`rounded-2xl border border-[#f0e5a5]/45 ${item.gradientClass} hover:brightness-105 active:translate-y-px transition-all flex flex-col items-center backdrop-blur-[2px]`}
                  style={{
                    boxShadow: item.shadowStyle,
                    paddingBlock: `${(0.72 * controlsScale).toFixed(2)}rem`,
                    gap: `${(0.2 * controlsScale).toFixed(2)}rem`,
                  }}
                >
                  <item.icon
                    className="text-white"
                    style={{
                      width: `${(1.2 * controlsScale).toFixed(2)}rem`,
                      height: `${(1.2 * controlsScale).toFixed(2)}rem`,
                    }}
                  />
                  <span
                    className={`home-tight-vh-label font-semibold ${isLightUi ? "text-stone-700" : "text-white/95"}`}
                    style={{ fontSize: `${(0.78 * controlsScale).toFixed(2)}rem` }}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

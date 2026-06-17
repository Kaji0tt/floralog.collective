import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";
import FlorabotOverlayShell from "./FlorabotOverlayShell";

/**
 * Full-screen Florabot milestone overlay.
 * Shown when the user's wallet_balance crosses a milestone threshold for the first time.
 *
 * @param {{
 *   milestone: import("@/lib/florabotMilestones").FlorabotMilestone,
 *   profile?: object,
 *   logoAssets?: Array<any>,
 *   onDismiss: (milestoneId: string) => void
 * }} props
 */
export default function FlorabotMilestoneOverlay({ milestone, profile, logoAssets = [], onDismiss }) {
  const { isLightUi } = useUiTheme();
  const [slideIndex, setSlideIndex] = useState(0);

  if (!milestone) return null;

  const messages = milestone.messages || [];
  const isLast = slideIndex >= messages.length - 1;
  const currentMsg = messages[slideIndex] || {};

  const handleNext = () => {
    if (isLast) {
      onDismiss(milestone.id);
    } else {
      setSlideIndex((i) => i + 1);
    }
  };

  return (
    <FlorabotOverlayShell
      eyebrow={`${milestone.threshold.toLocaleString("de")} Samen`}
      profile={profile}
      logoAssets={logoAssets}
      footer={(
        <>
          <motion.button
            type="button"
            onClick={handleNext}
            className={`mt-6 rounded-2xl px-8 py-3 text-sm font-semibold transition-colors ${
              isLightUi
                ? "bg-lime-600 text-white hover:bg-lime-700"
                : "bg-lime-500/85 text-black hover:bg-lime-400"
            }`}
            whileTap={{ scale: 0.96 }}
          >
            {isLast ? "Verstanden!" : "Weiter"}
          </motion.button>

          <button
            type="button"
            onClick={() => onDismiss(milestone.id)}
            className={`mt-3 text-xs transition-colors ${
              isLightUi
                ? "text-stone-400 hover:text-stone-600"
                : "text-stone-600 hover:text-stone-400"
            }`}
          >
            Schließen
          </button>
        </>
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slideIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.26, ease: "easeInOut" }}
          className="mt-7 w-full max-w-[340px]"
        >
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
            className={`rounded-2xl px-5 py-4 border ${
              isLightUi
                ? "bg-white/70 border-stone-200/60"
                : "bg-white/8 border-white/10"
            }`}
          >
            <p
              className={`font-semibold text-base leading-snug ${
                isLightUi ? "text-stone-800" : "text-stone-100"
              }`}
            >
              {currentMsg.title}
            </p>
            <p
              className={`mt-2 text-sm leading-relaxed ${
                isLightUi ? "text-stone-600" : "text-stone-300"
              }`}
            >
              {currentMsg.body}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {messages.length > 1 && (
        <div className="flex gap-2 mt-5">
          {messages.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === slideIndex
                  ? "w-5 h-2 bg-lime-400"
                  : isLightUi
                  ? "w-2 h-2 bg-stone-400/50"
                  : "w-2 h-2 bg-stone-500/50"
              }`}
            />
          ))}
        </div>
      )}
    </FlorabotOverlayShell>
  );
}

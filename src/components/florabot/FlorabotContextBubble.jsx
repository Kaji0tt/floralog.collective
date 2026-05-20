import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";
import FlorabotLogo from "./FlorabotLogo";

/**
 * Small contextual Florabot speech bubble floating above the bottom nav.
 * Shown as a secondary follow-up after a milestone is dismissed, pointing
 * the user toward a specific feature.
 *
 * @param {{
 *   message: string,
 *   profile?: object,
 *   onDismiss: () => void
 * }} props
 */
export default function FlorabotContextBubble({ message, profile, onDismiss }) {
  const { isLightUi } = useUiTheme();

  if (!message) return null;

  return (
    <motion.div
      className="fixed bottom-[5.5rem] inset-x-0 z-[180] flex justify-center px-4 pointer-events-none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div
        className={`pointer-events-auto flex items-start gap-3 max-w-[360px] w-full rounded-2xl px-4 py-3 border shadow-lg ${
          isLightUi
            ? "bg-white/90 border-stone-200/70"
            : "bg-[#1a1f18]/90 border-white/10"
        }`}
        style={{
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <FlorabotLogo
          profile={profile}
          sizeClass="w-10 h-10 shrink-0 mt-0.5"
          padding="p-[6%]"
        />
        <p
          className={`flex-1 text-sm leading-relaxed ${
            isLightUi ? "text-stone-700" : "text-stone-200"
          }`}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Schließen"
          className={`shrink-0 mt-0.5 p-1 rounded-full transition-colors ${
            isLightUi
              ? "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              : "text-stone-500 hover:text-stone-300 hover:bg-white/8"
          }`}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

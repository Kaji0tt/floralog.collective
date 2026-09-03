import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Bug, Info, HeartPulse, Palette, Bell, Menu, CircleAlert } from "lucide-react";
import ImpressumDialog from "@/components/legal/ImpressumDialog";
import ServerNewsDialog from "@/components/home/ServerNewsDialog";

const CIRCLE_BUTTON_CLASS = "flex h-11 w-11 shrink-0 items-center justify-center";

/**
 * Right-side hero nav: Optionen expand inline into a pill, Herz/Farbpalette are single actions.
 */
export default function HomeHeroSideNav({
  isLightUi = false,
  playerSeeds = 0,
  playerSparks = 0,
  playerAmber = 0,
  user = null,
  onOpenSettings,
  onOpenBugReport,
  onOpenAmberPurchase,
  onToggleHealthView,
  onOpenCustomize,
  onOpenServerNews,
  hasUnreadServerNews = false,
  hasOpenQuiz = false,
  onOpenQuiz,
  isHealthViewActive = false,
  className = "",
}) {
  const [expandedKey, setExpandedKey] = useState(/** @type {"options" | null} */ (null));
  const [impressumOpen, setImpressumOpen] = useState(false);
  const [serverNewsOpen, setServerNewsOpen] = useState(false);

  const glassBorder = isLightUi ? "border-[#c8ac62]/55 bg-white/70" : "border-[#f0e5a5]/45 bg-black/45";
  const iconTone = isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]";

  const toggleExpanded = (key) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <>
      {expandedKey && (
        <div className="fixed inset-0 z-20" onClick={() => setExpandedKey(null)} aria-hidden="true" />
      )}

      <div className={`absolute right-0 top-0 z-30 flex flex-col items-end gap-2 ${className}`}>
        <motion.div layout="position" className={`flex items-center overflow-hidden rounded-full border backdrop-blur-xl ${glassBorder}`}>
          {expandedKey === "options" && (
            <div className="flex items-center gap-1 pl-2.5">
              <button
                type="button"
                onClick={() => { setExpandedKey(null); onOpenSettings?.(); }}
                aria-label="Einstellungen"
                className="flex h-8 w-8 items-center justify-center"
              >
                <Settings className={`h-4 w-4 ${iconTone}`} />
              </button>
              <button
                type="button"
                onClick={() => { setExpandedKey(null); onOpenBugReport?.(); }}
                aria-label="Bug melden"
                className="flex h-8 w-8 items-center justify-center"
              >
                <Bug className={`h-4 w-4 ${iconTone}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpandedKey(null);
                  if (onOpenServerNews) {
                    onOpenServerNews();
                  } else {
                    setServerNewsOpen(true);
                  }
                }}
                aria-label="Server-News"
                className="relative flex h-8 w-8 items-center justify-center"
              >
                <Bell className={`h-4 w-4 ${iconTone}`} />
                {hasUnreadServerNews ? (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-white/90 bg-red-500" aria-hidden="true" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => { setExpandedKey(null); setImpressumOpen(true); }}
                aria-label="Impressum"
                className="flex h-8 w-8 items-center justify-center"
              >
                <Info className={`h-4 w-4 ${iconTone}`} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleExpanded("options")}
            aria-label="Optionen"
            aria-expanded={expandedKey === "options"}
            className={CIRCLE_BUTTON_CLASS}
          >
            {hasUnreadServerNews ? <Bell className={`h-5 w-5 ${iconTone}`} /> : <Menu className={`h-5 w-5 ${iconTone}`} />}
          </button>
        </motion.div>

        {hasOpenQuiz ? (
          <button
            type="button"
            onClick={() => onOpenQuiz?.()}
            aria-label="Offenes Pflanzenquiz öffnen"
            className={`${CIRCLE_BUTTON_CLASS} rounded-full border border-emerald-300/75 bg-emerald-500/80 text-white shadow-[0_0_18px_rgba(52,211,153,0.48)] backdrop-blur-xl transition-colors hover:bg-emerald-400/90`}
          >
            <CircleAlert className="h-5 w-5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onToggleHealthView?.()}
          aria-pressed={isHealthViewActive}
          aria-label="Pflanzengesundheit"
          className={`${CIRCLE_BUTTON_CLASS} rounded-full border backdrop-blur-xl ${glassBorder} ${
            isHealthViewActive ? "ring-2 ring-rose-300/70" : ""
          }`}
        >
          <HeartPulse className={`h-5 w-5 ${isHealthViewActive ? "text-rose-300" : iconTone}`} />
        </button>

        <button
          type="button"
          onClick={() => onOpenCustomize?.()}
          aria-label="Anpassen"
          className={`${CIRCLE_BUTTON_CLASS} rounded-full border backdrop-blur-xl ${glassBorder}`}
        >
          <Palette className={`h-5 w-5 ${iconTone}`} />
        </button>
      </div>

      <ImpressumDialog open={impressumOpen} onOpenChange={setImpressumOpen} />
      <ServerNewsDialog open={serverNewsOpen} onOpenChange={setServerNewsOpen} user={user} />
    </>
  );
}

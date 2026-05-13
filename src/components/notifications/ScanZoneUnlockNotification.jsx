import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Gift } from "lucide-react";

export default function ScanZoneUnlockNotification({ unlock, remainingCount = 0, onComplete }) {
  useEffect(() => {
    if (!unlock) return undefined;

    const timeoutId = window.setTimeout(() => {
      onComplete?.();
    }, 5200);

    return () => window.clearTimeout(timeoutId);
  }, [unlock, onComplete]);

  if (!unlock) return null;

  const title = unlock?.display_name || "Neues Accessoire";
  const imageUrl = unlock?.image_url || null;
  const value = unlock?.value || "";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-end justify-center p-4 md:items-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#f0e5a5]/35 bg-black/55 p-5 text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-600/20 via-emerald-300/10 to-black/45" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-lime-200/35 bg-emerald-500/25 text-emerald-200">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200/90">Freigeschaltet</p>
                <h3 className="text-xl font-bold text-stone-50">Neues Accessoire</h3>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-4 rounded-2xl border border-lime-200/25 bg-black/35 p-3"
            >
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-lime-200/30 bg-emerald-900/35">
                {imageUrl ? (
                  <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
                ) : (
                  <Gift className="h-8 w-8 text-emerald-200" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-stone-100">{title}</p>
                <p className="truncate text-sm text-stone-300">{value}</p>
              </div>
            </motion.div>

            {remainingCount > 0 && (
              <p className="text-xs text-emerald-200/90">
                +{remainingCount} weitere Freischaltung{remainingCount > 1 ? "en" : ""} bereit
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onComplete?.()}
                className="rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 px-4 py-2 text-sm font-semibold text-stone-100 transition hover:brightness-110"
              >
                Weiter
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
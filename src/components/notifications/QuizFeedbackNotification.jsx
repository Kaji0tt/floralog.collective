import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuizFeedbackNotification({ feedback, onComplete }) {
  useEffect(() => {
    if (!feedback) return undefined;

    const autoCloseDelay = feedback.correct ? 2200 : 1800;
    const timeoutId = window.setTimeout(() => {
      onComplete?.();
    }, autoCloseDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback, onComplete]);

  if (!feedback) return null;

  const isCorrect = feedback.correct === true;
  const isResolved = feedback.resolved === true;
  const isConsolation = feedback.consolation === true;
  const isAborted = feedback.aborted === true;

  const title = feedback.error
    ? "Quiz-Antwort konnte nicht verarbeitet werden"
    : isCorrect
      ? "Richtig!"
      : isAborted
        ? "Leider falsch"
        : isResolved
          ? "Quiz beendet"
          : "Leider falsch";

  const message = feedback.error
    ? String(feedback.error)
    : isCorrect
      ? `+${feedback.rewardSeeds || 0} Samen, +${feedback.rewardDataQuality || 0} Datenqualitaet`
      : isAborted
        ? feedback.encouragementMessage || "Viel Glück beim nächsten Mal!"
        : isConsolation
          ? `Trostpreis: +${feedback.rewardSeeds || 0} Samen`
          : `Verbleibende Versuche: ${feedback.attemptsRemaining ?? "?"}`;

  const Icon = isCorrect ? CheckCircle2 : AlertCircle;
  const accentClass = isCorrect ? "text-emerald-300" : "text-rose-300";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2100] flex items-center justify-center px-4"
      >
        <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" onClick={() => onComplete?.()} />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={
            isCorrect
              ? { opacity: 1, y: 0, scale: [1, 1.02, 1] }
              : { opacity: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }
          }
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: isCorrect ? 0.42 : 0.3, ease: "easeOut" }}
          className="relative z-10 w-full max-w-sm rounded-3xl border border-amber-100/25 bg-[linear-gradient(180deg,rgba(10,24,16,0.96)_0%,rgba(6,16,10,0.97)_100%)] p-5 text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
        >
          {isCorrect && (
            <div className="pointer-events-none absolute inset-x-8 top-2 flex items-center justify-between text-amber-200/90">
              <Sparkles className="h-4 w-4" />
              <Sparkles className="h-5 w-5" />
              <Sparkles className="h-4 w-4" />
            </div>
          )}

          <div className={`flex items-center gap-2 font-semibold ${accentClass}`}>
            <Icon className="h-5 w-5" />
            <span>{title}</span>
          </div>

          {feedback.selectedPlantLabel && (
            <div className="mt-2 text-xs text-stone-300">
              Auswahl: {feedback.selectedPlantLabel}
            </div>
          )}

          <div className="mt-2 rounded-xl border border-stone-200/20 bg-black/35 px-3 py-2 text-sm text-stone-100">
            {message}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              className="border-stone-200/25 bg-black/35 text-stone-200 hover:bg-black/55 hover:text-stone-100"
              onClick={() => onComplete?.()}
            >
              Schliessen
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

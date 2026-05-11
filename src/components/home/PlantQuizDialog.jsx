import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, HelpCircle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function PlantQuizDialog({
  open,
  quiz,
  isSubmitting = false,
  result = null,
  onClose,
  onSubmit,
  onResetResult,
}) {
  const [selectedPlantId, setSelectedPlantId] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedPlantId("");
      return;
    }

    setSelectedPlantId("");
    onResetResult?.();
  }, [open, onResetResult]);

  const attemptsUsed = Math.max(0, Number(quiz?.wrongAttempts || 0));
  const attemptsTotal = Math.max(1, Number(quiz?.maxAttempts || 3));
  const attemptsRemaining = Math.max(0, attemptsTotal - attemptsUsed);

  const canSubmit = selectedPlantId && !isSubmitting && !result;
  const hasRetryableWrongResult = Boolean(result && !result.correct && !result.resolved && !result.aborted);
  const shouldLockAnswers = Boolean(result?.correct || result?.resolved);

  const resultMessage = useMemo(() => {
    if (!result) return null;

    if (result.error) {
      return {
        title: "Fehler",
        description: String(result.error),
        icon: AlertCircle,
        tone: "text-rose-300",
      };
    }

    if (result.correct) {
      return {
        title: "Richtig beantwortet",
        description: `Belohnung: +${result.rewardSeeds || 0} Samen, +${result.rewardDataQuality || 0} Datenqualität`,
        icon: CheckCircle2,
        tone: "text-emerald-300",
      };
    }

    if (result.resolved && result.aborted) {
      return {
        title: "Leider falsch",
        description: result.encouragementMessage || "Viel Glück beim nächsten Mal!",
        icon: AlertCircle,
        tone: "text-rose-300",
      };
    }

    if (result.resolved && result.consolation) {
      return {
        title: "Quiz beendet",
        description: `Trostpreis: +${result.rewardSeeds || 0} Samen`,
        icon: AlertCircle,
        tone: "text-amber-300",
      };
    }

    return {
      title: "Leider falsch",
      description: `Verbleibende Versuche: ${result.attemptsRemaining ?? "?"}`,
      icon: AlertCircle,
      tone: "text-rose-300",
    };
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-lg border border-amber-100/25 bg-[linear-gradient(180deg,rgba(10,24,16,0.96)_0%,rgba(6,16,10,0.97)_100%)] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl [&>button]:text-stone-300 [&>button]:hover:text-amber-100 [&>button]:hover:bg-black/30 [&>button]:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-300" />
            Pflanzen-Quiz
          </DialogTitle>
        </DialogHeader>

        {!quiz ? (
          <div className="rounded-xl border border-stone-200/15 bg-black/35 p-3 text-sm text-stone-300">Kein offenes Quiz gefunden.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-100/20 bg-black/35 p-3 text-xs sm:text-sm backdrop-blur-sm">
              <div>Versuche verbleibend: <strong>{attemptsRemaining}</strong> von {attemptsTotal}</div>
              <div className="mt-1 text-amber-200/90">Frage: Um welche Pflanze handelt es sich bei diesem Scan?</div>
            </div>

            {quiz.imageUrl ? (
              <div className="overflow-hidden rounded-2xl border border-amber-100/20 bg-black/25">
                <img src={quiz.imageUrl} alt="Quiz Scan" className="w-full h-56 object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-200/25 bg-black/35 p-6 text-sm text-stone-300 text-center">
                Kein Bild für diesen Scan verfügbar.
              </div>
            )}

            <div className="grid gap-2">
              {(quiz.options || []).map((option) => {
                const selected = selectedPlantId === option.plantId;
                return (
                  <button
                    key={option.plantId}
                    type="button"
                    disabled={isSubmitting || shouldLockAnswers || hasRetryableWrongResult}
                    onClick={() => setSelectedPlantId(option.plantId)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-amber-300/80 bg-amber-300/20 text-amber-100 shadow-[0_0_0_1px_rgba(252,211,77,0.22)]"
                        : "border-stone-200/20 bg-black/35 text-stone-100 hover:bg-black/55"
                    } ${isSubmitting || shouldLockAnswers || hasRetryableWrongResult ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {resultMessage && (
              <motion.div
                className="relative overflow-hidden rounded-2xl border border-stone-200/20 p-3 bg-black/45"
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={
                  result.correct
                    ? { opacity: 1, y: 0, scale: [1, 1.02, 1] }
                    : { opacity: 1, y: 0, x: [0, -4, 4, -3, 3, 0] }
                }
                transition={{ duration: result.correct ? 0.42 : 0.32, ease: "easeOut" }}
              >
                <AnimatePresence>
                  {result.correct && (
                    <>
                      {[0, 1, 2].map((idx) => (
                        <motion.span
                          key={`seed-burst-${idx}`}
                          className="pointer-events-none absolute top-2 text-lg"
                          style={{ left: `${20 + idx * 18}%` }}
                          initial={{ opacity: 0, y: 8, scale: 0.75 }}
                          animate={{ opacity: [0, 1, 0], y: [8, -12, -26], scale: [0.75, 1.05, 0.95] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.85, delay: idx * 0.06 }}
                        >
                          +
                        </motion.span>
                      ))}
                    </>
                  )}
                </AnimatePresence>
                <div className={`flex items-center gap-2 font-semibold ${resultMessage.tone}`}>
                  <resultMessage.icon className="w-4 h-4" />
                  {resultMessage.title}
                </div>
                <div className="text-sm text-stone-200 mt-1">{resultMessage.description}</div>
              </motion.div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="border-stone-200/25 bg-black/35 text-stone-200 hover:bg-black/55 hover:text-stone-100"
                onClick={() => onClose?.()}
              >
                Schließen
              </Button>
              {hasRetryableWrongResult && (
                <Button
                  variant="outline"
                  className="border-amber-200/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
                  onClick={() => {
                    setSelectedPlantId("");
                    onResetResult?.();
                  }}
                >
                  Weiter versuchen
                </Button>
              )}
              {!result && (
                <Button
                  onClick={() => {
                    const selectedOption = (quiz.options || []).find((option) => option.plantId === selectedPlantId);
                    onSubmit?.({
                      quizId: quiz.id,
                      selectedPlantId,
                      selectedPlantLabel: selectedOption?.label || "",
                    });
                  }}
                  disabled={!canSubmit}
                  className="bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-semibold"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Antwort prüfen"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

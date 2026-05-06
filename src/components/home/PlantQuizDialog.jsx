import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, HelpCircle, Loader2 } from "lucide-react";

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
  }, [open, quiz?.id, onResetResult]);

  const attemptsUsed = Math.max(0, Number(quiz?.wrongAttempts || 0));
  const attemptsTotal = Math.max(1, Number(quiz?.maxAttempts || 3));
  const attemptsRemaining = Math.max(0, attemptsTotal - attemptsUsed);

  const canSubmit = selectedPlantId && !isSubmitting && !result;

  const resultMessage = useMemo(() => {
    if (!result) return null;

    if (result.correct) {
      return {
        title: "Richtig beantwortet",
        description: `Belohnung: +${result.rewardSeeds || 0} Samen, +${result.rewardDataQuality || 0} Datenqualität`,
        icon: CheckCircle2,
        tone: "text-emerald-600",
      };
    }

    if (result.resolved && result.consolation) {
      return {
        title: "Quiz beendet",
        description: `Trostpreis: +${result.rewardSeeds || 0} Samen`,
        icon: AlertCircle,
        tone: "text-amber-600",
      };
    }

    return {
      title: "Leider falsch",
      description: `Verbleibende Versuche: ${result.attemptsRemaining ?? "?"}`,
      icon: AlertCircle,
      tone: "text-red-600",
    };
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-orange-500" />
            Pflanzen-Quiz
          </DialogTitle>
        </DialogHeader>

        {!quiz ? (
          <div className="text-sm text-muted-foreground">Kein offenes Quiz gefunden.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-orange-50/70 border-orange-200 p-3 text-xs sm:text-sm">
              <div>Versuche verbleibend: <strong>{attemptsRemaining}</strong> von {attemptsTotal}</div>
              <div className="mt-1 text-orange-700">Frage: Um welche Pflanze handelt es sich bei diesem Scan?</div>
            </div>

            {quiz.imageUrl ? (
              <div className="overflow-hidden rounded-xl border">
                <img src={quiz.imageUrl} alt="Quiz Scan" className="w-full h-56 object-cover" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground text-center">
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
                    disabled={isSubmitting || Boolean(result)}
                    onClick={() => setSelectedPlantId(option.plantId)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-orange-500 bg-orange-100 text-orange-900"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    } ${isSubmitting || result ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {resultMessage && (
              <div className="rounded-lg border p-3 bg-slate-50">
                <div className={`flex items-center gap-2 font-semibold ${resultMessage.tone}`}>
                  <resultMessage.icon className="w-4 h-4" />
                  {resultMessage.title}
                </div>
                <div className="text-sm text-slate-700 mt-1">{resultMessage.description}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => onClose?.()}>
                Schließen
              </Button>
              {!result && (
                <Button
                  onClick={() => onSubmit?.({ selectedPlantId })}
                  disabled={!canSubmit}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
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

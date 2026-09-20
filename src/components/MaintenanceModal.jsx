import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

/**
 * Shown when login fails or is disabled, e.g. during backend maintenance windows.
 * `dismissible=false` hides the close affordances (used while login is fully blocked).
 */
export default function MaintenanceModal({ open, onClose, detail = null, message = null, dismissible = true }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && dismissible) onClose?.(); }}>
      <DialogContent className="max-w-sm mx-auto" hideCloseButton={!dismissible}>
        <DialogHeader className="text-center items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-stone-900">
            Floralog wird gewartet
          </DialogTitle>
          <DialogDescription className="text-stone-600 mt-2 text-left space-y-2">
            {message ? (
              <p>{message}</p>
            ) : (
              <>
                <p>
                  Aktuell finden Wartungsarbeiten an unseren Servern statt. Da Floralog ein
                  Single-Dev-Projekt ist, kann dieser Prozess einige Zeit in Anspruch nehmen.
                </p>
                <p>
                  Hinweis: Falls du die Version aus dem Playstore installiert hast, aktualisiere
                  diese bestenfalls, sobald die Server wieder verfügbar sind.
                </p>
              </>
            )}
            {detail && (
              <p className="text-xs text-stone-400 break-words">
                Technische Details: {detail}
              </p>
            )}
          </DialogDescription>
        </DialogHeader>

        {dismissible && (
          <DialogFooter className="mt-1">
            <Button
              onClick={onClose}
              className="w-full bg-gradient-to-br from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold shadow-md"
            >
              Verstanden
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

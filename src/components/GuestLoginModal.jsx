import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Leaf } from "lucide-react";

/**
 * Modal shown to guest users when they try to perform an action that requires authentication.
 *
 * Registrierungs-Flows im Überblick:
 *  - Primärer Flow: GuestHomeFlow-Modal auf "/" (Erstbesucher über Landing Page)
 *  - Sekundärer Flow: Standalone-Seite "/register" (z.B. von hier aus, oder direkte URL)
 *  - Kaputt / nicht verwenden: createPageUrl("Register") → "/Register" → 404
 *
 * Die Route "/login" in App.jsx redirectet ebenfalls zu "/".
 * Referral-Codes werden in beiden Fällen aus localStorage verarbeitet (Home.jsx).
 */
export default function GuestLoginModal({ open, onClose }) {
  const navigate = useNavigate();

  const handleLogin = () => {
    onClose();
    // /login redirectet zu "/" (App.jsx), direkt zu "/" navigieren ist äquivalent
    navigate("/");
  };

  const handleRegister = () => {
    onClose();
    // Standalone-Registrierungsseite; Referral-Code bleibt im localStorage erhalten
    navigate("/register");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader className="text-center items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-stone-900">
            Anmeldung erforderlich
          </DialogTitle>
          <DialogDescription className="text-stone-600 mt-2">
            Diese Funktion ist nur für angemeldete Nutzer verfügbar. Melde dich an oder erstelle ein kostenloses Konto, um Floralog vollständig zu nutzen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <Button
            onClick={handleLogin}
            className="w-full bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-md"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Anmelden
          </Button>

          <Button
            onClick={handleRegister}
            variant="outline"
            className="w-full border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Kostenlos registrieren
          </Button>
        </div>

        <DialogFooter className="mt-1">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-stone-500 hover:text-stone-700 transition-colors py-1"
          >
            Als Gast weiter stöbern
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

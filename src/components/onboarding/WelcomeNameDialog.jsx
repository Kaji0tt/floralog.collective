import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Leaf, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function WelcomeNameDialog({ user, onComplete }) {
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Zeige Dialog nur, wenn User keinen display_name hat
    if (user && !user.display_name) {
      setShowDialog(true);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      // 1. Speichere den Namen
      await base44.auth.updateMe({ display_name: name.trim() });

      // 2. Erstelle die Willkommens-Benachrichtigung
      await base44.entities.UserNotification.create({
          user_email: user.email,
          notification_type: "custom",
          title: "🌿 Willkommen im Floralog!",
          message: `Hallo ${name.trim()}! Schön, dass du da bist. Floralog ist dein persönlicher Wegbegleiter für all deine Entdeckungen in der Natur. Dabei landet jede Entdeckung in einer eigenen Kollektion.`,
          description: "Öffne die Kollektion deines Floralogs.",
          action_url: "",
          priority: "high",
          display_location: "modal"
        });

      // 3. Erstelle Scanner-Hinweis-Benachrichtigung
      await base44.entities.UserNotification.create({
          user_email: user.email,
          notification_type: "custom",
          title: "📸 Bereit für deinen ersten Scan?",
          message: "Klicke auf den 'Scannen' Button, um deine erste Pflanze zu entdecken! Halte einfach die Kamera auf eine Pflanze und lass die KI ihre Magie wirken.",
          description: "Starte jetzt deinen ersten Scan!",
          action_url: "Scanner",
          priority: "high",
          display_location: "modal"
        });

      // 3. Dialog schließen
      setShowDialog(false);
      
      // 4. Benachrichtige Parent-Komponente
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern des Namens. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-green-800 flex items-center justify-center gap-2">
            <Leaf className="w-6 h-6" />
            Willkommen im Floralog!
            <Sparkles className="w-6 h-6 text-amber-500" />
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6"
          >
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <Leaf className="w-12 h-12 text-white" />
            </div>
            <p className="text-stone-700 text-lg">
              Bevor wir starten, wie möchtest du genannt werden?
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Dein Name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg text-center"
                maxLength={50}
                autoFocus
                required
              />
            </div>

            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-6 text-lg"
            >
              {isSubmitting ? "Wird gespeichert..." : "Los geht's! 🌱"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
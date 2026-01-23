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

    console.log("[WelcomeNameDialog] Starte Speichervorgang für Name:", name.trim());
    setIsSubmitting(true);
    
    try {
      // 1. Speichere den Namen
      console.log("[WelcomeNameDialog] Aktualisiere User mit email:", user.email);
      await base44.auth.updateMe({ display_name: name.trim() });
      console.log("[WelcomeNameDialog] User erfolgreich aktualisiert");

      // 2. Erstelle oder aktualisiere das PublicProfile
      console.log("[WelcomeNameDialog] Lade alle PublicProfiles");
      const profiles = await base44.entities.PublicProfile.list();
      const existingProfile = profiles.find(p => p.user_email?.toLowerCase() === user.email?.toLowerCase());
      console.log("[WelcomeNameDialog] Gefundenes Profile:", existingProfile);
      
      const profileData = {
        user_email: user.email,
        display_name: name.trim(),
        full_name: user.full_name
      };

      if (existingProfile) {
        console.log("[WelcomeNameDialog] Aktualisiere bestehendes Profile:", existingProfile.id);
        await base44.entities.PublicProfile.update(existingProfile.id, profileData);
        console.log("[WelcomeNameDialog] PublicProfile erfolgreich aktualisiert");
      } else {
        console.log("[WelcomeNameDialog] Erstelle neues PublicProfile");
        await base44.entities.PublicProfile.create(profileData);
        console.log("[WelcomeNameDialog] PublicProfile erfolgreich erstellt");
      }

      // 3. Prüfe, ob eine Willkommens-Benachrichtigung bereits existiert und ungesehen ist
      console.log("[WelcomeNameDialog] Prüfe Welcome Notification");
      const welcomeNotifications = await base44.entities.UserNotification.filter({
        user_email: user.email,
        title: "🌿 Willkommen im Floralog!",
        seen: false
      });
      console.log("[WelcomeNameDialog] Gefundene Welcome Notifications:", welcomeNotifications.length);
      
      if (welcomeNotifications.length === 0) {
        // 4. Erstelle die Willkommens-Benachrichtigung nur, wenn keine ungesehene existiert
        console.log("[WelcomeNameDialog] Erstelle Welcome Notification");
        await base44.entities.UserNotification.create({
            user_email: user.email,
            notification_type: "custom",
            title: "🌿 Willkommen im Floralog!",
            message: `Hallo ${name.trim()}! Schön, dass du da bist. Floralog ist dein persönlicher Wegbegleiter für all deine Entdeckungen in der Natur. Dabei landet jede Entdeckung in einer eigenen Kollektion. Klicke auf den 'Scannen' Button, um deine erste Pflanze zu entdecken!`,
            description: "Starte jetzt deinen ersten Scan!",
            action_url: "",
            priority: "high",
            display_location: "modal"
          });
        console.log("[WelcomeNameDialog] Welcome Notification erstellt");
      }

      // 5. Warte kurz, damit die Datenbank-Updates durchgehen
      console.log("[WelcomeNameDialog] Warte 500ms für DB-Propagierung");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 6. Dialog schließen
      console.log("[WelcomeNameDialog] Schließe Dialog");
      setShowDialog(false);
      
      // 7. Benachrichtige Parent-Komponente (Layout), um User neu zu laden
      console.log("[WelcomeNameDialog] Rufe onComplete Callback auf");
      if (onComplete) {
        await onComplete();
        console.log("[WelcomeNameDialog] onComplete erfolgreich ausgeführt");
      }
    } catch (error) {
      console.error("[WelcomeNameDialog] Fehler beim Speichern:", error);
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
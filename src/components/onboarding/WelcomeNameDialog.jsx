import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Query } from "@/api/entities";
import { createUserNotification } from "@/api/notificationService";
import { updateCurrentUserProfile } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { Leaf, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function WelcomeNameDialog({ user, onComplete }) {
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const hasAnyName = Boolean(
      user?.display_name?.trim?.() ||
      user?.full_name?.trim?.() ||
      user?.user_metadata?.display_name?.trim?.() ||
      user?.user_metadata?.full_name?.trim?.() ||
      user?.user_metadata?.name?.trim?.()
    );

    // Zeige Dialog nur, wenn wirklich kein Name vorhanden ist
    if (user && !hasAnyName) {
      setShowDialog(true);
    } else {
      setShowDialog(false);
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
      await updateCurrentUserProfile({ display_name: name.trim() });
      console.log("[WelcomeNameDialog] User erfolgreich aktualisiert");

      // 2. Upsert das PublicProfile (erstelle oder aktualisiere)
      console.log("[WelcomeNameDialog] Upsert PublicProfile für auth_id:", user.id);
      
      const profileData = {
        user_email: user.email,        // Legacy, für Leserlichkeit
        display_name: name.trim(),
        full_name: user.full_name
      };

      await upsertUserProfile(user.id, profileData);
      console.log("[WelcomeNameDialog] PublicProfile erfolgreich upserted");

      // 3. Prüfe, ob eine Willkommens-Benachrichtigung bereits existiert und ungesehen ist
      console.log("[WelcomeNameDialog] Prüfe Welcome Notification");
      const welcomeNotifications = await Query.UserNotification.filter({
        auth_id: user.id,
        title: "🌿 Willkommen im Floralog!",
        seen: false
      });
      console.log("[WelcomeNameDialog] Gefundene Welcome Notifications:", welcomeNotifications.length);
      
      if (welcomeNotifications.length === 0) {
        // 4. Erstelle die Willkommens-Benachrichtigung nur, wenn keine ungesehene existiert
        console.log("[WelcomeNameDialog] Erstelle Welcome Notification");
        await createUserNotification({
          authId: user.id,
          userEmail: user.email,
          notificationType: "custom",
          title: "🤖 Florabot online – Willkommen!",
          message: `Hallo ${name.trim()}! Ich bin Florabot – dein botanischer Begleiter aus den Tiefen des Alls. Zeig mir deine erste Pflanze und wir fangen gemeinsam an, die Erde zu kartieren!`,
          description: "Starte jetzt deinen ersten Scan!",
          actionUrl: "",
          priority: "high",
          displayLocation: "modal",
          createdBy: user.email,
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


import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function ProfileInitializer({ user, onComplete }) {
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const initializeProfile = async () => {
      // Prüfe ob User einen full_name hat aber noch kein PublicProfile
      if (!user?.full_name || isInitializing) return;

      try {
        setIsInitializing(true);

        // Prüfe ob PublicProfile bereits existiert
        const profiles = await base44.entities.PublicProfile.list();
        const existingProfile = profiles.find(p => 
          p.user_email?.toLowerCase() === user.email?.toLowerCase()
        );

        if (!existingProfile) {
          // Erstelle PublicProfile mit display_name aus full_name
          await base44.entities.PublicProfile.create({
            user_email: user.email,
            display_name: user.full_name,
            full_name: user.full_name,
            title: "Pflanzen-Entdecker"
          });

          // Speichere display_name auch in User
          await base44.auth.updateMe({ display_name: user.full_name });

          // Erstelle Willkommens-Benachrichtigung
          const welcomeNotifications = await base44.entities.UserNotification.filter({
            user_email: user.email,
            title: "🌿 Willkommen im Floralog!",
            seen: false
          });
          
          if (welcomeNotifications.length === 0) {
            await base44.entities.UserNotification.create({
              user_email: user.email,
              notification_type: "custom",
              title: "🌿 Willkommen im Floralog!",
              message: `Hallo ${user.full_name}! Schön, dass du da bist. Floralog ist dein persönlicher Wegbegleiter für all deine Entdeckungen in der Natur. Dabei landet jede Entdeckung in einer eigenen Kollektion. Klicke auf den 'Scannen' Button, um deine erste Pflanze zu entdecken!`,
              description: "Starte jetzt deinen ersten Scan!",
              action_url: "",
              priority: "high",
              display_location: "modal"
            });
          }

          // Benachrichtige Parent wenn Initialisierung abgeschlossen ist
          if (onComplete) {
            onComplete();
          }
        }
      } catch (error) {
        console.error("Fehler bei Profil-Initialisierung:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeProfile();
  }, [user?.full_name, user?.email]);

  // Diese Komponente rendert nichts - sie ist nur für die Logik
  return null;
}
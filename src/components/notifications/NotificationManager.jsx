import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { updateCurrentUserProfile } from "@/api/userApi";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotificationManager({ user, showInProfile = false }) {
  const [permissionState, setPermissionState] = useState("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, [user]);

  const checkNotificationStatus = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    const permission = Notification.permission;
    setPermissionState(permission);

    if (permission === "granted" && user?.push_subscription) {
      setIsSubscribed(true);
    } else if (permission === "default" && !localStorage.getItem("notification-prompt-dismissed") && !showInProfile) {
      // Zeige Prompt nach 5 Sekunden
      setTimeout(() => setShowPrompt(true), 5000);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker not supported");
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  };

  const subscribeToPush = async () => {
    try {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VITE_VAPID_PUBLIC_KEY ist nicht gesetzt");
      }
      
      // Service Worker registrieren
      const registration = await registerServiceWorker();

      // Push Subscription erstellen
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Subscription in Datenbank speichern
      await updateCurrentUserProfile({
        push_subscription: JSON.stringify(subscription.toJSON())
      });

      setIsSubscribed(true);
      setShowPrompt(false);
      alert("🔔 Push-Benachrichtigungen aktiviert! Du wirst nun über Geschenke informiert.");
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      alert("Fehler beim Aktivieren der Benachrichtigungen. Stelle sicher, dass dein Browser Push-Benachrichtigungen unterstützt.");
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === "granted") {
        await subscribeToPush();
      } else {
        alert("Benachrichtigungen wurden abgelehnt. Du kannst sie in den Browser-Einstellungen aktivieren.");
        setShowPrompt(false);
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      alert("Fehler beim Anfordern der Berechtigung.");
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      await updateCurrentUserProfile({
        push_subscription: null
      });

      setIsSubscribed(false);
      alert("Push-Benachrichtigungen deaktiviert.");
    } catch (error) {
      console.error("Error unsubscribing:", error);
      alert("Fehler beim Deaktivieren der Benachrichtigungen.");
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("notification-prompt-dismissed", "true");
  };

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }

  // Im Profil: Zeige nur Button
  if (showInProfile) {
    return (
      <Button
        onClick={isSubscribed ? unsubscribeFromPush : requestNotificationPermission}
        variant="outline"
        className="w-full"
      >
        {isSubscribed ? (
          <>
            <BellOff className="w-4 h-4 mr-2" />
            Benachrichtigungen deaktivieren
          </>
        ) : (
          <>
            <Bell className="w-4 h-4 mr-2" />
            Benachrichtigungen aktivieren
          </>
        )}
      </Button>
    );
  }

  // Banner-Prompt
  return (
    <>
      {showPrompt && permissionState === "default" && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5">
          <Card className="border-2 border-green-600 shadow-xl bg-white">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-stone-900 mb-1">
                    Aktiviere Benachrichtigungen! 🎁
                  </h3>
                  <p className="text-sm text-stone-600 mb-3">
                    Erhalte sofort eine Nachricht, wenn dir ein Freund eine Pflanze schenkt.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={requestNotificationPermission}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Bell className="w-4 h-4 mr-1" />
                      Aktivieren
                    </Button>
                    <Button
                      onClick={dismissPrompt}
                      size="sm"
                      variant="outline"
                    >
                      Später
                    </Button>
                  </div>
                </div>
                <button
                  onClick={dismissPrompt}
                  className="flex-shrink-0 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

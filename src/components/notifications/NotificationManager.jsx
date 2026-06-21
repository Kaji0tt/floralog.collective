import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { updateCurrentUserProfile } from "@/api/userApi";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * @param {{ user?: { push_subscription?: string | null; fcm_token?: string | null } | null; showInProfile?: boolean }} props
 */
export default function NotificationManager({ user, showInProfile = false }) {
  const [permissionState, setPermissionState] = useState("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isNativePush = Capacitor.isNativePlatform();
  const supportsWebPush =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const supportsPush = isNativePush || supportsWebPush;
  const hasPendingPermission =
    permissionState === "default" ||
    permissionState === "prompt" ||
    permissionState === "prompt-with-rationale";

  useEffect(() => {
    checkNotificationStatus();
  }, [user]);

  const checkNotificationStatus = async () => {
    if (!supportsPush) {
      return;
    }

    if (isNativePush) {
      try {
        const permission = await PushNotifications.checkPermissions();
        const receivePermission = permission?.receive || "prompt";
        setPermissionState(receivePermission);

        const hasToken = Boolean(user?.fcm_token);
        setIsSubscribed(receivePermission === "granted" && hasToken);

        if (receivePermission === "prompt" && !localStorage.getItem("notification-prompt-dismissed") && !showInProfile) {
          setTimeout(() => setShowPrompt(true), 5000);
        }
      } catch (_error) {
        setIsSubscribed(false);
      }
      return;
    }

    const permission = Notification.permission;
    setPermissionState(permission);

    if (permission === "granted") {
      try {
        const registration = await registerServiceWorker();
        const subscription = await registration.pushManager.getSubscription();

        // Keep the backend in sync with the active subscription of this device.
        if (subscription) {
          const nextValue = JSON.stringify(subscription.toJSON());
          if (user?.push_subscription !== nextValue) {
            await updateCurrentUserProfile({ push_subscription: nextValue });
          }
        }

        setIsSubscribed(Boolean(subscription));
      } catch (_error) {
        setIsSubscribed(false);
      }
    } else {
      setIsSubscribed(false);
    }

    if (permission === "default" && !localStorage.getItem("notification-prompt-dismissed") && !showInProfile) {
      // Zeige Prompt nach 5 Sekunden
      setTimeout(() => setShowPrompt(true), 5000);
    }
  };

  /** @param {string} base64String */
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

  /** @param {unknown} error */
  const getPushActivationErrorMessage = (error) => {
    const typedError = /** @type {{ message?: string; name?: string }} */ (error || {});

    if (isNativePush) {
      const message = (typedError.message || "").trim();
      if (message) return `Push-Aktivierung fehlgeschlagen: ${message}`;
      return "Push-Aktivierung fehlgeschlagen. Bitte Berechtigungen und Firebase-Konfiguration prüfen.";
    }

    const errorName = typedError.name || "UnknownError";
    const rawMessage = (typedError.message || "").trim();
    const isFirefoxAndroid = /Android/i.test(navigator.userAgent) && /Firefox/i.test(navigator.userAgent);

    if (!window.isSecureContext) {
      return "Push funktioniert nur in sicherem Kontext (HTTPS).";
    }

    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      return "Push ist noch nicht konfiguriert: VITE_VAPID_PUBLIC_KEY fehlt im Frontend-Environment.";
    }

    if (!("PushManager" in window)) {
      return "Dieser Browser erlaubt Benachrichtigungen, unterstützt aber kein Web-Push per Service Worker.";
    }

    if (errorName === "NotAllowedError") {
      return "Benachrichtigung wurde blockiert. Bitte Browser- und Website-Berechtigungen erneut prüfen.";
    }

    if (errorName === "InvalidStateError") {
      return "Push konnte nicht initialisiert werden. Bitte Seite neu laden und erneut versuchen.";
    }

    if (errorName === "NotSupportedError") {
      if (isFirefoxAndroid) {
        return "Firefox auf Android ist bei Web-Push je nach Version eingeschraenkt. Teste alternativ Chrome/Edge auf dem Handy.";
      }
      return "Web-Push wird von diesem Browser/Geraet nicht vollstaendig unterstuetzt.";
    }

    if (errorName === "AbortError") {
      return "Push-Aktivierung wurde vom Browser abgebrochen. Bitte erneut versuchen.";
    }

    if (rawMessage) {
      return `Push-Aktivierung fehlgeschlagen: ${rawMessage}`;
    }

    return "Push-Aktivierung fehlgeschlagen. Bitte pruefe Browser-Kompatibilitaet, HTTPS und VAPID-Konfiguration.";
  };

  const registerServiceWorker = async () => {
    if (!supportsPush) {
      throw new Error("Service Worker not supported");
    }

    if (!window.isSecureContext) {
      throw new Error("Push notifications require HTTPS");
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  };

  const registerNativeToken = async () => {
    /** @type {import("@capacitor/core").PluginListenerHandle[]} */
    const listenerHandles = [];

    try {
      const tokenPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Zeitüberschreitung bei nativer Push-Registrierung"));
        }, 12000);

        const registrationListenerPromise = PushNotifications.addListener("registration", (token) => {
          clearTimeout(timeoutId);
          resolve(token?.value || "");
        });

        const registrationErrorListenerPromise = PushNotifications.addListener("registrationError", (registrationError) => {
          clearTimeout(timeoutId);
          reject(new Error(registrationError?.error || "Native Registrierung fehlgeschlagen"));
        });

        Promise.all([registrationListenerPromise, registrationErrorListenerPromise]).then(([listenerHandle, errorHandle]) => {
          listenerHandles.push(listenerHandle, errorHandle);
        }).catch((listenerError) => {
          clearTimeout(timeoutId);
          reject(listenerError);
        });
      });

      await PushNotifications.register();
      const token = await tokenPromise;
      if (!token) {
        throw new Error("Kein FCM-Token erhalten");
      }
      return token;
    } finally {
      await Promise.all(listenerHandles.map((handle) => handle.remove()));
    }
  };

  const subscribeToNativePush = async () => {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }

    setPermissionState(permission.receive || "prompt");

    if (permission.receive !== "granted") {
      throw new Error("Benachrichtigungsberechtigung wurde nicht erteilt");
    }

    const fcmToken = await registerNativeToken();

    await updateCurrentUserProfile({
      fcm_token: fcmToken,
    });
  };

  const subscribeToWebPush = async () => {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      throw new Error("VITE_VAPID_PUBLIC_KEY ist nicht gesetzt");
    }

    const registration = await registerServiceWorker();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    await updateCurrentUserProfile({
      push_subscription: JSON.stringify(subscription.toJSON())
    });
  };

  const subscribeToPush = async () => {
    setIsLoading(true);
    try {
      if (isNativePush) {
        await subscribeToNativePush();
      } else {
        await subscribeToWebPush();
      }

      setIsSubscribed(true);
      setShowPrompt(false);
      alert("🔔 Push-Benachrichtigungen aktiviert! Du wirst nun über Geschenke informiert.");
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      alert(getPushActivationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (isNativePush) {
      await subscribeToPush();
      return;
    }

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
    setIsLoading(true);
    try {
      if (isNativePush) {
        if (typeof PushNotifications.unregister === "function") {
          await PushNotifications.unregister();
        }
        await updateCurrentUserProfile({
          fcm_token: null,
        });
      } else {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
        }

        await updateCurrentUserProfile({
          push_subscription: null
        });
      }

      setIsSubscribed(false);
      alert("Push-Benachrichtigungen deaktiviert.");
    } catch (error) {
      console.error("Error unsubscribing:", error);
      alert("Fehler beim Deaktivieren der Benachrichtigungen.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = () => {
    if (!supportsPush) {
      return { text: "Nicht unterstützt: Dieser Browser unterstützt keine Push-Benachrichtigungen.", className: "text-red-700" };
    }

    if (isNativePush) {
      if (permissionState === "denied") {
        return { text: "Blockiert: Bitte Benachrichtigungen in den App-/Systemeinstellungen wieder erlauben.", className: "text-amber-700" };
      }
      if (permissionState === "granted" && isSubscribed) {
        return { text: "Aktiv auf diesem Gerät: Native Push-Benachrichtigungen sind eingeschaltet.", className: "text-green-700" };
      }
      if (permissionState === "granted" && !isSubscribed) {
        return { text: "Berechtigt, aber kein FCM-Token im Profil gespeichert. Bitte erneut aktivieren.", className: "text-amber-700" };
      }
      return { text: "Noch nicht entschieden: Benachrichtigungen sind aktuell aus.", className: "text-stone-600" };
    }

    if (permissionState === "denied") {
      return { text: "Blockiert: In den Browser-Einstellungen wieder erlauben.", className: "text-amber-700" };
    }
    if (permissionState === "granted" && isSubscribed) {
      return { text: "Aktiv auf diesem Gerät: Push-Benachrichtigungen sind eingeschaltet.", className: "text-green-700" };
    }
    if (permissionState === "granted" && !isSubscribed) {
      return { text: "Nicht aktiv auf diesem Gerät: Berechtigung ist erteilt, aber keine lokale Push-Subscription gefunden.", className: "text-amber-700" };
    }
    return { text: "Noch nicht entschieden: Benachrichtigungen sind aktuell aus.", className: "text-stone-600" };
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("notification-prompt-dismissed", "true");
  };

  if (!supportsPush) {
    return null;
  }

  // Im Profil: Status + Toggle-Steuerung
  if (showInProfile) {
    const status = getStatusLabel();
    const statusColorClass = status.className
      .replace("text-red-700", "text-red-300")
      .replace("text-amber-700", "text-amber-300")
      .replace("text-green-700", "text-green-300")
      .replace("text-stone-600", "text-stone-400");
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-transparent rounded-lg border border-[#f0e5a5]/15">
          <div>
            <p className="font-semibold text-stone-100">Push-Benachrichtigungen</p>
            <p className="text-xs text-stone-400">
              Aktiviere Push für Geschenke, Einladungen und Neuigkeiten.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSubscribed}
              onChange={(e) => {
                if (e.target.checked) {
                  requestNotificationPermission();
                } else {
                  unsubscribeFromPush();
                }
              }}
              className="sr-only peer"
              disabled={isLoading}
            />
            <div className="w-11 h-6 bg-stone-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        <p className={`text-xs ${statusColorClass}`}>{status.text}</p>
        <Button
          onClick={checkNotificationStatus}
          variant="ghost"
          className="w-full text-xs text-stone-300 hover:text-stone-100 hover:bg-white/5"
          disabled={isLoading}
        >
          Status neu prüfen
        </Button>
      </div>
    );
  }

  // Banner-Prompt
  return (
    <>
      {showPrompt && hasPendingPermission && (
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
                    Werde mit Push-Mitteilungen benachrichtigt, wenn dein Florabot Neues zu berichten hat.
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

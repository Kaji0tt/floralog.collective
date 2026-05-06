import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { Capacitor } from "@capacitor/core";

export default function LocationManager({ showInProfile = false }) {
  const [permissionState, setPermissionState] = useState("prompt");
  const [isLoading, setIsLoading] = useState(false);
  const isNativePlatform = Capacitor.isNativePlatform();

  const supportsGeolocation =
    typeof window !== "undefined" && "geolocation" in navigator;

  useEffect(() => {
    checkLocationStatus();
  }, []);

  const checkLocationStatus = async () => {
    if (!supportsGeolocation) return;

    // In native WebViews the Permissions API can report "prompt" even after
    // permission has already been granted. Verify via a real location read.
    if (isNativePlatform) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermissionState("granted");
            resolve(null);
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionState("denied");
            } else {
              setPermissionState("prompt");
            }
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
      });
      return;
    }

    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" });
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      } catch (_error) {
        // Permissions API not available – fall back to unknown state
      }
    }
  };

  // Called by "Status neu prüfen" button – verifies by actually requesting the
  // position instead of relying solely on the Permissions API, which returns
  // "prompt" on iOS Safari and some other browsers even after the user has
  // already granted access, causing the toggle to flip off erroneously.
  const verifyLocationStatus = () => {
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (_position) => {
        setPermissionState("granted");
        setIsLoading(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState("denied");
          setIsLoading(false);
        } else {
          // Timeout or position unavailable – permission may still be granted
          // but GPS is currently inaccessible. Fall back to the Permissions API
          // so we at least show the correct "granted/denied" state.
          checkLocationStatus().finally(() => setIsLoading(false));
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const requestLocation = () => {
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (_position) => {
        setPermissionState("granted");
        setIsLoading(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState("denied");
        }
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getStatusLabel = () => {
    if (!supportsGeolocation) {
      return {
        text: "Nicht unterstützt: Dieser Browser unterstützt keine Standortermittlung.",
        className: "text-red-700",
      };
    }
    if (permissionState === "denied") {
      return {
        text: "Blockiert: Standort in den Browser-Einstellungen wieder erlauben.",
        className: "text-amber-700",
      };
    }
    if (permissionState === "granted") {
      return {
        text: "Aktiv: Standortermittlung ist für diese App erlaubt.",
        className: "text-green-700",
      };
    }
    return {
      text: "Noch nicht entschieden: Standortermittlung ist aktuell nicht freigegeben.",
      className: "text-stone-600",
    };
  };

  if (!supportsGeolocation) return null;

  if (showInProfile) {
    const status = getStatusLabel();
    const isGranted = permissionState === "granted";
    const statusColorClass = status.className
      .replace("text-red-700", "text-red-300")
      .replace("text-amber-700", "text-amber-300")
      .replace("text-green-700", "text-green-300")
      .replace("text-stone-600", "text-stone-400");

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-transparent rounded-lg border border-[#f0e5a5]/15">
          <div>
            <p className="font-semibold text-stone-100">Standortermittlung</p>
            <p className="text-xs text-stone-400">
              Aktiviere den Standort für lokale Pflanzenfunde und Karte.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isGranted}
              onChange={(e) => {
                if (e.target.checked) {
                  requestLocation();
                } else {
                  // Browsers do not allow programmatic revocation – inform the user
                  alert(
                    "Um die Standortermittlung zu deaktivieren, entziehe die Berechtigung in den Browser-Einstellungen für diese Seite."
                  );
                }
              }}
              className="sr-only peer"
              disabled={isLoading || permissionState === "denied"}
            />
            <div className="w-11 h-6 bg-stone-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        <p className={`text-xs ${statusColorClass}`}>{status.text}</p>
        <Button
          onClick={verifyLocationStatus}
          variant="ghost"
          className="w-full text-xs text-stone-300 hover:text-stone-100 hover:bg-white/5"
          disabled={isLoading}
        >
          Status neu prüfen
        </Button>
      </div>
    );
  }

  return null;
}

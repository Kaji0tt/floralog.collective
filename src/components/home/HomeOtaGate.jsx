import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import GuestHomeFlow from "@/components/home/GuestHomeFlow";

const DEFAULT_OTA_VERSION_URL = "https://floralog-ota.green-term-27d0.workers.dev/version.json";

function useOtaGate() {
  const [forceGuest, setForceGuest] = useState(false);
  const [isCheckingOta, setIsCheckingOta] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkOta() {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch("/bundle-version.json", {
          cache: "no-store",
          signal: controller.signal,
        });
        const local = await res.json();
        const localVersion = local?.version;

        const otaUrl =
          import.meta.env.VITE_OTA_VERSION_URL
          || import.meta.env.VITE_OTA_MANIFEST_URL
          || DEFAULT_OTA_VERSION_URL;

        if (!otaUrl) return;

        const otaRes = await fetch(otaUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        const ota = await otaRes.json();
        const otaVersion = ota?.version;
        const mandatory = ota?.mandatory === true;

        if ((otaVersion && localVersion && otaVersion > localVersion) || mandatory) {
          if (!cancelled) setForceGuest(true);
        }
      } catch {
        // Do not block app startup when OTA check fails.
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) {
          setIsCheckingOta(false);
        }
      }
    }

    checkOta();
    return () => {
      cancelled = true;
    };
  }, []);

  return { forceGuest, isCheckingOta };
}

function OtaVersionCheckLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 gap-3">
      <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      <p className="text-sm font-medium text-green-800">Prüfe Version...</p>
    </div>
  );
}

export default function HomeOtaGate({ children }) {
  const { forceGuest, isCheckingOta } = useOtaGate();

  if (isCheckingOta) {
    return <OtaVersionCheckLoader />;
  }

  if (forceGuest) {
    return <GuestHomeFlow />;
  }

  return children;
}

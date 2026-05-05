import { useEffect, useState } from "react";
import { Download, Leaf } from "lucide-react";
import GuestHomeFlow from "@/components/home/GuestHomeFlow";
import { checkApkVersion } from "@/lib/apkVersionService";
import { supabase } from "@/api/supabaseClient";

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

function useApkForceUpdate() {
  const [isForcedApkUpdate, setIsForcedApkUpdate] = useState(false);
  const [apkManifest, setApkManifest] = useState(null);
  const [isCheckingApk, setIsCheckingApk] = useState(true);

  useEffect(() => {
    let cancelled = false;

    checkApkVersion().then(async ({ isForcedUpdate, manifest }) => {
      if (cancelled) return;
      if (isForcedUpdate && manifest) {
        // Sign out the user so they cannot use an outdated APK
        await supabase.auth.signOut();
        setIsForcedApkUpdate(true);
        setApkManifest(manifest);
      }
      setIsCheckingApk(false);
    }).catch(() => {
      if (!cancelled) setIsCheckingApk(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { isForcedApkUpdate, apkManifest, isCheckingApk };
}

function OtaVersionCheckLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 gap-3">
      <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      <p className="text-sm font-medium text-green-800">Prüfe Version...</p>
    </div>
  );
}

function ForceApkUpdateScreen({ manifest }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0d1a0f] px-6 text-center">
      <div className="mb-8">
        <Leaf className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-stone-50 mb-2">Update erforderlich</h1>
        <p className="text-stone-400 text-sm leading-relaxed max-w-xs">
          Deine Version der Floralog-App ist veraltet. Bitte lade die neue Version herunter, um
          fortzufahren.
        </p>
        {manifest?.release_notes && (
          <p className="mt-3 text-xs text-amber-400/80 italic">
            {manifest.release_notes}
          </p>
        )}
      </div>

      <a
        href={manifest?.apk_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold px-6 py-3 rounded-2xl shadow-lg transition-colors"
      >
        <Download className="w-5 h-5" />
        Neue APK herunterladen
      </a>

      {manifest?.version_name && (
        <p className="mt-4 text-xs text-stone-600">
          Aktuelle Version: {manifest.version_name}
        </p>
      )}
    </div>
  );
}

export default function HomeOtaGate({ children }) {
  const { forceGuest, isCheckingOta } = useOtaGate();
  const { isForcedApkUpdate, apkManifest, isCheckingApk } = useApkForceUpdate();

  if (isCheckingOta || isCheckingApk) {
    return <OtaVersionCheckLoader />;
  }

  if (isForcedApkUpdate) {
    return <ForceApkUpdateScreen manifest={apkManifest} />;
  }

  if (forceGuest) {
    return <GuestHomeFlow />;
  }

  return children;
}

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { checkForUpdate, downloadAndApplyUpdate } from '@/lib/otaUpdateService';

/**
 * OtaUpdateManager
 *
 * Silently checks for an OTA web-bundle update on mount.
 * Renders a small banner when an update is available, letting the user
 * install it with one tap. The WebView reloads automatically after install.
 *
 * Place this component high in the tree (e.g. inside App), after auth is resolved.
 */
export default function OtaUpdateManager() {
  const [manifest, setManifest] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    checkForUpdate().then((m) => {
      if (m) setManifest(m);
    });
  }, []);

  if (!manifest && !downloading) return null;

  const handleInstall = async () => {
    setDownloading(true);
    setError(null);
    const result = await downloadAndApplyUpdate(manifest, setProgress);
    if (!result?.ok) {
      const detail = result?.error ? ` (${result.error})` : '';
      setError(`Installation fehlgeschlagen. Bitte versuche es spaeter erneut.${detail}`);
      setDownloading(false);
    }
    // On success the WebView reloads automatically – no state reset needed
  };

  const handleDismiss = () => setManifest(null);

  return (
    <div className="fixed bottom-24 left-3 right-3 z-50">
      <div className="bg-gray-900/95 border border-green-600/60 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
        {downloading ? (
          // Progress view
          <div>
            <p className="text-green-300 text-sm font-semibold mb-2">
              Update wird installiert… {progress}%
            </p>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : error ? (
          // Error view
          <div className="flex items-center justify-between gap-3">
            <p className="text-red-400 text-xs flex-1">{error}</p>
            <button
              onClick={handleDismiss}
              className="text-gray-400 text-xs underline shrink-0"
            >
              Schließen
            </button>
          </div>
        ) : (
          // Available view
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-snug">
                App-Update verfügbar
              </p>
              <p className="text-gray-400 text-xs truncate">
                Version {manifest?.version}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDismiss}
                className="text-gray-500 text-xs px-2 py-1"
              >
                Später
              </button>
              <button
                onClick={handleInstall}
                className="bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Installieren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

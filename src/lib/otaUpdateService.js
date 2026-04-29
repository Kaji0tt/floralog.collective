import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * OTA Update Service
 *
 * Checks a remote version manifest and downloads/applies new web bundles
 * without requiring a Play Store update.
 *
 * Configure the endpoint via the environment variable:
 *   VITE_OTA_VERSION_URL=https://floralog-ota.<account>.workers.dev/version.json
 */

const OtaUpdate = registerPlugin('OtaUpdate');

const OTA_VERSION_URL =
  import.meta.env.VITE_OTA_VERSION_URL || '';

// OTA Debug-Log-Funktion
function otaDebugLog(...args) {
  if (!window.OTA_DEBUG_LOGS) window.OTA_DEBUG_LOGS = [];
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  window.OTA_DEBUG_LOGS.push({ time: new Date().toLocaleTimeString(), msg });
  // Begrenze auf die letzten 100 Einträge
  if (window.OTA_DEBUG_LOGS.length > 100) window.OTA_DEBUG_LOGS = window.OTA_DEBUG_LOGS.slice(-100);
  // Zusätzlich in die Konsole
  console.log('[OTA][Debug]', ...args);
}

/**
 * Fetches the remote version manifest and compares it with the version
 * currently running on device.
 *
 * @returns {Promise<object|null>} manifest if an update is available, null otherwise
 */
export async function checkForUpdate() {
  otaDebugLog('checkForUpdate called');
  if (!Capacitor.isNativePlatform()) {
    otaDebugLog('Not running on native platform, OTA skipped');
    return null;
  }
  if (!OTA_VERSION_URL) {
    otaDebugLog('VITE_OTA_VERSION_URL is not configured');
    return null;
  }

  try {
    otaDebugLog(`Fetching manifest from: ${OTA_VERSION_URL}`);
    const response = await fetch(OTA_VERSION_URL, { cache: 'no-store' });
    otaDebugLog('Manifest fetch response:', { status: response.status, statusText: response.statusText });
    if (!response.ok) {
      otaDebugLog('Manifest fetch failed:', response.status, response.statusText);
      return null;
    }

    const manifest = await response.json();
    otaDebugLog('Manifest received:', manifest);
    if (!manifest?.version || !manifest?.bundleUrl) {
      otaDebugLog('Manifest missing version or bundleUrl');
      return null;
    }

    const { version: storedVersion } = await OtaUpdate.getStoredVersion();
    otaDebugLog(`Stored version: ${storedVersion}, Manifest version: ${manifest.version}`);
    if (storedVersion === manifest.version) {
      otaDebugLog('Already up to date');
      return null; // Already up to date
    }

    otaDebugLog(`Update available: "${storedVersion}" → "${manifest.version}"`);
    return manifest;
  } catch (err) {
    otaDebugLog('Version check failed:', err);
    return null;
  }
}

/**
 * Downloads and immediately applies the given bundle manifest.
 * The WebView reloads automatically when the native layer applies the new path.
 *
 * @param {object} manifest   – version manifest from checkForUpdate()
 * @param {function} onProgress – optional callback(percent: number)
 * @returns {Promise<boolean>}
 */
export async function downloadAndApplyUpdate(manifest, onProgress) {
  otaDebugLog('downloadAndApplyUpdate called', manifest);
  if (!Capacitor.isNativePlatform()) {
    otaDebugLog('Not running on native platform, download skipped');
    return false;
  }

  let progressListener = null;
  try {
    if (typeof onProgress === 'function') {
      progressListener = await OtaUpdate.addListener(
        'downloadProgress',
        ({ progress }) => {
          otaDebugLog(`Download progress: ${progress}%`);
          onProgress(progress);
        },
      );
    }

    otaDebugLog('Calling OtaUpdate.downloadAndApply', {
      bundleUrl: manifest.bundleUrl,
      version: manifest.version,
      sha256: manifest.sha256 || '',
    });
    const result = await OtaUpdate.downloadAndApply({
      bundleUrl: manifest.bundleUrl,
      version: manifest.version,
      sha256: manifest.sha256 || '',
    });
    otaDebugLog('downloadAndApply result:', result);
    return result?.success === true;
  } catch (err) {
    otaDebugLog('Download/apply failed:', err);
    return false;
  } finally {
    progressListener?.remove();
  }
}

/**
 * Resets the WebView to the app's built-in bundle (removes OTA override).
 */
export async function resetToBuiltinBundle() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await OtaUpdate.reset();
  } catch (err) {
    console.error('[OTA] Reset failed:', err);
  }
}

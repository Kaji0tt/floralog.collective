import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * OTA Update Service
 *
 * Checks a remote version manifest and downloads/applies new web bundles
 * without requiring a Play Store update.
 *
 * Configure the endpoint via either environment variable:
 *   VITE_OTA_VERSION_URL=https://floralog-ota.<account>.workers.dev/version.json
 *   VITE_OTA_MANIFEST_URL=https://floralog-ota.<account>.workers.dev/version.json
 */

const OtaUpdate = registerPlugin('OtaUpdate');

const DEFAULT_OTA_VERSION_URL = 'https://floralog-ota.green-term-27d0.workers.dev/version.json';

const OTA_VERSION_URL =
  import.meta.env.VITE_OTA_VERSION_URL ||
  import.meta.env.VITE_OTA_MANIFEST_URL ||
  DEFAULT_OTA_VERSION_URL;

const OTA_VERSION_URL_SOURCE = import.meta.env.VITE_OTA_VERSION_URL
  ? 'VITE_OTA_VERSION_URL'
  : import.meta.env.VITE_OTA_MANIFEST_URL
    ? 'VITE_OTA_MANIFEST_URL'
    : 'DEFAULT_OTA_VERSION_URL';

function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  const bundleUrl = manifest.bundleUrl || manifest.url || '';
  const sha256 = manifest.sha256 || manifest.hash || '';
  const version = manifest.version || '';
  if (!version || !bundleUrl) return null;
  return {
    ...manifest,
    version,
    bundleUrl,
    sha256,
  };
}

function serializeDebugValue(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeDebugValue(item, seen));
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = serializeDebugValue(val, seen);
  }
  return out;
}

function extractErrorMessage(err) {
  if (!err) return 'Unbekannter Fehler';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  const serialized = serializeDebugValue(err);
  try {
    return JSON.stringify(serialized);
  } catch {
    return String(err);
  }
}

// OTA Debug-Log-Funktion
function otaDebugLog(...args) {
  if (!window.OTA_DEBUG_LOGS) window.OTA_DEBUG_LOGS = [];
  const msg = args
    .map((arg) => {
      if (typeof arg !== 'object' || arg === null) return String(arg);
      try {
        return JSON.stringify(serializeDebugValue(arg));
      } catch {
        return String(arg);
      }
    })
    .join(' ');
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
  otaDebugLog(`Using OTA URL from: ${OTA_VERSION_URL_SOURCE}`);

  try {
    otaDebugLog(`Fetching manifest from: ${OTA_VERSION_URL}`);
    const response = await fetch(OTA_VERSION_URL, { cache: 'no-store' });
    otaDebugLog('Manifest fetch response:', { status: response.status, statusText: response.statusText });
    if (!response.ok) {
      otaDebugLog('Manifest fetch failed:', response.status, response.statusText);
      return null;
    }

    const rawManifest = await response.json();
    otaDebugLog('Manifest received:', rawManifest);

    const manifest = normalizeManifest(rawManifest);
    if (!manifest) {
      otaDebugLog('Manifest missing required fields (version + bundleUrl/url)');
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
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function downloadAndApplyUpdate(manifest, onProgress) {
  const normalizedManifest = normalizeManifest(manifest);
  otaDebugLog('downloadAndApplyUpdate called', normalizedManifest || manifest);
  if (!Capacitor.isNativePlatform()) {
    otaDebugLog('Not running on native platform, download skipped');
    return { ok: false, error: 'Nicht auf nativer Plattform' };
  }

  if (!normalizedManifest) {
    otaDebugLog('Cannot download: invalid manifest payload');
    return { ok: false, error: 'Ungultiges OTA-Manifest' };
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
      bundleUrl: normalizedManifest.bundleUrl,
      version: normalizedManifest.version,
      sha256: normalizedManifest.sha256 || '',
    });
    const result = await OtaUpdate.downloadAndApply({
      bundleUrl: normalizedManifest.bundleUrl,
      version: normalizedManifest.version,
      sha256: normalizedManifest.sha256 || '',
    });
    otaDebugLog('downloadAndApply result:', result);
    return { ok: result?.success === true };
  } catch (err) {
    const message = extractErrorMessage(err);
    otaDebugLog('Download/apply failed:', { message, raw: err });
    return { ok: false, error: message };
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

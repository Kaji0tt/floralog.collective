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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the remote version manifest and compares it with the version
 * currently running on device.
 *
 * @returns {Promise<object|null>} manifest if an update is available, null otherwise
 */
export async function checkForUpdate() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!OTA_VERSION_URL) {
    console.warn('[OTA] VITE_OTA_VERSION_URL is not configured');
    return null;
  }

  try {
    const response = await fetch(OTA_VERSION_URL, { cache: 'no-store' });
    if (!response.ok) return null;

    const manifest = await response.json();
    if (!manifest?.version || !manifest?.bundleUrl) return null;

    const { version: storedVersion } = await OtaUpdate.getStoredVersion();
    if (storedVersion === manifest.version) {
      return null; // Already up to date
    }

    console.info(`[OTA] Update available: "${storedVersion}" → "${manifest.version}"`);
    return manifest;
  } catch (err) {
    console.warn('[OTA] Version check failed:', err);
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
  if (!Capacitor.isNativePlatform()) return false;

  let progressListener = null;
  try {
    if (typeof onProgress === 'function') {
      progressListener = await OtaUpdate.addListener(
        'downloadProgress',
        ({ progress }) => onProgress(progress),
      );
    }

    const result = await OtaUpdate.downloadAndApply({
      bundleUrl: manifest.bundleUrl,
      version: manifest.version,
      sha256: manifest.sha256 || '',
    });

    return result?.success === true;
  } catch (err) {
    console.error('[OTA] Download/apply failed:', err);
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

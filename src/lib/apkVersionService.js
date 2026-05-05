import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const DEFAULT_OTA_BASE_URL = 'https://floralog-ota.green-term-27d0.workers.dev';

const OTA_BASE_URL =
  (import.meta.env.VITE_OTA_VERSION_URL || import.meta.env.VITE_OTA_MANIFEST_URL || DEFAULT_OTA_BASE_URL + '/version.json')
    .replace(/\/version\.json$/, '');

const APK_MANIFEST_URL = OTA_BASE_URL + '/apk-version.json';

/**
 * Returns the current APK versionCode from the native runtime.
 * Returns null when not running on a native Android platform.
 *
 * @returns {Promise<number|null>}
 */
export async function getNativeVersionCode() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const info = await App.getInfo();
    // Capacitor returns build as a string, e.g. "2"
    const code = parseInt(info.build, 10);
    return isNaN(code) ? null : code;
  } catch {
    return null;
  }
}

/**
 * Fetches the APK version manifest from the OTA worker.
 * Shape:
 * {
 *   version_code: number,       // e.g. 2
 *   version_name: string,       // e.g. "1.1"
 *   minimum_version_code: number,
 *   apk_url: string,            // direct R2 / CDN download link
 *   release_notes: string,
 * }
 *
 * @returns {Promise<object|null>}
 */
export async function fetchApkManifest() {
  try {
    const res = await fetch(APK_MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.version_code || !data.apk_url) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Checks whether the currently installed APK is outdated.
 *
 * @returns {Promise<{
 *   isOutdated: boolean,
 *   isForcedUpdate: boolean,
 *   manifest: object|null,
 *   currentVersionCode: number|null,
 * }>}
 */
export async function checkApkVersion() {
  const currentVersionCode = await getNativeVersionCode();

  if (currentVersionCode === null) {
    // Not running natively – no APK check needed
    return { isOutdated: false, isForcedUpdate: false, manifest: null, currentVersionCode: null };
  }

  const manifest = await fetchApkManifest();
  if (!manifest) {
    return { isOutdated: false, isForcedUpdate: false, manifest: null, currentVersionCode };
  }

  const latestVersionCode = manifest.version_code;
  const minimumVersionCode = manifest.minimum_version_code ?? latestVersionCode;

  const isOutdated = currentVersionCode < latestVersionCode;
  const isForcedUpdate = currentVersionCode < minimumVersionCode;

  return { isOutdated, isForcedUpdate, manifest, currentVersionCode };
}

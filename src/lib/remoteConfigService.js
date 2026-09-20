/**
 * Remote Config Service
 *
 * Reuses the existing OTA version manifest (served by the Cloudflare worker,
 * independent of auth) to carry a few extra remote-controlled flags, e.g.
 * disabling login during backend maintenance. Toggling these flags does not
 * require an app/OTA release — see scripts/set-login-maintenance.mjs.
 *
 * Manifest shape (extra optional fields, all others unchanged):
 *   {
 *     ...,
 *     "loginDisabled": true,
 *     "loginDisabledMessage": "Custom maintenance text (optional)"
 *   }
 */

const DEFAULT_OTA_VERSION_URL = 'https://floralog-ota.green-term-27d0.workers.dev/version.json';

const OTA_VERSION_URL =
  import.meta.env.VITE_OTA_VERSION_URL ||
  import.meta.env.VITE_OTA_MANIFEST_URL ||
  DEFAULT_OTA_VERSION_URL;

/**
 * Fetches the remote config flags. Works on web and native, fails safe
 * (login enabled) when the manifest is unreachable or malformed.
 *
 * @returns {Promise<{ loginDisabled: boolean, loginDisabledMessage: string|null }>}
 */
export async function fetchRemoteConfig() {
  try {
    const res = await fetch(OTA_VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return { loginDisabled: false, loginDisabledMessage: null };

    const manifest = await res.json();
    return {
      loginDisabled: manifest?.loginDisabled === true,
      loginDisabledMessage: typeof manifest?.loginDisabledMessage === 'string'
        ? manifest.loginDisabledMessage
        : null,
    };
  } catch {
    return { loginDisabled: false, loginDisabledMessage: null };
  }
}

#!/usr/bin/env node
/**
 * set-login-maintenance.mjs
 *
 * Toggles the `loginDisabled` flag in the OTA version manifest so the app
 * can show a maintenance notice and block login, without shipping a new
 * release or OTA bundle. The flag is read by src/lib/remoteConfigService.js
 * on every app start (web + native), independent of authentication.
 *
 * Usage:
 *   node scripts/set-login-maintenance.mjs on  ["Custom message shown to users"]
 *   node scripts/set-login-maintenance.mjs off
 *
 * Required env variables (or .env file):
 *   OTA_WORKER_URL     e.g. https://floralog-ota.green-term-27d0.workers.dev
 *   DEPLOY_SECRET or OTA_DEPLOY_SECRET (legacy) – worker deploy secret
 */

import { readFileSync, existsSync } from 'fs';

// ── Minimal .env loader ────────────────────────────────────────────────────
for (const envFile of ['.env', '.env.local']) {
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const [, , mode, customMessage] = process.argv;

if (mode !== 'on' && mode !== 'off') {
  console.error('Usage: node scripts/set-login-maintenance.mjs <on|off> ["custom message"]');
  process.exit(1);
}

const OTA_WORKER_URL = process.env.OTA_WORKER_URL || 'https://floralog-ota.green-term-27d0.workers.dev';
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || process.env.OTA_DEPLOY_SECRET || process.env.OTA_SECRET;

if (!DEPLOY_SECRET) {
  console.error('Missing required env: one of DEPLOY_SECRET / OTA_DEPLOY_SECRET / OTA_SECRET must be set.');
  process.exit(1);
}

(async () => {
  // PUT /version.json replaces the whole manifest, so fetch the current one first.
  const currentRes = await fetch(`${OTA_WORKER_URL}/version.json`, { cache: 'no-store' });
  if (!currentRes.ok) {
    console.error(`Failed to fetch current manifest (${currentRes.status}). Aborting.`);
    process.exit(1);
  }
  const manifest = await currentRes.json();

  manifest.loginDisabled = mode === 'on';
  if (mode === 'on' && customMessage) {
    manifest.loginDisabledMessage = customMessage;
  } else if (mode === 'off') {
    delete manifest.loginDisabledMessage;
  }

  const putRes = await fetch(`${OTA_WORKER_URL}/version.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify(manifest),
  });

  if (!putRes.ok) {
    const text = await putRes.text();
    console.error(`Manifest update failed (${putRes.status}): ${text}`);
    process.exit(1);
  }

  console.log(`✅ loginDisabled set to ${manifest.loginDisabled}${manifest.loginDisabledMessage ? ` with message: "${manifest.loginDisabledMessage}"` : ''}`);
})();

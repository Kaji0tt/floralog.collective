#!/usr/bin/env node
/**
 * publish-apk.mjs
 *
 * Uploads a new APK to the Cloudflare R2 bucket via the OTA worker and
 * updates the APK version manifest so connected apps can discover the update.
 *
 * Usage:
 *   node scripts/publish-apk.mjs \
 *     --apk path/to/floralog-v1.2.apk \
 *     --version-code 2 \
 *     --version-name "1.2" \
 *     [--min-version-code 1]  \
 *     [--notes "Bug fixes and improvements"]
 *
 * Required env variables (or .env file):
 *   OTA_WORKER_URL     e.g. https://floralog-ota.green-term-27d0.workers.dev
 *   DEPLOY_SECRET or OTA_DEPLOY_SECRET (legacy) – worker deploy secret
 *   R2_ACCOUNT_ID      Cloudflare account ID (for direct R2 upload via API)
 *   R2_ACCESS_KEY_ID   R2 access key ID
 *   R2_SECRET_ACCESS_KEY  R2 secret access key
 *   R2_BUCKET_NAME     name of the R2 bucket (e.g. floralog-ota)
 *
 * The script:
 *   1. Uploads the APK to R2 at path  apk/<filename>
 *   2. Calls PUT /apk-version.json on the OTA worker to update the manifest
 */

import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { parseArgs } from 'util';

// ── Minimal .env loader ────────────────────────────────────────────────────
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Parse CLI args ─────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    apk:              { type: 'string' },
    'version-code':   { type: 'string' },
    'version-name':   { type: 'string' },
    'min-version-code': { type: 'string' },
    notes:            { type: 'string' },
  },
});

const apkPath        = values['apk'];
const versionCode    = parseInt(values['version-code'] ?? '', 10);
const versionName    = values['version-name'];
const minVersionCode = parseInt(values['min-version-code'] ?? String(versionCode), 10);
const releaseNotes   = values['notes'] ?? '';

if (!apkPath || !versionCode || !versionName) {
  console.error('Usage: node scripts/publish-apk.mjs --apk <path> --version-code <int> --version-name <str> [--min-version-code <int>] [--notes <str>]');
  process.exit(1);
}

if (!existsSync(apkPath)) {
  console.error(`APK file not found: ${apkPath}`);
  process.exit(1);
}

const OTA_WORKER_URL     = process.env.OTA_WORKER_URL;
const DEPLOY_SECRET      = process.env.DEPLOY_SECRET || process.env.OTA_DEPLOY_SECRET || process.env.OTA_SECRET;
const R2_ACCOUNT_ID      = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID   = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY      = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME     = process.env.R2_BUCKET_NAME ?? 'floralog-ota';

if (!OTA_WORKER_URL || !DEPLOY_SECRET) {
  console.error('Missing required env: OTA_WORKER_URL and one of DEPLOY_SECRET / OTA_DEPLOY_SECRET / OTA_SECRET must be set.');
  process.exit(1);
}

const apkFilename = basename(apkPath);
const apkData = readFileSync(apkPath);

// ── Upload APK to R2 via S3-compatible API ─────────────────────────────────
async function uploadToR2() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_KEY) {
    console.warn('[publish-apk] R2 credentials not set – skipping direct R2 upload.');
    console.warn('[publish-apk] Please upload the APK manually to your R2 bucket at: apk/' + apkFilename);
    return null;
  }

  // Dynamically import aws4fetch for S3-compatible signing
  let aws4fetch;
  try {
    aws4fetch = await import('aws4fetch');
  } catch {
    console.warn('[publish-apk] aws4fetch not installed – skipping R2 upload. Run: npm install aws4fetch');
    return null;
  }

  const { AwsClient } = aws4fetch;
  const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const r2Key = `apk/${apkFilename}`;
  const url = `${r2Endpoint}/${R2_BUCKET_NAME}/${r2Key}`;

  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_KEY,
    service: 's3',
    region: 'auto',
  });

  console.log(`[publish-apk] Uploading APK to R2: ${url}`);
  const res = await client.fetch(url, {
    method: 'PUT',
    body: apkData,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(apkData.byteLength),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }

  console.log('[publish-apk] APK uploaded to R2 successfully.');
  // The public URL is served through the OTA worker
  return `${OTA_WORKER_URL}/apk/${apkFilename}`;
}

// ── Update APK version manifest ────────────────────────────────────────────
async function updateManifest(apkUrl) {
  const body = {
    version_code: versionCode,
    version_name: versionName,
    minimum_version_code: minVersionCode,
    apk_url: apkUrl,
    release_notes: releaseNotes,
    published_at: new Date().toISOString(),
  };

  console.log(`[publish-apk] Updating APK manifest at ${OTA_WORKER_URL}/apk-version.json`);
  console.log('[publish-apk] Manifest payload:', body);

  const res = await fetch(`${OTA_WORKER_URL}/apk-version.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Manifest update failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  console.log('[publish-apk] Manifest updated:', json);
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    const apkPublicUrl = await uploadToR2()
      ?? `${OTA_WORKER_URL}/apk/${apkFilename}`;

    await updateManifest(apkPublicUrl);

    console.log('\n✅ APK published successfully!');
    console.log(`   Version:  ${versionName} (code ${versionCode})`);
    console.log(`   Min code: ${minVersionCode}`);
    console.log(`   URL:      ${apkPublicUrl}`);
  } catch (err) {
    console.error('[publish-apk] Error:', err.message);
    process.exit(1);
  }
})();

/**
 * FloraLog OTA Update Worker
 *
 * Endpoints:
 *   GET /version.json        – returns the current version manifest from KV
 *   GET /bundle/:filename    – proxies bundle ZIP from R2
 *   GET /apk-version.json    – returns the current APK manifest from KV
 *   PUT /version.json        – (authenticated) updates the version manifest in KV
 *   PUT /apk-version.json    – (authenticated) updates the APK manifest in KV
 *   POST /sync-apk-manifest  – (authenticated) scans R2/apk and updates APK manifest
 *
 * Scheduled task:
 *   cron trigger periodically runs the same APK sync from R2 filenames
 *
 * Environment bindings required:
 *   OTA_KV      – KV namespace
 *   OTA_BUCKET  – R2 bucket
 *   DEPLOY_SECRET or OTA_DEPLOY_SECRET (legacy) – secret for authenticated PUT
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Deploy-Secret',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const deploySecret = env.DEPLOY_SECRET || env.OTA_DEPLOY_SECRET || env.OTA_SECRET;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── GET /version.json ──────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/version.json') {
      const manifest = await env.OTA_KV.get('version_manifest', 'json');
      if (!manifest) {
        return jsonResponse({ error: 'No version available' }, 404);
      }
      return jsonResponse(manifest, 200, { 'Cache-Control': 'no-store' });
    }

    // ── GET /bundle/:filename ──────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname.startsWith('/bundle/')) {
      const filename = url.pathname.slice('/bundle/'.length);
      if (!filename || filename.includes('..')) {
        return new Response('Bad request', { status: 400, headers: CORS_HEADERS });
      }

      const object = await env.OTA_BUCKET.get(filename);
      if (!object) {
        return new Response('Bundle not found', { status: 404, headers: CORS_HEADERS });
      }

      return new Response(object.body, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/zip',
          'Content-Length': String(object.size),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // ── GET /apk-version.json ─────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/apk-version.json') {
      const manifest = await env.OTA_KV.get('apk_version_manifest', 'json');
      if (!manifest) {
        return jsonResponse({ error: 'No APK version available' }, 404);
      }
      return jsonResponse(manifest, 200, { 'Cache-Control': 'no-store' });
    }

    // ── GET /apk/:filename – serves APK from R2 ────────────────────────────
    if (request.method === 'GET' && url.pathname.startsWith('/apk/')) {
      const filename = url.pathname.slice('/apk/'.length);
      if (!filename || filename.includes('..')) {
        return new Response('Bad request', { status: 400, headers: CORS_HEADERS });
      }

      const object = await env.OTA_BUCKET.get('apk/' + filename);
      if (!object) {
        return new Response('APK not found', { status: 404, headers: CORS_HEADERS });
      }

      return new Response(object.body, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': String(object.size),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // ── PUT /apk-version.json (authenticated deploy hook) ─────────────────
    if (request.method === 'PUT' && url.pathname === '/apk-version.json') {
      const secret = request.headers.get('X-Deploy-Secret');
      if (!deploySecret || !secret || secret !== deploySecret) {
        return new Response('Unauthorized', { status: 401 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }

      const required = ['version_code', 'version_name', 'apk_url', 'release_notes'];
      for (const field of required) {
        if (body[field] === undefined) {
          return new Response(`Missing field: ${field}`, { status: 400 });
        }
      }

      // minimum_version_code is optional – defaults to version_code if not set
      if (!body.minimum_version_code) {
        body.minimum_version_code = body.version_code;
      }

      await env.OTA_KV.put('apk_version_manifest', JSON.stringify(body));
      return jsonResponse({ ok: true, version_code: body.version_code }, 200);
    }

    // ── PUT /version.json (authenticated deploy hook) ─────────────────────
    if (request.method === 'PUT' && url.pathname === '/version.json') {
      const secret = request.headers.get('X-Deploy-Secret');
      if (!deploySecret || !secret || secret !== deploySecret) {
        return new Response('Unauthorized', { status: 401 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }

      const required = ['version', 'bundleUrl', 'sha256', 'buildTime'];
      for (const field of required) {
        if (!body[field]) {
          return new Response(`Missing field: ${field}`, { status: 400 });
        }
      }

      await env.OTA_KV.put('version_manifest', JSON.stringify(body));
      return jsonResponse({ ok: true, version: body.version }, 200);
    }

    // ── POST /sync-apk-manifest (authenticated) ───────────────────────────
    if (request.method === 'POST' && url.pathname === '/sync-apk-manifest') {
      const secret = request.headers.get('X-Deploy-Secret');
      if (!deploySecret || !secret || secret !== deploySecret) {
        return new Response('Unauthorized', { status: 401 });
      }

      const syncResult = await syncApkManifestFromR2(env);
      if (!syncResult.ok) {
        return jsonResponse(syncResult, 400);
      }

      return jsonResponse(syncResult, 200);
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },

  async scheduled(_event, env, _ctx) {
    // Best-effort periodic sync so uploading a new APK is enough.
    await syncApkManifestFromR2(env);
  },
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function parseApkFilename(filename) {
  // Naming convention: <prefix>-v<version_name>-code<version_code>.apk
  // Example: floralog-v1.5.0-code42.apk
  const match = filename.match(/-v([0-9]+(?:\.[0-9]+)*)-code([0-9]+)\.apk$/i);
  if (!match) return null;

  const versionName = match[1];
  const versionCode = Number.parseInt(match[2], 10);
  if (!Number.isFinite(versionCode)) return null;

  return {
    version_name: versionName,
    version_code: versionCode,
  };
}

async function syncApkManifestFromR2(env) {
  let cursor = undefined;
  let bestCandidate = null;
  let scanned = 0;

  do {
    const listed = await env.OTA_BUCKET.list({
      prefix: 'apk/',
      limit: 100,
      cursor,
    });

    for (const obj of listed.objects) {
      scanned += 1;
      const key = obj.key;
      const filename = key.replace(/^apk\//, '');
      const parsed = parseApkFilename(filename);
      if (!parsed) continue;

      if (!bestCandidate || parsed.version_code > bestCandidate.version_code) {
        bestCandidate = {
          key,
          ...parsed,
          uploaded: obj.uploaded,
        };
        continue;
      }

      if (
        parsed.version_code === bestCandidate.version_code
        && obj.uploaded
        && bestCandidate.uploaded
        && new Date(obj.uploaded).getTime() > new Date(bestCandidate.uploaded).getTime()
      ) {
        bestCandidate = {
          key,
          ...parsed,
          uploaded: obj.uploaded,
        };
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (!bestCandidate) {
    return {
      ok: false,
      error: 'No APK found with expected naming convention: <name>-v<version>-code<code>.apk',
      scanned,
    };
  }

  const filename = bestCandidate.key.replace(/^apk\//, '');
  const workerUrl = 'https://floralog-ota.green-term-27d0.workers.dev';

  const manifest = {
    version_code: bestCandidate.version_code,
    version_name: bestCandidate.version_name,
    minimum_version_code: bestCandidate.version_code,
    apk_url: `${workerUrl}/apk/${filename}`,
    release_notes: `Auto-published from ${filename}`,
    published_at: new Date().toISOString(),
    source_key: bestCandidate.key,
  };

  await env.OTA_KV.put('apk_version_manifest', JSON.stringify(manifest));

  return {
    ok: true,
    scanned,
    updated: manifest,
  };
}

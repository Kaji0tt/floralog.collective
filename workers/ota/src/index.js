/**
 * FloraLog OTA Update Worker
 *
 * Endpoints:
 *   GET /version.json        – returns the current version manifest from KV
 *   GET /bundle/:filename    – proxies bundle ZIP from R2
 *   PUT /version.json        – (authenticated) updates the version manifest in KV
 *
 * Environment bindings required:
 *   OTA_KV      – KV namespace
 *   OTA_BUCKET  – R2 bucket
 *   DEPLOY_SECRET – secret string for authenticated PUT (set as Worker secret)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Deploy-Secret',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    // ── PUT /version.json (authenticated deploy hook) ─────────────────────
    if (request.method === 'PUT' && url.pathname === '/version.json') {
      const secret = request.headers.get('X-Deploy-Secret');
      if (!secret || secret !== env.DEPLOY_SECRET) {
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

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Worker-Secret",
};

const DEFAULT_UNLOCKED_IDS = new Set([
  "border_original",
  "plant_leaf",
  "plant_legacy",
  "face_original",
]);

const parseAssetType = (assetId) => {
  if (assetId.startsWith("face_")) return "face";
  if (assetId.startsWith("plant_")) return "plant";
  if (assetId.startsWith("border_")) return "border";
  return null;
};

const toDisplayName = (assetId) => {
  const [, ...parts] = assetId.split("_");
  if (!parts.length) return assetId;
  return parts
    .join(" ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildPublicAssetUrl = (requestUrl, env, key) => {
  const configuredBase = env.ASSET_PUBLIC_BASE_URL;
  if (configuredBase) {
    const base = configuredBase.replace(/\/$/, "");
    return `${base}/asset/${key}`;
  }

  const origin = new URL(requestUrl).origin;
  return `${origin}/asset/${key}`;
};

const ACTIVE_PREFIX = "custom_logo/";
const LEGACY_PREFIX = "custom_logo/legacy/";

const buildCatalog = async (requestUrl, env) => {
  const assets = [];
  let cursor = undefined;

  do {
    const listed = await env.ASSET_BUCKET.list({
      prefix: ACTIVE_PREFIX,
      limit: 100,
      cursor,
    });

    for (const object of listed.objects) {
      const key = object.key;
      if (!key.toLowerCase().endsWith(".png")) continue;

      const fileName = key.split("/").pop();
      if (!fileName) continue;

      const assetId = fileName.replace(/\.png$/i, "");
      const assetType = parseAssetType(assetId);
      if (!assetType) continue;

      const isLegacy = key.startsWith(LEGACY_PREFIX);

      assets.push({
        asset_id: assetId,
        asset_type: assetType,
        file_name: fileName,
        r2_key: key,
        public_url: buildPublicAssetUrl(requestUrl, env, key),
        display_name: toDisplayName(assetId),
        default_unlocked: DEFAULT_UNLOCKED_IDS.has(assetId),
        active: true,
        legacy: isLegacy,
      });
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  assets.sort((left, right) => {
    if (left.asset_type !== right.asset_type) {
      return left.asset_type.localeCompare(right.asset_type);
    }
    return left.asset_id.localeCompare(right.asset_id);
  });

  return {
    source: "r2",
    generated_at: new Date().toISOString(),
    count: assets.length,
    assets,
  };
};

const jsonResponse = (payload, status = 200, extraHeaders = {}) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
};

const triggerLogoAssetSync = async (env, reason = "manual") => {
  const endpoint = String(env.LOGO_ASSET_SYNC_ENDPOINT || "").trim();
  const syncSecret = String(env.LOGO_ASSET_SYNC_SECRET || "").trim();

  if (!endpoint) {
    return {
      ok: false,
      reason,
      status: 0,
      error: "LOGO_ASSET_SYNC_ENDPOINT missing",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(syncSecret ? { "x-sync-secret": syncSecret } : {}),
      },
      body: JSON.stringify({ source: "assets-catalog-worker", reason }),
    });

    const data = await response.json().catch(() => null);
    return {
      ok: response.ok,
      reason,
      status: response.status,
      data,
      error: response.ok ? null : `syncLogoAssets failed (${response.status})`,
    };
  } catch (error) {
    return {
      ok: false,
      reason,
      status: 0,
      error: error?.message || String(error),
    };
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/logo-assets/catalog") {
      const catalog = await buildCatalog(request.url, env);
      return jsonResponse(catalog, 200, { "Cache-Control": "no-store" });
    }

    if (request.method === "POST" && url.pathname === "/logo-assets/sync") {
      const workerSecret = String(env.WORKER_TRIGGER_SECRET || "").trim();
      if (workerSecret) {
        const providedSecret = request.headers.get("X-Worker-Secret");
        if (providedSecret !== workerSecret) {
          return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
        }
      }

      const result = await triggerLogoAssetSync(env, "manual-endpoint");
      return jsonResponse(result, result.ok ? 200 : 502, { "Cache-Control": "no-store" });
    }

    if (request.method === "GET" && url.pathname.startsWith("/asset/")) {
      const key = decodeURIComponent(url.pathname.slice("/asset/".length));
      if (!key || key.includes("..") || !key.startsWith("custom_logo/")) {
        return new Response("Bad request", { status: 400, headers: CORS_HEADERS });
      }

      const object = await env.ASSET_BUCKET.get(key);
      if (!object) {
        return new Response("Not found", { status: 404, headers: CORS_HEADERS });
      }

      return new Response(object.body, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "image/png",
          "Content-Length": String(object.size),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(triggerLogoAssetSync(env, "cron"));
  },
};

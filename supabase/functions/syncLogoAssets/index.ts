import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CatalogAsset = {
  asset_id: string;
  asset_type: "face" | "plant" | "border" | string;
  file_name: string;
  r2_key: string;
  public_url: string;
  display_name?: string | null;
  active?: boolean;
  default_unlocked?: boolean;
};

type CatalogResponse = {
  assets?: CatalogAsset[];
};

const DEFAULT_UNLOCKED_IDS = new Set(["border_original", "plant_leaf", "plant_legacy", "face_original"]);
const VALID_TYPES = new Set(["face", "plant", "border"]);

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  return fallback;
};

const normalizeAsset = (asset: CatalogAsset) => {
  const assetId = String(asset.asset_id || "").trim();
  const assetType = String(asset.asset_type || "").trim();
  const r2Key = String(asset.r2_key || "").trim();
  const publicUrl = String(asset.public_url || "").trim();
  const fileName = String(asset.file_name || "").trim();

  if (!assetId || !VALID_TYPES.has(assetType) || !r2Key || !publicUrl || !fileName) {
    return null;
  }

  return {
    asset_id: assetId,
    asset_type: assetType,
    file_name: fileName,
    r2_key: r2Key,
    public_url: publicUrl,
    display_name: (asset.display_name || assetId).trim(),
    active: asBoolean(asset.active, true),
    default_unlocked: asBoolean(asset.default_unlocked, DEFAULT_UNLOCKED_IDS.has(assetId)),
    source: "r2",
    updated_at: new Date().toISOString(),
  };
};

const getAccessTokenFromAuthHeader = (header: string | null): string | null => {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "syncLogoAssets");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const catalogUrl = Deno.env.get("LOGO_ASSET_CATALOG_URL");
    const syncSecret = Deno.env.get("LOGO_ASSET_SYNC_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !catalogUrl) {
      return new Response(JSON.stringify({ error: "Missing required environment variables" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (syncSecret) {
      const providedSecret = req.headers.get("x-sync-secret");
      if (!providedSecret || providedSecret !== syncSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      const accessToken = getAccessTokenFromAuthHeader(authHeader);
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const authClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      const { data: userData, error: authError } = await authClient.auth.getUser(accessToken);
      if (authError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const catalogResponse = await fetch(catalogUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!catalogResponse.ok) {
      return new Response(JSON.stringify({ error: `Catalog fetch failed (${catalogResponse.status})` }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const catalog = (await catalogResponse.json()) as CatalogResponse;
    const assets = Array.isArray(catalog?.assets) ? catalog.assets : [];

    const normalized = assets
      .map((asset) => normalizeAsset(asset))
      .filter((asset): asset is NonNullable<ReturnType<typeof normalizeAsset>> => Boolean(asset));

    const seen = new Set<string>();
    const deduped = normalized.filter((asset) => {
      if (seen.has(asset.asset_id)) return false;
      seen.add(asset.asset_id);
      return true;
    });

    if (deduped.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No valid assets found", synced: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: upsertError } = await adminClient
      .from("LogoAsset")
      .upsert(deduped, { onConflict: "asset_id" });

    if (upsertError) {
      throw upsertError;
    }

    const syncedIds = new Set(deduped.map((asset) => asset.asset_id));
    const { data: existingR2Assets, error: existingError } = await adminClient
      .from("LogoAsset")
      .select("asset_id")
      .eq("source", "r2");

    if (existingError) {
      throw existingError;
    }

    const idsToDeactivate = (existingR2Assets || [])
      .map((entry) => String(entry.asset_id || "").trim())
      .filter((assetId) => assetId && !syncedIds.has(assetId));

    if (idsToDeactivate.length > 0) {
      const { error: deactivateError } = await adminClient
        .from("LogoAsset")
        .update({ active: false, updated_at: new Date().toISOString() })
        .in("asset_id", idsToDeactivate);

      if (deactivateError) {
        throw deactivateError;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced: deduped.length,
        defaults_unlocked: Array.from(DEFAULT_UNLOCKED_IDS),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("[syncLogoAssets] error", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProfileCatalogAsset = {
  asset_id: string;
  category: string;
  file_name: string;
  r2_key: string;
  public_url: string;
  display_name?: string | null;
  active?: boolean;
};

type CatalogResponse = {
  assets?: ProfileCatalogAsset[];
};

const DEFAULT_SPARK_PRICE = 15;

const buildBackgroundRewardRow = (asset: ProfileCatalogAsset, publicUrl: string) => {
  return {
    id: `reward_profile_bg_${asset.asset_id}`,
    name: `profile_bg_${asset.asset_id}`,
    display_name: asset.display_name || asset.asset_id,
    type: "background",
    value: publicUrl,
    image_url: publicUrl,
    spark_price: DEFAULT_SPARK_PRICE,
    amber_price: null,
  };
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "syncProfileAssets");
  if (originDeniedResponse) return originDeniedResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // Fall back to deriving profile catalog URL from the logo catalog URL
    const catalogUrl =
      Deno.env.get("PROFILE_ASSET_CATALOG_URL") ||
      (Deno.env.get("LOGO_ASSET_CATALOG_URL") || "").replace(/\/logo-assets\/catalog$/, "/profile/catalog") ||
      "";
    const syncSecret =
      Deno.env.get("PROFILE_ASSET_SYNC_SECRET") || Deno.env.get("LOGO_ASSET_SYNC_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !catalogUrl) {
      return jsonResponse({ error: "Missing required environment variables" }, 500);
    }

    // Auth: accept sync secret from worker or bearer token from admin
    if (syncSecret) {
      const providedSecret = req.headers.get("x-sync-secret");
      if (!providedSecret || providedSecret !== syncSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      if (!accessToken) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const authClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      const { error: authError } = await authClient.auth.getUser(accessToken);
      if (authError) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch profile catalog from worker
    const catalogResponse = await fetch(catalogUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!catalogResponse.ok) {
      return jsonResponse({ error: `Catalog fetch failed (${catalogResponse.status})` }, 502);
    }

    const catalog = (await catalogResponse.json()) as CatalogResponse;
    const assets = Array.isArray(catalog?.assets) ? catalog.assets : [];

    // Filter to backgrounds category only
    const backgroundAssets = assets.filter(
      (asset) => asset.category === "backgrounds" && asset.public_url && asset.asset_id,
    );

    if (backgroundAssets.length === 0) {
      return jsonResponse({ ok: true, message: "No background assets found", synced: 0 });
    }

    // Check which rewards already exist
    const { data: existingRewards, error: existingError } = await adminClient
      .from("Rewards")
      .select("id, value")
      .eq("type", "background");

    if (existingError) throw existingError;

    const existingRewardIds = new Set(
      (existingRewards || []).map((r) => String(r.id || "")).filter(Boolean),
    );
    const existingRewardUrls = new Set(
      (existingRewards || []).map((r) => String(r.value || "").trim()).filter(Boolean),
    );

    // Build reward rows for new backgrounds
    const rewardsToCreate = backgroundAssets
      .map((asset) => buildBackgroundRewardRow(asset, asset.public_url))
      .filter((reward) => {
        // Skip if reward ID or URL already exists
        if (existingRewardIds.has(reward.id)) return false;
        if (existingRewardUrls.has(reward.value)) return false;
        return true;
      });

    let rewardsSynced = 0;

    if (rewardsToCreate.length > 0) {
      const { error: upsertError } = await adminClient
        .from("Rewards")
        .upsert(rewardsToCreate, { onConflict: "id" });

      if (upsertError) throw upsertError;
      rewardsSynced = rewardsToCreate.length;
    }

    // Unhide all currently active profile background rewards
    const activeRewardIds = backgroundAssets.map((asset) => `reward_profile_bg_${asset.asset_id}`);
    if (activeRewardIds.length > 0) {
      const { error: unhideError } = await adminClient
        .from("Rewards")
        .update({ shop_hidden: false })
        .in("id", activeRewardIds);

      if (unhideError) {
        console.warn("[syncProfileAssets] Failed to unhide active rewards:", unhideError);
      }
    }

    // Hide rewards for backgrounds no longer in R2
    const { data: allProfileBgRewards, error: allBgError } = await adminClient
      .from("Rewards")
      .select("id")
      .eq("type", "background")
      .like("id", "reward_profile_bg_%");

    if (!allBgError && allProfileBgRewards) {
      const activeSet = new Set(activeRewardIds);
      const rewardsToHide = allProfileBgRewards
        .map((r) => String(r.id))
        .filter((id) => !activeSet.has(id));

      if (rewardsToHide.length > 0) {
        const { error: hideError } = await adminClient
          .from("Rewards")
          .update({ shop_hidden: true })
          .in("id", rewardsToHide);

        if (hideError) {
          console.warn("[syncProfileAssets] Failed to hide removed rewards:", hideError);
        }
      }
    }

    return jsonResponse({
      ok: true,
      synced: rewardsSynced,
      total_backgrounds: backgroundAssets.length,
      already_existing: backgroundAssets.length - rewardsSynced,
    });
  } catch (error) {
    console.error("[syncProfileAssets] error", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

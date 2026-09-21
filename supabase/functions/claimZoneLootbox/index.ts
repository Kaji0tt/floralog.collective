import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  poolId?: string | null;
  zoneTheme?: string | null;
  zoneId?: string | null;
  claimKey?: string | null;
};

type LootboxPoolRow = {
  id: string;
  zone_theme: string | null;
  name: string | null;
  description: string | null;
  is_active: boolean | null;
};

type LootboxEntryRow = {
  id: string;
  pool_id: string;
  reward_id: string | null;
  selection_group: "guaranteed" | "bonus" | string;
  currency_code: "seeds_progress" | "sparks" | "amber" | string | null;
  currency_amount: number | string | null;
  shared_only: boolean | null;
  weight: number | string | null;
  duplicate_seed_value: number | string | null;
};

type RewardRow = {
  id: string;
  name: string | null;
  display_name: string | null;
  type: string | null;
  value: string | null;
  image_url: string | null;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeZoneTheme(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function pickWeightedEntry(entries: LootboxEntryRow[]): LootboxEntryRow | null {
  const totalWeight = entries.reduce((sum, entry) => {
    const weight = Number(entry.weight ?? 0);
    return sum + (Number.isFinite(weight) ? weight : 0);
  }, 0);

  if (!totalWeight) {
    return entries[0] ?? null;
  }

  const roll = Math.random() * totalWeight;
  let cursor = 0;

  for (const entry of entries) {
    cursor += Number(entry.weight ?? 0);
    if (roll < cursor) {
      return entry;
    }
  }

  return entries[entries.length - 1] ?? null;
}

function pickWeightedEntryFromGroup(entries: LootboxEntryRow[], group: string): LootboxEntryRow | null {
  return pickWeightedEntry(entries.filter((entry) => entry.selection_group === group));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "claimZoneLootbox");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: "Supabase service not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData?.user?.id) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const authId = userData.user.id;

    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      body = {};
    }

    const poolId = String(body.poolId || "").trim();
    const zoneTheme = normalizeZoneTheme(body.zoneTheme);
    const zoneId = String(body.zoneId || "").trim();
    const claimKey = String(body.claimKey || "").trim() || `zone-lootbox:${authId}:${zoneId || poolId || zoneTheme || "default"}`;

    let pool: LootboxPoolRow | null = null;

    if (poolId) {
      const { data: poolData, error: poolError } = await adminClient
        .from("ZoneLootboxPool")
        .select("id, zone_theme, name, description, is_active")
        .eq("id", poolId)
        .maybeSingle<LootboxPoolRow>();

      if (poolError) {
        console.error("[claimZoneLootbox] pool lookup failed", poolError);
        return jsonResponse({ success: false, error: "Lootbox pool lookup failed" }, 500);
      }
      pool = poolData ?? null;
    } else if (zoneTheme) {
      const { data: poolData, error: poolError } = await adminClient
        .from("ZoneLootboxPool")
        .select("id, zone_theme, name, description, is_active")
        .eq("zone_theme", zoneTheme)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<LootboxPoolRow>();

      if (poolError) {
        console.error("[claimZoneLootbox] theme pool lookup failed", poolError);
        return jsonResponse({ success: false, error: "Lootbox pool lookup failed" }, 500);
      }
      pool = poolData ?? null;
    }

    if (!pool) {
      return jsonResponse({ success: false, error: "No active lootbox pool found" }, 404);
    }

    const { data: existingClaim, error: existingClaimError } = await adminClient
      .from("ZoneLootboxClaim")
      .select("id, auth_id, pool_id, claim_key, reward_id, reward_status, duplicate_seed_value, metadata, created_at")
      .eq("auth_id", authId)
      .eq("claim_key", claimKey)
      .maybeSingle();

    if (existingClaimError) {
      console.error("[claimZoneLootbox] existing claim lookup failed", existingClaimError);
      return jsonResponse({ success: false, error: "Claim lookup failed" }, 500);
    }

    if (existingClaim) {
      return jsonResponse({ success: true, duplicate: true, claim: existingClaim });
    }

    const { data: entries, error: entriesError } = await adminClient
      .from("ZoneLootboxEntry")
      .select("id, pool_id, reward_id, selection_group, currency_code, currency_amount, shared_only, weight, duplicate_seed_value")
      .eq("pool_id", pool.id)
      .order("weight", { ascending: false });

    if (entriesError) {
      console.error("[claimZoneLootbox] entry lookup failed", entriesError);
      return jsonResponse({ success: false, error: "Lootbox entry lookup failed" }, 500);
    }

    const poolEntries = (entries || []) as LootboxEntryRow[];
    const { data: sharedInvite, error: sharedInviteError } = zoneId
      ? await adminClient
        .from("ZoneSharedInvite")
        .select("id")
        .eq("source_zone_id", zoneId)
        .eq("status", "completed")
        .or(`sender_auth_id.eq.${authId},recipient_auth_id.eq.${authId}`)
        .limit(1)
        .maybeSingle()
      : { data: null, error: null };

    if (sharedInviteError) {
      console.warn("[claimZoneLootbox] shared invite lookup failed", sharedInviteError);
    }

    const isSharedZone = Boolean(sharedInvite?.id);
    const eligibleEntries = poolEntries.filter((entry) => !entry.shared_only || isSharedZone);
    const guaranteedEntry = pickWeightedEntryFromGroup(eligibleEntries, "guaranteed");
    const bonusEntry = pickWeightedEntryFromGroup(eligibleEntries, "bonus");
    if (!guaranteedEntry || !bonusEntry) {
      return jsonResponse({ success: false, error: "Lootbox pool is empty" }, 404);
    }

    const runtimeMetadata = {
      poolId: pool.id,
      zoneTheme: pool.zone_theme,
      zoneId,
      claimKey,
      isSharedZone,
      selectedEntryIds: [guaranteedEntry.id, bonusEntry.id],
    };

    const selectedEntries = [guaranteedEntry, bonusEntry];
    let reward: RewardRow | null = null;
    let rewardStatus = "granted";
    let duplicateSeedValue = 0;
    const grantedCurrencies: Array<{ currencyCode: string; amount: number }> = [];

    for (const [index, selectedEntry] of selectedEntries.entries()) {
      const amount = Math.max(0, Number(selectedEntry.currency_amount ?? 0));
      if (selectedEntry.currency_code) {
        const { error: walletError } = await adminClient.rpc("wallet_grant_currency", {
          p_auth_id: authId,
          p_currency_code: selectedEntry.currency_code,
          p_event_source: "zone_lootbox",
          p_event_reference: `${claimKey}:${selectedEntry.id}`,
          p_amount: amount,
          p_direction: "credit",
          p_metadata: { ...runtimeMetadata, selectionIndex: index },
        });
        if (walletError) {
          console.error("[claimZoneLootbox] wallet grant failed", walletError);
          return jsonResponse({ success: false, error: "Lootbox currency grant failed" }, 500);
        }
        grantedCurrencies.push({ currencyCode: selectedEntry.currency_code, amount });
        continue;
      }

      if (!selectedEntry.reward_id) continue;
      const { data: selectedReward, error: rewardError } = await adminClient
        .from("Rewards")
        .select("id, name, display_name, type, value, image_url")
        .eq("id", selectedEntry.reward_id)
        .maybeSingle<RewardRow>();

      if (rewardError || !selectedReward) {
        console.error("[claimZoneLootbox] reward lookup failed", rewardError);
        return jsonResponse({ success: false, error: "Lootbox reward missing" }, 500);
      }
      reward = selectedReward;

      const { data: ownedRewards, error: ownedRewardsError } = await adminClient
        .from("UserRewards")
        .select("id")
        .eq("auth_id", authId)
        .eq("reward_id", selectedReward.id)
        .limit(1);
      if (ownedRewardsError) {
        console.error("[claimZoneLootbox] user reward check failed", ownedRewardsError);
        return jsonResponse({ success: false, error: "Reward ownership lookup failed" }, 500);
      }

      const hasDuplicate = (ownedRewards || []).length > 0;
      duplicateSeedValue += hasDuplicate ? Number(selectedEntry.duplicate_seed_value ?? 0) : 0;
      if (hasDuplicate) {
        rewardStatus = "duplicate_compensated";
        const { error: walletError } = await adminClient.rpc("wallet_grant_currency", {
          p_auth_id: authId,
          p_currency_code: "seeds_progress",
          p_event_source: "zone_lootbox_duplicate",
          p_event_reference: `${claimKey}:${selectedEntry.id}`,
          p_amount: Number(selectedEntry.duplicate_seed_value ?? 0),
          p_direction: "credit",
          p_metadata: { ...runtimeMetadata, selectionIndex: index },
        });
        if (walletError) return jsonResponse({ success: false, error: "Seed compensation failed" }, 500);
      } else {
        const { error: rewardInsertError } = await adminClient.from("UserRewards").insert({
          auth_id: authId,
          reward_id: selectedReward.id,
          reward_name: selectedReward.display_name || selectedReward.name || selectedReward.type || "Reward",
          unlocked_date: new Date().toISOString(),
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        });
        if (rewardInsertError) return jsonResponse({ success: false, error: "Reward claim failed" }, 500);
      }
    }

    const { data: claimRecord, error: insertError } = await adminClient
      .from("ZoneLootboxClaim")
      .insert({
        auth_id: authId,
        pool_id: pool.id,
        claim_key: claimKey,
        reward_id: reward?.id ?? null,
        reward_status: rewardStatus,
        duplicate_seed_value: duplicateSeedValue,
        metadata: runtimeMetadata,
      })
      .select("id, auth_id, pool_id, claim_key, reward_id, reward_status, duplicate_seed_value, metadata, created_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: retryRecord, error: retryError } = await adminClient
          .from("ZoneLootboxClaim")
          .select("id, auth_id, pool_id, claim_key, reward_id, reward_status, duplicate_seed_value, metadata, created_at")
          .eq("auth_id", authId)
          .eq("claim_key", claimKey)
          .maybeSingle();

        if (retryError) {
          console.error("[claimZoneLootbox] retry read failed", retryError);
          return jsonResponse({ success: false, error: "Claim retry resolution failed" }, 500);
        }

        return jsonResponse({ success: true, duplicate: true, claim: retryRecord });
      }

      console.error("[claimZoneLootbox] insert failed", insertError);
      return jsonResponse({ success: false, error: "Claim was not persisted" }, 500);
    }

    return jsonResponse({
      success: true,
      duplicate: false,
      claim: claimRecord,
      reward: reward ? {
        id: reward.id,
        name: reward.display_name || reward.name || reward.type || "Reward",
        type: reward.type,
        value: reward.value,
        imageUrl: reward.image_url,
      } : null,
      currencies: grantedCurrencies,
      rewardStatus,
      duplicateSeedValue,
    });
  } catch (error) {
    console.error("[claimZoneLootbox] unexpected error", error);
    return jsonResponse({ success: false, error: "Unexpected error" }, 500);
  }
});

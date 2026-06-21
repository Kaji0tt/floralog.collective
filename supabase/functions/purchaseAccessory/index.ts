import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PurchaseBody = {
  authId?: string;
  userEmail?: string | null;
  rewardId?: string;
  accessoryId?: string;
  rewardValue?: string;
  rewardType?: string;
  purchaseKind?: string;
  sparkPrice?: number;
  amberPrice?: number;
  paymentCurrency?: string; // "sparks" | "amber"
  eventReference?: string;
};

type PurchaseKind = "accessory" | "profile_effect" | "logo_effect";

const PURCHASE_KIND_ALLOWED_REWARD_TYPES: Record<PurchaseKind, string[]> = {
  accessory: ["logo_accessory", "accessory"],
  profile_effect: ["profile_effect"],
  logo_effect: ["logo_effect"],
};

function normalizeText(value: string | null | undefined): string {
  return String(value || "").trim();
}

function normalizeLower(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase();
}

function resolvePurchaseKind(value: string | null | undefined): PurchaseKind {
  const normalized = normalizeLower(value);
  if (normalized === "profile_effect") return "profile_effect";
  if (normalized === "logo_effect") return "logo_effect";
  return "accessory";
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "purchaseAccessory");
  if (originDeniedResponse) return originDeniedResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let body: PurchaseBody;
  try {
    body = (await req.json()) as PurchaseBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const authId = String(body.authId || "").trim();
  const providedEmail = normalizeEmail(body.userEmail);

  if (!isUuid(authId)) {
    return jsonResponse({ error: "authId is required" }, 400);
  }

  const { data: userLookup, error: userLookupError } = await adminClient.auth.admin.getUserById(authId);
  const resolvedUser = userLookup?.user;
  if (userLookupError || !resolvedUser) {
    return jsonResponse({ error: "Invalid authId" }, 401);
  }

  const resolvedEmail = normalizeEmail(resolvedUser.email);
  if (providedEmail && resolvedEmail && providedEmail !== resolvedEmail) {
    return jsonResponse({ error: "authId and userEmail do not match" }, 403);
  }

  const userEmail = resolvedUser.email || "";

  const rewardId = normalizeText(body.rewardId);
  const accessoryId = normalizeText(body.accessoryId);
  const rewardValueInput = normalizeText(body.rewardValue);
  const requestedRewardType = normalizeLower(body.rewardType);
  const purchaseKind = resolvePurchaseKind(body.purchaseKind);
  const itemValue = purchaseKind === "accessory" ? accessoryId : rewardValueInput;
  const sparkPrice = Math.max(0, Math.round(Number(body.sparkPrice ?? 0)));
  const amberPrice = Math.max(0, Math.round(Number(body.amberPrice ?? 0)));
  const paymentCurrency = normalizeLower(body.paymentCurrency) === "amber" ? "amber" : "sparks";
  const eventReference = normalizeText(body.eventReference || `shop-${purchaseKind}:${itemValue || rewardId}:${Date.now()}`);

  if (!rewardId) {
    return jsonResponse({ error: "rewardId is required" }, 400);
  }

  if (purchaseKind === "accessory" && !accessoryId) {
    return jsonResponse({ error: "accessoryId is required for accessory purchases" }, 400);
  }

  if (sparkPrice <= 0 && amberPrice <= 0) {
    return jsonResponse({ error: "Item has no price configured" }, 400);
  }

  // Validate chosen currency has a price configured
  const chosenPrice = paymentCurrency === "amber" ? amberPrice : sparkPrice;
  if (chosenPrice <= 0) {
    return jsonResponse({ error: `Item has no ${paymentCurrency} price configured` }, 400);
  }

  // Verify reward exists and is a purchasable type for the requested purchase kind.
  const allowedRewardTypes = PURCHASE_KIND_ALLOWED_REWARD_TYPES[purchaseKind] || PURCHASE_KIND_ALLOWED_REWARD_TYPES.accessory;
  const { data: reward, error: rewardError } = await adminClient
    .from("Rewards")
    .select("id, display_name, name, value, type, spark_price, amber_price, shop_hidden")
    .eq("id", rewardId)
    .maybeSingle();

  if (rewardError) {
    console.error("[purchaseAccessory] Reward lookup error:", rewardError);
    return jsonResponse({ error: "Failed to verify reward" }, 500);
  }

  const rewardType = normalizeLower(String(reward?.type || ""));
  if (!reward || !allowedRewardTypes.includes(rewardType)) {
    return jsonResponse({ applied: false, errorCode: "reward_not_configured" });
  }

  // Block purchases of shop-hidden rewards (legacy/retired items)
  if (reward.shop_hidden) {
    return jsonResponse({ applied: false, errorCode: "asset_legacy" });
  }

  const rewardValue = normalizeText(String(reward?.value || ""));
  if (purchaseKind === "accessory") {
    if (normalizeLower(rewardValue) !== normalizeLower(accessoryId)) {
      return jsonResponse({ applied: false, errorCode: "reward_not_configured" });
    }
  } else if (rewardValueInput && normalizeLower(rewardValueInput) !== normalizeLower(rewardValue)) {
    return jsonResponse({ applied: false, errorCode: "reward_not_configured" });
  }

  if (requestedRewardType && requestedRewardType !== rewardType) {
    return jsonResponse({ applied: false, errorCode: "reward_not_configured" });
  }

  // Block purchases of legacy/retired logo accessories
  if (purchaseKind === "accessory" && accessoryId) {
    const { data: logoAsset } = await adminClient
      .from("LogoAsset")
      .select("legacy")
      .eq("asset_id", accessoryId)
      .maybeSingle();

    if (logoAsset?.legacy) {
      return jsonResponse({ applied: false, errorCode: "asset_legacy" });
    }
  }

  // Cross-check: prices sent by client must match DB prices (prevent price tampering)
  const dbSparkPrice = Math.max(0, Math.round(Number(reward.spark_price ?? 0)));
  const dbAmberPrice = Math.max(0, Math.round(Number(reward.amber_price ?? 0)));

  if (sparkPrice !== dbSparkPrice || amberPrice !== dbAmberPrice) {
    console.warn("[purchaseAccessory] Price mismatch — client sent different prices than DB", {
      clientSpark: sparkPrice, dbSpark: dbSparkPrice,
      clientAmber: amberPrice, dbAmber: dbAmberPrice,
    });
    return jsonResponse({ applied: false, errorCode: "price_mismatch" });
  }

  // Check if already owned
  const { data: existingReward } = await adminClient
    .from("UserRewards")
    .select("id")
    .eq("auth_id", authId)
    .eq("reward_id", rewardId)
    .maybeSingle();

  if (existingReward) {
    // Already owned — return current balances without charging
    const { data: wallet } = await adminClient
      .from("UserWallet")
      .select("sparks_balance, amber_balance")
      .eq("auth_id", authId)
      .maybeSingle();

    return jsonResponse({
      applied: true,
      alreadyOwned: true,
      sparksBalance: Math.max(0, Number(wallet?.sparks_balance ?? 0)),
      amberBalance: Math.max(0, Number(wallet?.amber_balance ?? 0)),
    });
  }

  // Check wallet balances
  const { data: wallet, error: walletError } = await adminClient
    .from("UserWallet")
    .select("sparks_balance, amber_balance")
    .eq("auth_id", authId)
    .maybeSingle();

  if (walletError) {
    console.error("[purchaseAccessory] Wallet lookup error:", walletError);
    return jsonResponse({ error: "Failed to read wallet" }, 500);
  }

  const sparksBalance = Math.max(0, Number(wallet?.sparks_balance ?? 0));
  const amberBalance = Math.max(0, Number(wallet?.amber_balance ?? 0));

  // Only check balance for the chosen currency
  const effectiveSparkCost = paymentCurrency === "sparks" ? dbSparkPrice : 0;
  const effectiveAmberCost = paymentCurrency === "amber" ? dbAmberPrice : 0;
  const insufficientSparks = effectiveSparkCost > 0 && sparksBalance < effectiveSparkCost;
  const insufficientAmber = effectiveAmberCost > 0 && amberBalance < effectiveAmberCost;

  if (insufficientSparks || insufficientAmber) {
    return jsonResponse({
      applied: false,
      errorCode: insufficientSparks ? "insufficient_sparks" : "insufficient_amber",
      sparksBalance,
      amberBalance,
      sparkPrice: effectiveSparkCost,
      amberPrice: effectiveAmberCost,
    });
  }

  // --- Atomic: debit chosen currency then insert UserReward ---

  let newSparksBalance = sparksBalance;
  let newAmberBalance = amberBalance;

  // Debit sparks (only if paying with sparks)
  if (paymentCurrency === "sparks" && dbSparkPrice > 0) {
    const sparkEventSource = `shop_${purchaseKind}_purchase`;
    const sparkMetadata = {
      source: "profile_shop",
      purchase_kind: purchaseKind,
      reward_id: rewardId,
      reward_type: rewardType,
      reward_value: rewardValue,
      item_value: itemValue || rewardValue,
    };

    const { data: sparkResult, error: sparkError } = await adminClient.rpc("wallet_grant_currency", {
      p_auth_id: authId,
      p_currency_code: "sparks",
      p_event_source: sparkEventSource,
      p_event_reference: eventReference,
      p_amount: dbSparkPrice,
      p_direction: "debit",
      p_metadata: sparkMetadata,
    });

    if (sparkError || !sparkResult?.[0]?.applied) {
      console.error("[purchaseAccessory] Spark debit failed:", sparkError);
      return jsonResponse({ error: "Kauf fehlgeschlagen: Funken konnten nicht abgebucht werden." }, 500);
    }

    newSparksBalance = Math.max(0, Number(sparkResult[0].sparks_balance ?? sparksBalance - dbSparkPrice));
  }

  // Debit amber (only if paying with amber)
  if (paymentCurrency === "amber" && dbAmberPrice > 0) {
    const amberEventSource = `shop_${purchaseKind}_purchase`;
    const amberMetadata = {
      source: "profile_shop",
      purchase_kind: purchaseKind,
      reward_id: rewardId,
      reward_type: rewardType,
      reward_value: rewardValue,
      item_value: itemValue || rewardValue,
    };

    const { data: amberResult, error: amberError } = await adminClient.rpc("wallet_grant_currency", {
      p_auth_id: authId,
      p_currency_code: "amber",
      p_event_source: amberEventSource,
      p_event_reference: eventReference,
      p_amount: dbAmberPrice,
      p_direction: "debit",
      p_metadata: amberMetadata,
    });

    if (amberError || !amberResult?.[0]?.applied) {
      console.error("[purchaseAccessory] Amber debit failed:", amberError);
      return jsonResponse({ error: "Kauf fehlgeschlagen: Bernstein konnte nicht abgebucht werden." }, 500);
    }

    newAmberBalance = Math.max(0, Number(amberResult[0].amber_balance ?? amberBalance - dbAmberPrice));
  }

  // Insert UserReward (as service role — no RLS restriction)
  const { data: profile } = await adminClient
    .from("PublicProfile")
    .select("display_name, full_name")
    .eq("auth_id", authId)
    .maybeSingle();

  const displayName = profile?.display_name || profile?.full_name || userEmail;

  const { error: insertError } = await adminClient.from("UserRewards").insert({
    reward_id: rewardId,
    reward_name: reward.display_name || reward.name || reward.value || itemValue || rewardId,
    auth_id: authId,
    user_email: userEmail,
    user_name: displayName,
    unlocked_date: new Date().toISOString(),
  });

  if (insertError) {
    console.error("[purchaseAccessory] UserRewards insert failed:", insertError);

    // Full refund — only refund the currency that was actually debited
    if (paymentCurrency === "sparks" && dbSparkPrice > 0) {
      await adminClient.rpc("wallet_grant_currency", {
        p_auth_id: authId,
        p_currency_code: "sparks",
        p_event_source: `shop_${purchaseKind}_purchase_refund`,
        p_event_reference: eventReference,
        p_amount: dbSparkPrice,
        p_direction: "credit",
        p_metadata: {
          source: "profile_shop",
          purchase_kind: purchaseKind,
          reward_id: rewardId,
          reward_type: rewardType,
          reward_value: rewardValue,
          item_value: itemValue || rewardValue,
          reason: "user_reward_insert_failed",
        },
      });
    }

    if (paymentCurrency === "amber" && dbAmberPrice > 0) {
      await adminClient.rpc("wallet_grant_currency", {
        p_auth_id: authId,
        p_currency_code: "amber",
        p_event_source: `shop_${purchaseKind}_purchase_refund`,
        p_event_reference: eventReference,
        p_amount: dbAmberPrice,
        p_direction: "credit",
        p_metadata: {
          source: "profile_shop",
          purchase_kind: purchaseKind,
          reward_id: rewardId,
          reward_type: rewardType,
          reward_value: rewardValue,
          item_value: itemValue || rewardValue,
          reason: "user_reward_insert_failed",
        },
      });
    }

    return jsonResponse({ error: "Kauf fehlgeschlagen: Belohnung konnte nicht gespeichert werden." }, 500);
  }

  return jsonResponse({
    applied: true,
    alreadyOwned: false,
    sparksBalance: newSparksBalance,
    amberBalance: newAmberBalance,
  });
});

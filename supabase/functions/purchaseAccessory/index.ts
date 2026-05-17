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
  sparkPrice?: number;
  amberPrice?: number;
  eventReference?: string;
};

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

  const rewardId = String(body.rewardId || "").trim();
  const accessoryId = String(body.accessoryId || "").trim();
  const sparkPrice = Math.max(0, Math.round(Number(body.sparkPrice ?? 0)));
  const amberPrice = Math.max(0, Math.round(Number(body.amberPrice ?? 0)));
  const eventReference = String(body.eventReference || `shop-accessory:${accessoryId}:${Date.now()}`).trim();

  if (!rewardId || !accessoryId) {
    return jsonResponse({ error: "rewardId and accessoryId are required" }, 400);
  }

  if (sparkPrice <= 0 && amberPrice <= 0) {
    return jsonResponse({ error: "Item has no price configured" }, 400);
  }

  // Verify reward exists and is a purchasable accessory type
  const { data: reward, error: rewardError } = await adminClient
    .from("Rewards")
    .select("id, display_name, name, value, type, spark_price, amber_price")
    .eq("id", rewardId)
    .in("type", ["logo_accessory", "accessory"])
    .maybeSingle();

  if (rewardError) {
    console.error("[purchaseAccessory] Reward lookup error:", rewardError);
    return jsonResponse({ error: "Failed to verify reward" }, 500);
  }

  if (!reward) {
    return jsonResponse({ applied: false, errorCode: "reward_not_configured" });
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
  const insufficientSparks = dbSparkPrice > 0 && sparksBalance < dbSparkPrice;
  const insufficientAmber = dbAmberPrice > 0 && amberBalance < dbAmberPrice;

  if (insufficientSparks || insufficientAmber) {
    return jsonResponse({
      applied: false,
      errorCode: insufficientSparks && insufficientAmber
        ? "insufficient_both"
        : insufficientSparks ? "insufficient_sparks" : "insufficient_amber",
      sparksBalance,
      amberBalance,
      sparkPrice: dbSparkPrice,
      amberPrice: dbAmberPrice,
    });
  }

  // --- Atomic: debit currencies then insert UserReward ---

  let newSparksBalance = sparksBalance;
  let newAmberBalance = amberBalance;

  // Debit sparks
  if (dbSparkPrice > 0) {
    const { data: sparkResult, error: sparkError } = await adminClient.rpc("wallet_grant_currency", {
      p_auth_id: authId,
      p_currency_code: "sparks",
      p_event_source: "shop_accessory_purchase",
      p_event_reference: eventReference,
      p_amount: dbSparkPrice,
      p_direction: "debit",
      p_metadata: { source: "profile_shop", accessory_id: accessoryId, reward_id: rewardId },
    });

    if (sparkError || !sparkResult?.[0]?.applied) {
      console.error("[purchaseAccessory] Spark debit failed:", sparkError);
      return jsonResponse({ error: "Kauf fehlgeschlagen: Funken konnten nicht abgebucht werden." }, 500);
    }

    newSparksBalance = Math.max(0, Number(sparkResult[0].sparks_balance ?? sparksBalance - dbSparkPrice));
  }

  // Debit amber
  if (dbAmberPrice > 0) {
    const { data: amberResult, error: amberError } = await adminClient.rpc("wallet_grant_currency", {
      p_auth_id: authId,
      p_currency_code: "amber",
      p_event_source: "shop_accessory_purchase",
      p_event_reference: eventReference,
      p_amount: dbAmberPrice,
      p_direction: "debit",
      p_metadata: { source: "profile_shop", accessory_id: accessoryId, reward_id: rewardId },
    });

    if (amberError || !amberResult?.[0]?.applied) {
      console.error("[purchaseAccessory] Amber debit failed:", amberError);

      // Refund sparks
      if (dbSparkPrice > 0) {
        await adminClient.rpc("wallet_grant_currency", {
          p_auth_id: authId,
          p_currency_code: "sparks",
          p_event_source: "shop_accessory_purchase_refund",
          p_event_reference: eventReference,
          p_amount: dbSparkPrice,
          p_direction: "credit",
          p_metadata: { source: "profile_shop", accessory_id: accessoryId, reason: "amber_debit_failed" },
        });
      }

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
    reward_name: reward.display_name || reward.name || reward.value || accessoryId,
    auth_id: authId,
    user_email: userEmail,
    user_name: displayName,
    unlocked_date: new Date().toISOString(),
  });

  if (insertError) {
    console.error("[purchaseAccessory] UserRewards insert failed:", insertError);

    // Full refund
    if (dbSparkPrice > 0) {
      await adminClient.rpc("wallet_grant_currency", {
        p_auth_id: authId,
        p_currency_code: "sparks",
        p_event_source: "shop_accessory_purchase_refund",
        p_event_reference: eventReference,
        p_amount: dbSparkPrice,
        p_direction: "credit",
        p_metadata: { source: "profile_shop", accessory_id: accessoryId, reason: "user_reward_insert_failed" },
      });
    }

    if (dbAmberPrice > 0) {
      await adminClient.rpc("wallet_grant_currency", {
        p_auth_id: authId,
        p_currency_code: "amber",
        p_event_source: "shop_accessory_purchase_refund",
        p_event_reference: eventReference,
        p_amount: dbAmberPrice,
        p_direction: "credit",
        p_metadata: { source: "profile_shop", accessory_id: accessoryId, reason: "user_reward_insert_failed" },
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";
import { captureOrFetchPayPalOrder, extractVerifiedPayPalCapture } from "../_shared/paypalCapture.ts";
import { getSupabasePublishableKey } from "../_shared/supabaseKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

interface AmberPackage {
  price: number;
  amber: number;
}

const AMBER_PACKAGES: AmberPackage[] = [
  { price: 1.30, amber: 30 },
  { price: 3.90, amber: 100 },
  { price: 7.90, amber: 240 },
];

function extractPurchaseFromCustomId(customId: string): { amber: number; authId: string } | null {
  const match = /^amber:(\d+):([0-9a-f-]{36})$/i.exec(customId || "");
  if (!match) return null;
  const amber = Number(match[1]);
  if (!Number.isFinite(amber) || !AMBER_PACKAGES.some((pkg) => pkg.amber === amber)) return null;
  return { amber, authId: match[2] };
}

async function requestPayPalToken(paypalBaseUrl: string, clientId: string, clientSecret: string) {
  const authHeader = btoa(`${clientId}:${clientSecret}`);

  const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const tokenJson = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenJson?.access_token) {
    return {
      ok: false as const,
      error: {
        status: tokenResponse.status,
        payload: tokenJson,
      },
    };
  }

  return {
    ok: true as const,
    accessToken: tokenJson.access_token as string,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "capturePayPalAmberPayment");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabasePublishableKey = getSupabasePublishableKey();
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    const paypalBaseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";

    if (!supabaseUrl || !supabasePublishableKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase not configured" }, 500);
    }

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "PayPal secrets not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orderID = typeof body?.orderID === "string" ? body.orderID.trim() : "";
    if (!orderID) {
      return jsonResponse({ error: "Missing orderID" }, 400);
    }

    const tokenResult = await requestPayPalToken(paypalBaseUrl, clientId, clientSecret);
    if (!tokenResult.ok) {
      console.error("[capturePayPalAmberPayment] PayPal auth failed", tokenResult.error);
      return jsonResponse({ error: "PayPal authentication failed", details: tokenResult.error.payload }, 500);
    }

    const capture = await captureOrFetchPayPalOrder({
      paypalBaseUrl,
      accessToken: tokenResult.accessToken,
      orderId: orderID,
    });
    const verifiedCapture = extractVerifiedPayPalCapture(capture, orderID);
    const purchase = extractPurchaseFromCustomId(verifiedCapture?.customId || "");
    const expectedPackage = purchase
      ? AMBER_PACKAGES.find((pkg) => pkg.amber === purchase.amber) || null
      : null;
    if (!purchase || purchase.authId !== user.id) {
      console.error("[capturePayPalAmberPayment] Invalid purchase reference", { orderID, authId: user.id });
      return jsonResponse({ error: "Payment does not belong to this account" }, 400);
    }

    if (
      !verifiedCapture ||
      !expectedPackage ||
      verifiedCapture.currencyCode !== "EUR" ||
      Math.abs(verifiedCapture.grossAmount - expectedPackage.price) >= 0.001
    ) {
      return jsonResponse({ error: "Payment amount does not match the amber package" }, 400);
    }

    // Credit amber to user wallet
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error: ledgerError } = await adminClient
      .from("PaymentTransaction")
      .insert({
        provider: "paypal",
        provider_order_id: verifiedCapture.orderId,
        provider_capture_id: verifiedCapture.captureId,
        payment_kind: "amber_purchase",
        auth_id: user.id,
        gross_amount: verifiedCapture.grossAmount,
        fee_amount: verifiedCapture.feeAmount,
        net_amount: verifiedCapture.netAmount,
        currency_code: verifiedCapture.currencyCode,
        product_code: `amber-${purchase.amber}`,
        quantity: purchase.amber,
        metadata: { source: "paypal_checkout" },
        captured_at: verifiedCapture.capturedAt,
      });

    if (ledgerError && ledgerError.code !== "23505") {
      console.error("[capturePayPalAmberPayment] Failed to record payment", ledgerError);
      return jsonResponse(
        { error: "Payment captured but revenue recording failed. Contact support.", details: { orderID } },
        500,
      );
    }

    if (ledgerError?.code === "23505") {
      const { data: existingPayment, error: existingPaymentError } = await adminClient
        .from("PaymentTransaction")
        .select("auth_id, payment_kind, provider_capture_id, quantity")
        .eq("provider", "paypal")
        .eq("provider_order_id", orderID)
        .maybeSingle();
      if (
        existingPaymentError ||
        existingPayment?.auth_id !== user.id ||
        existingPayment?.payment_kind !== "amber_purchase" ||
        existingPayment?.provider_capture_id !== verifiedCapture.captureId ||
        Number(existingPayment?.quantity) !== purchase.amber
      ) {
        return jsonResponse({ error: "Payment ledger conflict. Contact support.", details: { orderID } }, 409);
      }
    }

    const eventReference = `amber-purchase:${orderID}:${purchase.amber}`;

    const { error: rpcError } = await adminClient.rpc("wallet_grant_currency", {
      p_auth_id: user.id,
      p_currency_code: "amber",
      p_event_source: "paypal_amber_purchase",
      p_event_reference: eventReference,
      p_amount: purchase.amber,
      p_direction: "credit",
      p_metadata: { orderID, amber: purchase.amber },
    });

    if (rpcError) {
      console.error("[capturePayPalAmberPayment] Failed to credit amber", rpcError);
      return jsonResponse({ error: "Payment captured but amber credit failed. Contact support.", details: { orderID } }, 500);
    }

    return jsonResponse(
      {
        success: true,
        amber: purchase.amber,
        message: `${purchase.amber} Bernstein wurden deinem Konto gutgeschrieben.`,
      },
      200,
    );
  } catch (error) {
    console.error("[capturePayPalAmberPayment] Unexpected error", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

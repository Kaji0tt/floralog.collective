import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    const paypalBaseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase not configured" }, 500);
    }

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "PayPal secrets not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const capture = await captureResponse.json().catch(() => ({}));
    if (!captureResponse.ok) {
      console.error("[capturePayPalAmberPayment] Capture failed", { status: captureResponse.status, capture });
      return jsonResponse({ error: "PayPal capture failed", details: capture }, 500);
    }

    if (capture?.status !== "COMPLETED") {
      return jsonResponse({ error: "Payment not completed", status: capture?.status || "UNKNOWN" }, 400);
    }

    const purchaseUnit = capture?.purchase_units?.[0];
    const customId = purchaseUnit?.payments?.captures?.[0]?.custom_id || purchaseUnit?.custom_id || "";
    const purchase = extractPurchaseFromCustomId(customId);
    if (!purchase || purchase.authId !== user.id) {
      console.error("[capturePayPalAmberPayment] Invalid purchase reference", { customId, orderID, authId: user.id });
      return jsonResponse({ error: "Payment does not belong to this account" }, 400);
    }

    // Credit amber to user wallet
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

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

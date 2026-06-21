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

function findPackageByPrice(price: number): AmberPackage | null {
  return AMBER_PACKAGES.find((pkg) => Math.abs(pkg.price - price) < 0.001) || null;
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

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "createPayPalAmberOrder");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    const paypalBaseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase not configured" }, 500);
    }

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "PayPal secrets not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const price = typeof body?.price === "number" ? body.price : Number(body?.price);
    if (!Number.isFinite(price) || price < 1) {
      return jsonResponse({ error: "Invalid price" }, 400);
    }

    const pkg = findPackageByPrice(price);
    if (!pkg) {
      return jsonResponse({ error: "Invalid amber package" }, 400);
    }

    const tokenResult = await requestPayPalToken(paypalBaseUrl, clientId, clientSecret);
    if (!tokenResult.ok) {
      console.error("[createPayPalAmberOrder] PayPal auth failed", tokenResult.error);
      return jsonResponse({ error: "PayPal authentication failed", details: tokenResult.error.payload }, 500);
    }

    const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: pkg.price.toFixed(2),
            },
            description: `Floralog Bernstein x${pkg.amber}`,
            custom_id: `amber:${pkg.amber}:${user.id}`,
          },
        ],
        application_context: {
          brand_name: "Floralog",
          user_action: "PAY_NOW",
        },
      }),
    });

    const order = await orderResponse.json().catch(() => ({}));
    if (!orderResponse.ok || !order?.id) {
      console.error("[createPayPalAmberOrder] PayPal order creation failed", { status: orderResponse.status, order });
      return jsonResponse({ error: "PayPal order creation failed", details: order }, 500);
    }

    return jsonResponse({ orderID: order.id, amber: pkg.amber, price: pkg.price }, 200);
  } catch (error) {
    console.error("[createPayPalAmberOrder] Unexpected error", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

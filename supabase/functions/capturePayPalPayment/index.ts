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

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "capturePayPalPayment");
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
      console.error("[capturePayPalPayment] PayPal auth failed", tokenResult.error);
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
      console.error("[capturePayPalPayment] Capture failed", { status: captureResponse.status, capture });
      return jsonResponse({ error: "PayPal capture failed", details: capture }, 500);
    }

    if (capture?.status !== "COMPLETED") {
      return jsonResponse({ error: "Payment not completed", status: capture?.status || "UNKNOWN" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const nextUserMetadata = {
      ...(user.user_metadata || {}),
      donor_status: true,
    };

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: nextUserMetadata,
    });

    if (authUpdateError) {
      console.error("[capturePayPalPayment] Failed to update auth user metadata", authUpdateError);
    }

    const { error: profileError } = await adminClient
      .from("PublicProfile")
      .update({
        donor_status: true,
        updated_date: new Date().toISOString(),
      })
      .eq("auth_id", user.id);

    if (profileError) {
      // Keep payment successful even if profile sync is not available in this environment.
      console.error("[capturePayPalPayment] Failed to update PublicProfile", profileError);
    }

    return jsonResponse(
      {
        success: true,
        message: "Vielen Dank fuer deine Spende. Donor-Status wurde freigeschaltet.",
      },
      200,
    );
  } catch (error) {
    console.error("[capturePayPalPayment] Unexpected error", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

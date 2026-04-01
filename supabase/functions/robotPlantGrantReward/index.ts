import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GrantBody = {
  authId?: string;
  userEmail?: string | null;
  eventSource?: string;
  eventReference?: string;
  amount?: number;
  energyDelta?: number;
  dataQualityDelta?: number;
  careDelta?: number;
  metadata?: Record<string, unknown>;
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

function getAllowedOrigins(): string[] {
  const configured = [
    Deno.env.get("FLORALOG_URL"),
    Deno.env.get("SITE_URL"),
  ].filter(Boolean) as string[];

  return [...configured, "http://localhost:5173", "http://127.0.0.1:5173"];
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return getAllowedOrigins().some((allowed) => origin.toLowerCase() === allowed.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    if (!isAllowedOrigin(req.headers.get("Origin"))) {
      return jsonResponse({ error: "Origin not allowed" }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as GrantBody;
    const authId = String(body.authId || "").trim();
    const providedEmail = normalizeEmail(body.userEmail);

    const eventSource = String(body.eventSource || "").trim();
    const eventReference = String(body.eventReference || "").trim();
    const amount = Number(body.amount ?? 0);
    const energyDelta = Number(body.energyDelta ?? 0);
    const dataQualityDelta = Number(body.dataQualityDelta ?? 0);
    const careDelta = Number(body.careDelta ?? 0);
    const metadata = body.metadata ?? {};

    if (!isUuid(authId)) {
      return jsonResponse({ error: "authId is required" }, 400);
    }

    if (!eventSource || !eventReference) {
      return jsonResponse({ error: "eventSource and eventReference are required" }, 400);
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return jsonResponse({ error: "amount must be a number >= 0" }, 400);
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

    const { data, error } = await adminClient.rpc("robot_plant_grant_reward", {
      p_auth_id: authId,
      p_event_source: eventSource,
      p_event_reference: eventReference,
      p_amount: Math.round(amount),
      p_energy_delta: Math.round(energyDelta),
      p_data_quality_delta: Math.round(dataQualityDelta),
      p_care_delta: Math.round(careDelta),
      p_metadata: metadata,
    });

    if (error) {
      console.error("[robotPlantGrantReward] rpc error", error);
      return jsonResponse({ error: "Failed to grant reward" }, 500);
    }

    const result = Array.isArray(data) ? data[0] : data;

    return jsonResponse({ ok: true, result }, 200);
  } catch (error) {
    console.error("[robotPlantGrantReward] unexpected error", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});

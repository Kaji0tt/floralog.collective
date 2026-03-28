import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GrantBody = {
  eventSource?: string;
  eventReference?: string;
  amount?: number;
  energyDelta?: number;
  dataQualityDelta?: number;
  careDelta?: number;
  metadata?: Record<string, unknown>;
};

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Supabase service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    const accessToken = getAccessTokenFromAuthHeader(authHeader);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const body = (await req.json()) as GrantBody;

    const eventSource = String(body.eventSource || "").trim();
    const eventReference = String(body.eventReference || "").trim();
    const amount = Number(body.amount ?? 0);
    const energyDelta = Number(body.energyDelta ?? 0);
    const dataQualityDelta = Number(body.dataQualityDelta ?? 0);
    const careDelta = Number(body.careDelta ?? 0);
    const metadata = body.metadata ?? {};

    if (!eventSource || !eventReference) {
      return new Response(
        JSON.stringify({ error: "eventSource and eventReference are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return new Response(
        JSON.stringify({ error: "amount must be a number >= 0" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data, error } = await adminClient.rpc("robot_plant_grant_reward", {
      p_auth_id: userData.user.id,
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
      return new Response(
        JSON.stringify({ error: "Failed to grant reward" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({
        ok: true,
        result,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[robotPlantGrantReward] unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

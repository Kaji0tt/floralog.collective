import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RemoveFriendshipBody = {
  friendEmail?: string | null;
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

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "removeFriendship");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = getAccessTokenFromAuthHeader(req.headers.get("Authorization"));
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Internal auth check (required because gateway JWT verification may be disabled)
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actorEmail = authData.user.email.trim();
    const body = (await req.json()) as RemoveFriendshipBody;
    const friendEmail = body?.friendEmail?.trim();

    if (!friendEmail) {
      return new Response(JSON.stringify({ error: "friendEmail is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const [forwardRes, reverseRes] = await Promise.all([
      adminClient
        .from("Friend")
        .select("id")
        .ilike("request_sent_by", actorEmail)
        .ilike("request_sent_to", friendEmail),
      adminClient
        .from("Friend")
        .select("id")
        .ilike("request_sent_by", friendEmail)
        .ilike("request_sent_to", actorEmail),
    ]);

    if (forwardRes.error || reverseRes.error) {
      const firstError = forwardRes.error || reverseRes.error;
      return new Response(JSON.stringify({
        error: firstError?.message || "Friendship lookup failed",
        code: firstError?.code,
        details: firstError?.details,
        hint: firstError?.hint,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ids = [...(forwardRes.data || []), ...(reverseRes.data || [])]
      .map((row) => row.id)
      .filter(Boolean);

    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: true, removed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: deleteError } = await adminClient
      .from("Friend")
      .delete()
      .in("id", ids);

    if (deleteError) {
      return new Response(JSON.stringify({
        error: deleteError.message,
        code: deleteError.code,
        details: deleteError.details,
        hint: deleteError.hint,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, removed: ids.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

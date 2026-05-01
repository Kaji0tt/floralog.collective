import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RespondBody = {
  requesterEmail?: string | null;
  action?: "accept" | "reject" | null;
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

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "respondToFriendRequest");
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

    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actorEmail = authData.user.email.trim();
    const body = (await req.json()) as RespondBody;
    const requesterEmail = body?.requesterEmail?.trim();
    const action = body?.action;

    if (!requesterEmail) {
      return new Response(JSON.stringify({ error: "requesterEmail is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action !== "accept" && action !== "reject") {
      return new Response(JSON.stringify({ error: "action must be 'accept' or 'reject'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: requests, error: requestError } = await adminClient
      .from("Friend")
      .select("id, request_sent_by, request_sent_to, status")
      .ilike("request_sent_by", requesterEmail)
      .ilike("request_sent_to", actorEmail)
      .eq("status", "pending");

    if (requestError) {
      return new Response(JSON.stringify({
        error: requestError.message,
        code: requestError.code,
        details: requestError.details,
        hint: requestError.hint,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const pendingIds = (requests || []).map((row) => row.id).filter(Boolean);
    if (pendingIds.length === 0) {
      return new Response(JSON.stringify({ success: true, affected: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "accept") {
      const { data: updatedRows, error: updateError } = await adminClient
        .from("Friend")
        .update({
          status: "accepted",
          added_date: new Date().toISOString(),
        })
        .in("id", pendingIds)
        .select("id, status, request_sent_by, request_sent_to, added_date");

      if (updateError) {
        return new Response(JSON.stringify({
          error: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ success: true, affected: updatedRows?.length || 0, rows: updatedRows || [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: deleteError } = await adminClient
      .from("Friend")
      .delete()
      .in("id", pendingIds);

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

    return new Response(JSON.stringify({ success: true, affected: pendingIds.length }), {
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

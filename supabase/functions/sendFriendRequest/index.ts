import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendFriendRequestBody = {
  recipientEmail?: string | null;
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user?.email) {
      console.error("[sendFriendRequest] Unauthorized:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actorEmail = authData.user.email.trim();
    const body = (await req.json()) as SendFriendRequestBody;
    const recipientEmail = body?.recipientEmail?.trim();

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "recipientEmail is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (actorEmail.toLowerCase() === recipientEmail.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Du kannst dir nicht selbst eine Anfrage senden!" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: forward, error: forwardError } = await adminClient
      .from("Friend")
      .select("id, status, request_sent_by, request_sent_to")
      .ilike("request_sent_by", actorEmail)
      .ilike("request_sent_to", recipientEmail)
      .limit(1)
      .maybeSingle();

    if (forwardError) {
      return new Response(JSON.stringify({ error: forwardError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: reverse, error: reverseError } = await adminClient
      .from("Friend")
      .select("id, status, request_sent_by, request_sent_to")
      .ilike("request_sent_by", recipientEmail)
      .ilike("request_sent_to", actorEmail)
      .limit(1)
      .maybeSingle();

    if (reverseError) {
      return new Response(JSON.stringify({ error: reverseError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const existing = forward || reverse;
    if (existing) {
      if (existing.status === "accepted") {
        return new Response(JSON.stringify({ error: "Ihr seid bereits befreundet!" }), {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if ((existing.request_sent_by || "").toLowerCase() === actorEmail.toLowerCase()) {
        return new Response(JSON.stringify({ error: "Du hast dieser Person bereits eine Anfrage gesendet!" }), {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ error: "Diese Person hat dir bereits eine Anfrage gesendet!" }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: createdFriend, error: createError } = await adminClient
      .from("Friend")
      .insert({
        request_sent_by: actorEmail,
        request_sent_to: recipientEmail,
        status: "pending",
        created_by: actorEmail,
        auth_id: authData.user.id,
      })
      .select("*")
      .single();

    if (createError) {
      console.error("[sendFriendRequest] Insert failed:", createError);
      if (createError.code === "23505") {
        return new Response(JSON.stringify({ error: "Freundschaftsanfrage existiert bereits." }), {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({
        error: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, friend: createdFriend }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[sendFriendRequest] Unexpected error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "deleteAccount");
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Supabase anon key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password.trim()) {
      return new Response(JSON.stringify({ error: "Passwort ist erforderlich." }), {
        status: 400,
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
    if (authError || !authData?.user?.id) {
      console.error("[deleteAccount] Unauthorized:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authUserId = authData.user.id;
    const authUserEmail = authData.user.email ?? null;

    if (!authUserEmail) {
      return new Response(JSON.stringify({ error: "Aktuelles Konto hat keine E-Mail-Adresse." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const verificationClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: passwordError } = await verificationClient.auth.signInWithPassword({
      email: authUserEmail,
      password,
    });

    if (passwordError) {
      return new Response(JSON.stringify({ error: "Passwort ist falsch oder ungültig." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Clean up temporary auth session created for password verification.
    await verificationClient.auth.signOut();

    const { data: cleanupResult, error: cleanupError } = await adminClient.rpc("delete_account_data_by_auth_id", {
      p_auth_id: authUserId,
      p_user_email: authUserEmail,
    });

    if (cleanupError) {
      console.error("[deleteAccount] Cleanup RPC failed:", cleanupError);
      return new Response(JSON.stringify({ error: "Kontodaten konnten nicht entfernt werden.", details: cleanupError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(authUserId);

    if (deleteAuthError) {
      console.error("[deleteAccount] Auth user deletion failed:", deleteAuthError);
      return new Response(JSON.stringify({ error: "Auth-Konto konnte nicht gelöscht werden.", details: deleteAuthError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Konto und zugehörige Daten wurden gelöscht.",
      cleanup: cleanupResult ?? null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[deleteAccount] Unexpected error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const supabaseUrl = Deno.env.get("FLORALOG_URL")
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })

    const requestBody = await req.json()
    const { legacyUserId } = requestBody

    if (!legacyUserId) {
      return new Response(
        JSON.stringify({ error: "Missing legacyUserId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Get legacy user from baseUser table
    const { data: legacyUser, error: legacyError } = await supabaseAdmin
      .from("baseUser")
      .select("*")
      .eq("id", legacyUserId)
      .single()

    if (legacyError || !legacyUser) {
      return new Response(
        JSON.stringify({ error: "Legacy user not found", details: legacyError }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Get current auth user from JWT token (decoded by Supabase automatically)
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      token.split(".")[0],
    )

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Invalid auth user" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Verify email matches (security check)
    const authEmail = (authUser?.email || "").toLowerCase().trim()
    const legacyEmail = (legacyUser.email || legacyUser.user_email || "").toLowerCase().trim()

    if (authEmail !== legacyEmail) {
      return new Response(
        JSON.stringify({
          error: "Email mismatch - cannot migrate",
          details: { authEmail, legacyEmail },
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const authUserId = authUser.id

    // Step 1: Update baseUser with auth_id
    const { error: updateBaseUserError } = await supabaseAdmin
      .from("baseUser")
      .update({ auth_id: authUserId })
      .eq("id", legacyUserId)

    if (updateBaseUserError) {
      return new Response(
        JSON.stringify({
          error: "Failed to update baseUser",
          details: updateBaseUserError,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const results = [
      {
        key: "baseUser",
        name: "Basisbenutzer verknüpft",
        updated: 1,
      },
    ]

    // Step 2: Update PublicProfile
    const { data: profileUpdates } = await supabaseAdmin
      .from("PublicProfile")
      .update({ auth_id: authUserId })
      .eq("user_email", legacyUser.email)
      .select("id", { count: "exact" })

    results.push({
      key: "profile",
      name: "📋 Mein Feldnotizbuch",
      updated: profileUpdates?.length || 0,
    })

    // Step 3: Update UserPlantDiscovery
    const { data: discoveryUpdates } = await supabaseAdmin
      .from("UserPlantDiscovery")
      .update({ user: authUserId })
      .eq("user", legacyUser.id)
      .select("id", { count: "exact" })

    results.push({
      key: "discoveries",
      name: "🔍 Vergessene Pflanzenfunde",
      updated: discoveryUpdates?.length || 0,
    })

    // Step 4: Update UserNotification
    const { data: notifUpdates } = await supabaseAdmin
      .from("UserNotification")
      .update({ user_email: authUser.email })
      .eq("user_email", legacyUser.email)
      .select("id", { count: "exact" })

    results.push({
      key: "notifications",
      name: "📬 Botaniker-Briefe",
      updated: notifUpdates?.length || 0,
    })

    // Step 5: Update UserQuest
    const { data: questUpdates } = await supabaseAdmin
      .from("UserQuest")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    results.push({
      key: "quests",
      name: "🗺️ Forschungsaufträge",
      updated: questUpdates?.length || 0,
    })

    // Step 6: Update UserWeeklyQuest
    const { data: weeklyUpdates } = await supabaseAdmin
      .from("UserWeeklyQuest")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    results.push({
      key: "weeklyQuests",
      name: "🌱 Wöchentliche Feldaufgaben",
      updated: weeklyUpdates?.length || 0,
    })

    // Step 7: Update UserMonthlyQuest
    const { data: monthlyUpdates } = await supabaseAdmin
      .from("UserMonthlyQuest")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    results.push({
      key: "monthlyQuests",
      name: "🌾 Monatliche Erntequoten",
      updated: monthlyUpdates?.length || 0,
    })

    // Step 8: Update Friend
    const { data: friendUpdates } = await supabaseAdmin
      .from("Friend")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    results.push({
      key: "friends",
      name: "👣 Forscher-Kollegen",
      updated: friendUpdates?.length || 0,
    })

    // Step 9: Update ScanLike
    const { data: likesUpdates } = await supabaseAdmin
      .from("ScanLike")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    results.push({
      key: "scanLikes",
      name: "⭐ Lieblingsfunde",
      updated: likesUpdates?.length || 0,
    })

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  } catch (err) {
    console.error("[migrateLegacyUser] Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }
})

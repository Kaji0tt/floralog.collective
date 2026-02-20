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
    console.log("[migrateLegacyUser] === REQUEST START ===")
    
    // Debug: Log all headers
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = key.toLowerCase().includes("auth") ? `${value.substring(0, 20)}...` : value
    })
    console.log("[migrateLegacyUser] Headers:", JSON.stringify(headers, null, 2))

    const supabaseUrl = Deno.env.get("FLORALOG_URL")
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")

    console.log("[migrateLegacyUser] Env check - URL:", supabaseUrl ? "✓" : "✗")
    console.log("[migrateLegacyUser] Env check - Service Role Key:", supabaseServiceRoleKey ? "✓" : "✗")

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[migrateLegacyUser] Missing environment variables!")
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Create admin client for updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })
    console.log("[migrateLegacyUser] Admin client created")

    const requestBody = await req.json()
    const { legacyUserId, accessToken } = requestBody
    console.log("[migrateLegacyUser] Request body - legacyUserId:", legacyUserId)
    console.log("[migrateLegacyUser] Request body - accessToken provided:", !!accessToken)

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || ""
    console.log("[migrateLegacyUser] Auth header found:", authHeader ? `${authHeader.substring(0, 30)}...` : "NONE")
    
    const headerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : authHeader.trim()
    const token = headerToken || accessToken

    console.log("[migrateLegacyUser] Token source:", headerToken ? "header" : (accessToken ? "body" : "none"))
    console.log("[migrateLegacyUser] Token length:", token ? token.length : 0)

    if (!token) {
      console.error("[migrateLegacyUser] No token found in header or body!")
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Validate token using service role
    console.log("[migrateLegacyUser] Validating token with admin.auth.getUser()...")
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    console.log("[migrateLegacyUser] Auth validation result - user:", authUser ? authUser.id : "null")
    console.log("[migrateLegacyUser] Auth validation result - error:", authError ? authError.message : "none")

    if (authError || !authUser) {
      console.error("[migrateLegacyUser] ❌ Auth validation FAILED")
      console.error("[migrateLegacyUser] Error details:", JSON.stringify(authError, null, 2))
      return new Response(
        JSON.stringify({ 
          error: "Invalid or missing auth token", 
          details: authError?.message,
          errorCode: authError?.code,
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20)
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    console.log("[migrateLegacyUser] ✅ Auth validation SUCCESS - User ID:", authUser.id)

    if (!legacyUserId) {
      console.error("[migrateLegacyUser] Missing legacyUserId in request body")
      return new Response(
        JSON.stringify({ error: "Missing legacyUserId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    console.log("[migrateLegacyUser] Fetching legacy user from baseUser table...")
    // Get legacy user from baseUser table
    const { data: legacyUser, error: legacyError } = await supabaseAdmin
      .from("baseUser")
      .select("*")
      .eq("id", legacyUserId)
      .single()

    console.log("[migrateLegacyUser] Legacy user fetch result:", legacyUser ? "found" : "not found")
    if (legacyError) {
      console.error("[migrateLegacyUser] Legacy user error:", JSON.stringify(legacyError, null, 2))
    }

    if (legacyError || !legacyUser) {
      console.error("[migrateLegacyUser] ❌ Legacy user not found or error occurred")
      return new Response(
        JSON.stringify({ error: "Legacy user not found", details: legacyError }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Verify email matches (security check)
    const authEmail = (authUser?.email || "").toLowerCase().trim()
    const legacyEmail = (legacyUser.email || legacyUser.user_email || "").toLowerCase().trim()

    console.log("[migrateLegacyUser] Email verification:")
    console.log("[migrateLegacyUser]   - Auth email:", authEmail)
    console.log("[migrateLegacyUser]   - Legacy email:", legacyEmail)
    console.log("[migrateLegacyUser]   - Match:", authEmail === legacyEmail ? "✓" : "✗")

    if (authEmail !== legacyEmail) {
      console.error("[migrateLegacyUser] ❌ Email mismatch - migration blocked!")
      return new Response(
        JSON.stringify({
          error: "Email mismatch - cannot migrate",
          details: { authEmail, legacyEmail },
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const authUserId = authUser.id
    console.log("[migrateLegacyUser] ✅ All validations passed!")
    console.log("[migrateLegacyUser] Starting migration for user:", authUserId)
    console.log("[migrateLegacyUser] Legacy user ID:", legacyUserId)

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

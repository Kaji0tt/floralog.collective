import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

console.log("[migrateLegacyUser] Function loaded successfully")

Deno.serve(async (req) => {
  console.log("[migrateLegacyUser] === REQUEST RECEIVED ===")
  console.log("[migrateLegacyUser] Method:", req.method)
  console.log("[migrateLegacyUser] URL:", req.url)
  
  if (req.method === "OPTIONS") {
    console.log("[migrateLegacyUser] Handling OPTIONS request")
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("[migrateLegacyUser] === PROCESSING REQUEST ===")
    
    const supabaseUrl = Deno.env.get("FLORALOG_URL")
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    const supabaseAnonKey = Deno.env.get("FLORALOG_ANON_KEY")

    console.log("[migrateLegacyUser] Env check - URL:", supabaseUrl ? "✓" : "✗")
    console.log("[migrateLegacyUser] Env check - Service Role Key:", supabaseServiceRoleKey ? "✓ (length: " + (supabaseServiceRoleKey?.length || 0) + ")" : "✗")
    console.log("[migrateLegacyUser] Env check - Anon Key:", supabaseAnonKey ? "✓" : "✗")

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      console.error("[migrateLegacyUser] Missing environment variables!")
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Create Supabase client with anon key to access the user's session
    // The Authorization header is automatically passed by the Supabase client library
    const authHeader = req.headers.get("authorization") ?? ""
    console.log("[migrateLegacyUser] Authorization header length:", authHeader.length)

    // Create admin client for updates (needed for both auth validation and data migration)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    // Get authenticated user - Supabase Gateway has already validated the JWT
    console.log("[migrateLegacyUser] Getting authenticated user...")
    let { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser()

    console.log("[migrateLegacyUser] Auth user result:", authUser ? authUser.id : "null")
    if (authError) {
      console.error("[migrateLegacyUser] Auth error:", JSON.stringify(authError, null, 2))
    }

    if (authError || !authUser) {
      console.error("[migrateLegacyUser] ❌ Auth validation FAILED - trying with JWT from request")
      
      // Fallback: Try to extract JWT from Authorization header manually
      const token = authHeader.replace("Bearer ", "").trim()
      if (!token) {
        return new Response(
          JSON.stringify({ 
            error: "No authentication token found", 
            details: "Authorization header is missing or empty" 
          }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }

      // Validate JWT using service role client (bypasses RLS)
      const { data: { user: validatedUser }, error: validationError } = await supabaseAdmin.auth.getUser(token)
      console.log("[migrateLegacyUser] Manual JWT validation:", validatedUser ? validatedUser.id : "null")
      
      if (validationError || !validatedUser) {
        console.error("[migrateLegacyUser] Manual validation also failed:", validationError)
        return new Response(
          JSON.stringify({ 
            error: "Invalid or missing auth session", 
            details: validationError?.message 
          }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }

      // Use the manually validated user
      authUser = validatedUser
    }

    console.log("[migrateLegacyUser] ✅ Auth validation SUCCESS - User ID:", authUser.id)
    console.log("[migrateLegacyUser] User email:", authUser.email)
    console.log("[migrateLegacyUser] Admin client ready for migration")

    const requestBody = await req.json()
    const { legacyUserId } = requestBody
    console.log("[migrateLegacyUser] Request body - legacyUserId:", legacyUserId)

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
  } catch (error) {
    console.error("[migrateLegacyUser] CAUGHT ERROR:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[migrateLegacyUser] Error message:", errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }
})

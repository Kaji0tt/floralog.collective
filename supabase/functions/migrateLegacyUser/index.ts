import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
}

console.log("[migrateLegacyUser] Function loaded successfully")

Deno.serve(async (req) => {
  console.log("[migrateLegacyUser] === REQUEST RECEIVED ===")
  console.log("[migrateLegacyUser] Method:", req.method)
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[migrateLegacyUser] Handling OPTIONS request")
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }

  try {
    console.log("[migrateLegacyUser] === PROCESSING REQUEST ===")
    
    const requestBody = await req.json()
    const { email, legacyUserId } = requestBody
    
    console.log("[migrateLegacyUser] Request body - email:", email)
    console.log("[migrateLegacyUser] Request body - legacyUserId:", legacyUserId)

    // Security Check 1: Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.error("[migrateLegacyUser] ❌ Invalid email:", email)
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Security Check 2: Validate Legacy ID (must be 24 hex chars - MongoDB ObjectID format)
    if (!legacyUserId || typeof legacyUserId !== 'string' || !/^[0-9a-f]{24}$/.test(legacyUserId)) {
      console.error("[migrateLegacyUser] ❌ Invalid legacy user ID:", legacyUserId)
      return new Response(
        JSON.stringify({ error: "Invalid legacy user ID format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    console.log("[migrateLegacyUser] ✅ Security checks passed")

    const supabaseUrl = Deno.env.get("FLORALOG_URL")
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")

    console.log("[migrateLegacyUser] Env check - URL:", supabaseUrl ? "✓" : "✗")
    console.log("[migrateLegacyUser] Env check - Service Role Key:", supabaseServiceRoleKey ? "✓" : "✗")

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[migrateLegacyUser] Missing environment variables")
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })
    console.log("[migrateLegacyUser] Admin client created")

    console.log("[migrateLegacyUser] Fetching legacy user from baseUser table...")
    // Get legacy user from baseUser table
    const { data: legacyUser, error: legacyError } = await supabaseAdmin
      .from("baseUser")
      .select("id,email,display_name,auth_id,created_date,updated_date")
      .eq("id", legacyUserId)
      .single()

    console.log("[migrateLegacyUser] Legacy user fetch result:", legacyUser ? "found" : "not found")
    if (legacyError) {
      console.error("[migrateLegacyUser] Legacy user error:", JSON.stringify(legacyError, null, 2))
    }

    if (legacyError || !legacyUser) {
      console.error("[migrateLegacyUser] ❌ Legacy user not found")
      return new Response(
        JSON.stringify({ error: "Legacy user not found", details: legacyError?.message }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Verify email matches (security check)
    const legacyEmail = (legacyUser.email || "").toLowerCase().trim()
    const requestEmail = email.toLowerCase().trim()

    console.log("[migrateLegacyUser] Email verification:")
    console.log("[migrateLegacyUser]   - Request email:", requestEmail)
    console.log("[migrateLegacyUser]   - Legacy email:", legacyEmail)
    console.log("[migrateLegacyUser]   - Match:", requestEmail === legacyEmail ? "✓" : "✗")

    if (requestEmail !== legacyEmail) {
      console.error("[migrateLegacyUser] ❌ Email mismatch - migration blocked!")
      return new Response(
        JSON.stringify({ error: "Email mismatch - cannot migrate" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    // Get the auth user from Supabase Auth (search by email to get their ID)
    console.log("[migrateLegacyUser] Fetching auth user by email...")
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    const authUser = users?.find(u => u.email?.toLowerCase() === requestEmail)

    if (!authUser) {
      console.error("[migrateLegacyUser] ❌ Auth user not found for email:", requestEmail)
      return new Response(
        JSON.stringify({ error: "Auth user not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    console.log("[migrateLegacyUser] ✅ Auth user found:", authUser.id)
    const authUserId = authUser.id

    console.log("[migrateLegacyUser] ✅ All validations passed!")
    console.log("[migrateLegacyUser] Starting migration for user:", authUserId)
    console.log("[migrateLegacyUser] Legacy user ID:", legacyUserId)

    // Step 1: Update baseUser with auth_id
    console.log("[migrateLegacyUser] Step 1: Updating baseUser...")
    const { error: updateBaseUserError } = await supabaseAdmin
      .from("baseUser")
      .update({ auth_id: authUserId })
      .eq("id", legacyUserId)

    if (updateBaseUserError) {
      console.error("[migrateLegacyUser] Failed to update baseUser:", updateBaseUserError)
      return new Response(
        JSON.stringify({
          error: "Failed to update baseUser",
          details: updateBaseUserError,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }
    console.log("[migrateLegacyUser] ✅ baseUser updated")

    const results = [
      {
        key: "baseUser",
        name: "Basisbenutzer verknüpft",
        updated: 1,
      },
    ]

    // Step 2: Update and backfill PublicProfile (auth_id + display_name)
    console.log("[migrateLegacyUser] Step 2: Updating PublicProfile...")
    const fallbackDisplayName = String(
      legacyUser.display_name ||
      requestEmail.split("@")[0]
    ).trim()
    const fallbackFullName = String(
      legacyUser.display_name ||
      fallbackDisplayName
    ).trim()
    const timestamp = new Date().toISOString()

    const { data: linkedProfiles, error: linkProfilesError } = await supabaseAdmin
      .from("PublicProfile")
      .update({ auth_id: authUserId })
      .eq("user_email", legacyUser.email)
      .select("id, display_name, full_name, user_email")

    if (linkProfilesError) {
      console.error("[migrateLegacyUser] PublicProfile auth_id link error:", linkProfilesError)
    }

    let profileUpdatedCount = linkedProfiles?.length || 0

    if ((linkedProfiles?.length || 0) > 0) {
      for (const profile of linkedProfiles || []) {
        const updates: Record<string, string> = { updated_date: timestamp }

        if (!profile.display_name?.trim() && fallbackDisplayName) {
          updates.display_name = fallbackDisplayName
        }

        if (!profile.full_name?.trim() && fallbackFullName) {
          updates.full_name = fallbackFullName
        }

        if (!profile.user_email) {
          updates.user_email = requestEmail
        }

        if (Object.keys(updates).length > 1) {
          const { error: profileBackfillError } = await supabaseAdmin
            .from("PublicProfile")
            .update(updates)
            .eq("id", profile.id)

          if (profileBackfillError) {
            console.error("[migrateLegacyUser] PublicProfile backfill update error:", profileBackfillError)
          }
        }
      }
    } else if (fallbackDisplayName) {
      const { error: createProfileError } = await supabaseAdmin
        .from("PublicProfile")
        .insert({
          id: authUserId,
          auth_id: authUserId,
          user_email: requestEmail,
          display_name: fallbackDisplayName,
          full_name: fallbackFullName,
          created_date: timestamp,
          updated_date: timestamp,
        })

      if (createProfileError) {
        console.error("[migrateLegacyUser] PublicProfile create error:", createProfileError)
      } else {
        profileUpdatedCount = 1
      }
    }

    if (fallbackDisplayName) {
      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          display_name: fallbackDisplayName,
          full_name: fallbackFullName,
          name: fallbackDisplayName,
          migrated_from_legacy: true,
        },
      })

      if (metadataError) {
        console.error("[migrateLegacyUser] Auth metadata backfill error:", metadataError)
      }
    }

    console.log("[migrateLegacyUser] ✅ PublicProfile updated:", profileUpdatedCount)
    results.push({
      key: "profile",
      name: "📋 Mein Feldnotizbuch",
      updated: profileUpdatedCount,
    })

    // Step 3: Update UserPlantDiscovery
    console.log("[migrateLegacyUser] Step 3: Updating UserPlantDiscovery...")
    const { data: discoveryUpdates } = await supabaseAdmin
      .from("UserPlantDiscovery")
      .update({ user: authUserId })
      .eq("user", legacyUser.id)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ UserPlantDiscovery updated:", discoveryUpdates?.length || 0)
    results.push({
      key: "discoveries",
      name: "🔍 Vergessene Pflanzenfunde",
      updated: discoveryUpdates?.length || 0,
    })

    // Step 4: Update UserNotification
    console.log("[migrateLegacyUser] Step 4: Updating UserNotification...")
    const { data: notifUpdates } = await supabaseAdmin
      .from("UserNotification")
      .update({ user_email: authUser.email })
      .eq("user_email", legacyUser.email)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ UserNotification updated:", notifUpdates?.length || 0)
    results.push({
      key: "notifications",
      name: "📬 Botaniker-Briefe",
      updated: notifUpdates?.length || 0,
    })

    // Step 5: Update UserQuest
    console.log("[migrateLegacyUser] Step 5: Updating UserQuest...")
    const { data: questUpdates } = await supabaseAdmin
      .from("UserQuest")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ UserQuest updated:", questUpdates?.length || 0)
    results.push({
      key: "quests",
      name: "🗺️ Forschungsaufträge",
      updated: questUpdates?.length || 0,
    })

    // Step 6: Update UserWeeklyQuest
    console.log("[migrateLegacyUser] Step 6: Updating UserWeeklyQuest...")
    const { data: weeklyUpdates } = await supabaseAdmin
      .from("UserWeeklyQuest")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ UserWeeklyQuest updated:", weeklyUpdates?.length || 0)
    results.push({
      key: "weeklyQuests",
      name: "🌱 Wöchentliche Feldaufgaben",
      updated: weeklyUpdates?.length || 0,
    })

    // Step 7: Update UserMonthlyQuest
    console.log("[migrateLegacyUser] Step 7: Updating UserMonthlyQuest...")
    const { data: monthlyUpdates } = await supabaseAdmin
      .from("UserMonthlyQuest")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ UserMonthlyQuest updated:", monthlyUpdates?.length || 0)
    results.push({
      key: "monthlyQuests",
      name: "🌾 Monatliche Erntequoten",
      updated: monthlyUpdates?.length || 0,
    })

    // Step 8: Update Friend
    console.log("[migrateLegacyUser] Step 8: Updating Friend...")
    const { data: friendUpdates } = await supabaseAdmin
      .from("Friend")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ Friend updated:", friendUpdates?.length || 0)
    results.push({
      key: "friends",
      name: "👣 Forscher-Kollegen",
      updated: friendUpdates?.length || 0,
    })

    // Step 9: Update ScanLike
    console.log("[migrateLegacyUser] Step 9: Updating ScanLike...")
    const { data: likesUpdates } = await supabaseAdmin
      .from("ScanLike")
      .update({ created_by: authUserId })
      .eq("created_by", legacyUser.id)
      .select("id", { count: "exact" })

    console.log("[migrateLegacyUser] ✅ ScanLike updated:", likesUpdates?.length || 0)
    results.push({
      key: "scanLikes",
      name: "⭐ Lieblingsfunde",
      updated: likesUpdates?.length || 0,
    })

    console.log("[migrateLegacyUser] ✅ MIGRATION COMPLETE!")
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

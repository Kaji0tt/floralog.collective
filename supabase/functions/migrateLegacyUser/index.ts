import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const { email, auth_id } = requestBody

    console.log("[migrateLegacyUser] Request body - email:", email)
    console.log("[migrateLegacyUser] Request body - auth_id:", auth_id)

    // Security Check: Validate email and auth_id
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.error("[migrateLegacyUser] ❌ Invalid email:", email)
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }
    if (!auth_id || typeof auth_id !== 'string' || auth_id.length < 10) {
      console.error("[migrateLegacyUser] ❌ Invalid auth_id:", auth_id)
      return new Response(
        JSON.stringify({ error: "Invalid auth_id" }),
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


    // Suche baseUser anhand von auth_id oder email
    console.log("[migrateLegacyUser] Fetching user from baseUser table...")
    let { data: baseUser, error: baseUserError } = await supabaseAdmin
      .from("baseUser")
      .select("id,email,display_name,auth_id,created_date,updated_date")
      .eq("auth_id", auth_id)
      .single()

    if (!baseUser) {
      // Fallback: Suche per Email
      const { data: fallbackUser, error: fallbackError } = await supabaseAdmin
        .from("baseUser")
        .select("id,email,display_name,auth_id,created_date,updated_date")
        .eq("email", email)
        .single()
      baseUser = fallbackUser
      baseUserError = fallbackError
    }

    if (baseUserError || !baseUser) {
      console.error("[migrateLegacyUser] ❌ baseUser not found")
      return new Response(
        JSON.stringify({ error: "baseUser not found", details: baseUserError?.message }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const requestEmail = email.toLowerCase().trim()
    const userEmail = (baseUser.email || "").toLowerCase().trim()
    if (requestEmail !== userEmail) {
      console.error("[migrateLegacyUser] ❌ Email mismatch - migration blocked!")
      return new Response(
        JSON.stringify({ error: "Email mismatch - cannot migrate" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }


    const authUserId = auth_id

    console.log("[migrateLegacyUser] ✅ All validations passed!")
    console.log("[migrateLegacyUser] Starting migration for user:", authUserId)


    // Step 1: Update baseUser with auth_id (falls noch nicht gesetzt)
    console.log("[migrateLegacyUser] Step 1: Updating baseUser...")
    let baseUserUpdated = 0
    if (!baseUser.auth_id) {
      const { error: updateBaseUserError } = await supabaseAdmin
        .from("baseUser")
        .update({ auth_id: authUserId })
        .eq("id", baseUser.id)
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
      baseUserUpdated = 1
    }
    console.log("[migrateLegacyUser] ✅ baseUser updated")

    const results = [
      {
        key: "baseUser",
        name: "Basisbenutzer verknüpft",
        updated: baseUserUpdated,
      },
    ]

    // Step 2: Update and backfill PublicProfile (auth_id + display_name)
    console.log("[migrateLegacyUser] Step 2: Updating PublicProfile...")

    const fallbackDisplayName = String(
      baseUser.display_name ||
      requestEmail.split("@")[0]
    ).trim()
    const fallbackFullName = String(
      baseUser.display_name ||
      fallbackDisplayName
    ).trim()
    const timestamp = new Date().toISOString()


    const { data: linkedProfiles, error: linkProfilesError } = await supabaseAdmin
      .from("PublicProfile")
      .update({ auth_id: authUserId })
      .eq("user_email", userEmail)
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

    // Optional: User-Metadaten setzen, falls gewünscht (hier nicht mehr nötig, da kein authUser geladen wird)

    console.log("[migrateLegacyUser] ✅ PublicProfile updated:", profileUpdatedCount)
    results.push({
      key: "profile",
      name: "📋 Mein Feldnotizbuch",
      updated: profileUpdatedCount,
    })



    // Step 3: Update UserPlantDiscovery (auth_id)
    console.log("[migrateLegacyUser] Step 3: Updating UserPlantDiscovery...")
    const { data: discoveryUpdates, error: discoveryError } = await supabaseAdmin
      .from("UserPlantDiscovery")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (discoveryError) {
      console.error("[migrateLegacyUser] UserPlantDiscovery update error:", discoveryError)
    }

    console.log("[migrateLegacyUser] ✅ UserPlantDiscovery updated:", discoveryUpdates?.length || 0)
    results.push({
      key: "discoveries",
      name: "🔍 Vergessene Pflanzenfunde",
      updated: discoveryUpdates?.length || 0,
    })



    // Step 4: Update UserNotification (user_email und auth_id)
    console.log("[migrateLegacyUser] Step 4: Updating UserNotification...")
    const { data: notifUpdates, error: notifError } = await supabaseAdmin
      .from("UserNotification")
      .update({ auth_id: authUserId })
      .eq("user_email", userEmail)
      .select("id", { count: "exact" })

    if (notifError) {
      console.error("[migrateLegacyUser] UserNotification update error:", notifError)
    }

    console.log("[migrateLegacyUser] ✅ UserNotification updated:", notifUpdates?.length || 0)
    results.push({
      key: "notifications",
      name: "📬 Botaniker-Briefe",
      updated: notifUpdates?.length || 0,
    })


    // Step 5: Update UserQuest
    console.log("[migrateLegacyUser] Step 5: Updating UserQuest...")
    const { data: questUpdates, error: questError } = await supabaseAdmin
      .from("UserQuest")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (questError) {
      console.error("[migrateLegacyUser] UserQuest update error:", questError)
    }

    console.log("[migrateLegacyUser] ✅ UserQuest updated:", questUpdates?.length || 0)
    results.push({
      key: "quests",
      name: "🗺️ Forschungsaufträge",
      updated: questUpdates?.length || 0,
    })
    

    // Step 6: Update UserWeeklyQuest
    console.log("[migrateLegacyUser] Step 6: Updating UserWeeklyQuest...")
    const { data: weeklyUpdates, error: weeklyError } = await supabaseAdmin
      .from("UserWeeklyQuest")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (weeklyError) {
      console.error("[migrateLegacyUser] UserWeeklyQuest update error:", weeklyError)
    }

    console.log("[migrateLegacyUser] ✅ UserWeeklyQuest updated:", weeklyUpdates?.length || 0)
    results.push({
      key: "weeklyQuests",
      name: "🌱 Wöchentliche Feldaufgaben",
      updated: weeklyUpdates?.length || 0,
    })


    // Step 7: Update UserMonthlyQuest
    console.log("[migrateLegacyUser] Step 7: Updating UserMonthlyQuest...")
    const { data: monthlyUpdates, error: monthlyError } = await supabaseAdmin
      .from("UserMonthlyQuest")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (monthlyError) {
      console.error("[migrateLegacyUser] UserMonthlyQuest update error:", monthlyError)
    }

    console.log("[migrateLegacyUser] ✅ UserMonthlyQuest updated:", monthlyUpdates?.length || 0)
    results.push({
      key: "monthlyQuests",
      name: "🌾 Monatliche Erntequoten",
      updated: monthlyUpdates?.length || 0,
    })



    // Step 8: Update Friend (created_by und auth_id)
    console.log("[migrateLegacyUser] Step 8: Updating Friend...")
    const { data: friendUpdates, error: friendError } = await supabaseAdmin
      .from("Friend")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (friendError) {
      console.error("[migrateLegacyUser] Friend update error:", friendError)
    }

    console.log("[migrateLegacyUser] ✅ Friend updated:", friendUpdates?.length || 0)
    results.push({
      key: "friends",
      name: "👣 Forscher-Kollegen",
      updated: friendUpdates?.length || 0,
    })



    // Step 9: Update ScanLike (created_by und auth_id)
    console.log("[migrateLegacyUser] Step 9: Updating ScanLike...")
    const { data: likesUpdates, error: likesError } = await supabaseAdmin
      .from("ScanLike")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (likesError) {
      console.error("[migrateLegacyUser] ScanLike update error:", likesError)
    }

    console.log("[migrateLegacyUser] ✅ ScanLike updated:", likesUpdates?.length || 0)
    results.push({
      key: "scanLikes",
      name: "⭐ Lieblingsfunde",
      updated: likesUpdates?.length || 0,
    })


    // Step 10: Update UserAchievement
    console.log("[migrateLegacyUser] Step 10: Updating UserAchievement...")
    const { data: achievementUpdates, error: achievementError } = await supabaseAdmin
      .from("UserAchievement")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (achievementError) {
      console.error("[migrateLegacyUser] UserAchievement update error:", achievementError)
    }

    console.log("[migrateLegacyUser] UserAchievement updated:", achievementUpdates?.length || 0)
    results.push({
      key: "userAchievements",
      name: "🏆 Erfolge",
      updated: achievementUpdates?.length || 0,
    });


    // Step 11: Update UserRewards
    console.log("[migrateLegacyUser] Step 11: Updating UserRewards...")
    const { data: rewardUpdates, error: rewardError } = await supabaseAdmin
      .from("UserRewards")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (rewardError) {
      console.error("[migrateLegacyUser] UserRewards update error:", rewardError)
    }

    console.log("[migrateLegacyUser] UserRewards updated:", rewardUpdates?.length || 0)
    results.push({
      key: "userRewards",
      name: "🎁 Belohnungen",
      updated: rewardUpdates?.length || 0,
    });


    // Step 12: Grant legacy background reward for early users
    console.log("[migrateLegacyUser] Step 12: Granting legacy background reward (if eligible)...")

    let legacyRewardGranted = 0
    try {
      const cutoffDate = new Date("2026-02-28T00:00:00Z")
      const createdDate = baseUser.created_date ? new Date(baseUser.created_date) : null

      if (createdDate && createdDate < cutoffDate) {
        const legacyRewardName = "legacy_background_2026"

        const { data: legacyReward, error: legacyRewardError } = await supabaseAdmin
          .from("Rewards")
          .select("id, display_name")
          .eq("name", legacyRewardName)
          .maybeSingle()

        if (legacyRewardError) {
          console.error("[migrateLegacyUser] Legacy reward lookup error:", legacyRewardError)
        } else if (legacyReward?.id) {
          const { data: existingUserReward, error: existingUserRewardError } = await supabaseAdmin
            .from("UserRewards")
            .select("id")
            .eq("auth_id", authUserId)
            .eq("reward_id", legacyReward.id)
            .maybeSingle()

          if (existingUserRewardError) {
            console.error("[migrateLegacyUser] Legacy UserReward lookup error:", existingUserRewardError)
          } else if (!existingUserReward) {
            const displayName = fallbackDisplayName || userEmail
            const timestampLegacy = new Date().toISOString()

            const { error: legacyInsertError } = await supabaseAdmin
              .from("UserRewards")
              .insert({
                reward_id: legacyReward.id,
                reward_name: legacyReward.display_name,
                auth_id: authUserId,
                user_email: userEmail,
                user_name: displayName,
                unlocked_date: timestampLegacy,
              })

            if (legacyInsertError) {
              console.error("[migrateLegacyUser] Failed to insert legacy UserReward:", legacyInsertError)
            } else {
              legacyRewardGranted = 1
              console.log("[migrateLegacyUser] ✅ Legacy background reward granted")
            }
          }
        }
      }
    } catch (legacyError) {
      console.error("[migrateLegacyUser] Unexpected error while granting legacy reward:", legacyError)
    }

    results.push({
      key: "legacyReward",
      name: "🌅 Früher-Vogel-Hintergrund",
      updated: legacyRewardGranted,
    })


    // Step 13: Update Referral
    console.log("[migrateLegacyUser] Step 12: Updating Referral...")
    const { data: referralUpdates, error: referralError } = await supabaseAdmin
      .from("Referral")
      .update({ auth_id: authUserId })
      .eq("created_by", userEmail)
      .select("id", { count: "exact" })

    if (referralError) {
      console.error("[migrateLegacyUser] Referral update error:", referralError)
    }

    console.log("[migrateLegacyUser] Referral updated:", referralUpdates?.length || 0)
    results.push({
      key: "referrals",
      name: "🔗 Empfehlungen",
      updated: referralUpdates?.length || 0,
    });


    // Step 13: Update SharedScan (auth_id_from) -> Wont be updated

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

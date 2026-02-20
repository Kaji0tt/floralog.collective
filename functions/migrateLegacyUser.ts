import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MIGRATION_STEPS = [
  {
    key: "profile",
    name: "📋 Mein Feldnotizbuch",
    tableName: "PublicProfile",
    filterField: "user_email"
  },
  {
    key: "discoveries",
    name: "🔍 Vergessene Pflanzenfunde",
    tableName: "UserPlantDiscovery",
    filterField: "user"
  },
  {
    key: "notifications",
    name: "📬 Botaniker-Briefe",
    tableName: "UserNotification",
    filterField: "user_email"
  },
  {
    key: "quests",
    name: "🗺️ Forschungsaufträge",
    tableName: "UserQuest",
    filterField: "created_by"
  },
  {
    key: "weeklyQuests",
    name: "🌱 Wöchentliche Feldaufgaben",
    tableName: "UserWeeklyQuest",
    filterField: "created_by"
  },
  {
    key: "monthlyQuests",
    name: "🌾 Monatliche Erntequoten",
    tableName: "UserMonthlyQuest",
    filterField: "created_by"
  },
  {
    key: "friends",
    name: "👣 Forscher-Kollegen",
    tableName: "Friend",
    filterField: "created_by"
  },
  {
    key: "sharedScans",
    name: "🔬 Geteilte Beobachtungen",
    tableName: "SharedScan",
    filterField: null
  },
  {
    key: "scanLikes",
    name: "⭐ Lieblingsfunde",
    tableName: "ScanLike",
    filterField: "created_by"
  }
];

const normalizeEmail = (value: string | null | undefined) => {
  if (!value) return null;
  return value.trim().toLowerCase();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return Response.json(
        { error: "Missing Supabase configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Missing authorization" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { legacyUserId } = await req.json();
    if (!legacyUserId) {
      return Response.json(
        { error: "Missing legacyUserId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return Response.json(
        { error: "Invalid auth session" },
        { status: 401, headers: corsHeaders }
      );
    }

    const authUser = userData.user;
    const authEmail = normalizeEmail(authUser.email || "");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: baseUser, error: baseUserError } = await admin
      .from("baseUser")
      .select("*")
      .eq("id", legacyUserId)
      .single();

    if (baseUserError || !baseUser) {
      return Response.json(
        { error: "Legacy user not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const legacyEmail = normalizeEmail(baseUser.email || baseUser.user_email || "");
    if (!authEmail || !legacyEmail || authEmail !== legacyEmail) {
      return Response.json(
        { error: "Email does not match legacy user" },
        { status: 403, headers: corsHeaders }
      );
    }

    const { error: linkError } = await admin
      .from("baseUser")
      .update({ auth_id: authUser.id })
      .eq("id", legacyUserId);

    if (linkError) {
      return Response.json(
        { error: "Failed to link legacy user" },
        { status: 500, headers: corsHeaders }
      );
    }

    const possibleValues = [
      authUser.email,
      baseUser.user_email,
      baseUser.created_by,
      baseUser.display_name,
      baseUser.full_name,
      baseUser.username,
      legacyUserId
    ].filter(Boolean);

    const results = [] as Array<{ key: string; name: string; updated: number }>;

    for (const step of MIGRATION_STEPS) {
      let updatedCount = 0;

      if (step.key === "sharedScans") {
        const { data: dataFrom, error: errorFrom } = await admin
          .from(step.tableName)
          .update({ auth_id_from: authUser.id })
          .in("shared_by", possibleValues)
          .select("id");

        if (errorFrom) {
          console.error(`[migrateLegacyUser] ${step.tableName} auth_id_from error:`, errorFrom);
        }

        const { data: dataTo, error: errorTo } = await admin
          .from(step.tableName)
          .update({ auth_id_to: authUser.id })
          .in("shared_to", possibleValues)
          .select("id");

        if (errorTo) {
          console.error(`[migrateLegacyUser] ${step.tableName} auth_id_to error:`, errorTo);
        }

        updatedCount = (dataFrom?.length || 0) + (dataTo?.length || 0);
      } else if (step.filterField) {
        const { data, error } = await admin
          .from(step.tableName)
          .update({ auth_id: authUser.id })
          .in(step.filterField, possibleValues)
          .select("id");

        if (error) {
          console.error(`[migrateLegacyUser] ${step.tableName} error:`, error);
        }

        updatedCount = data?.length || 0;
      }

      results.push({ key: step.key, name: step.name, updated: updatedCount });
    }

    return Response.json(
      { success: true, userId: authUser.id, results },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("migrateLegacyUser error:", error);
    return Response.json(
      { error: "Unexpected error" },
      { status: 500, headers: corsHeaders }
    );
  }
});

import { supabase } from "@/api/supabaseClient";

const getCurrentAuthId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const authId = data?.user?.id;
  if (!authId) {
    throw new Error("Authenticated user is required");
  }

  return authId;
};

export const getActiveZoneLootboxPool = async ({ zoneTheme = null, poolId = null } = {}) => {
  let query = supabase
    .from("ZoneLootboxPool")
    .select("id, zone_theme, name, description, is_active, entries:ZoneLootboxEntry(id, reward_id, weight, duplicate_seed_value, reward:Rewards(id, name, display_name, type, value, image_url))")
    .eq("is_active", true);

  if (poolId) {
    query = query.eq("id", poolId);
  }

  if (zoneTheme) {
    query = query.or(`zone_theme.eq.${zoneTheme},zone_theme.is.null`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;

  return data;
};

export const claimZoneLootbox = async ({ poolId = null, zoneTheme = null, zoneId = null, claimKey = null } = {}) => {
  const authId = await getCurrentAuthId();

  const { data, error } = await supabase.functions.invoke("claimZoneLootbox", {
    body: {
      authId,
      poolId,
      zoneTheme,
      zoneId,
      claimKey,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Zone-Lootbox-Claim fehlgeschlagen.");
  }

  return data;
};

export const getUserZoneLootboxClaims = async ({ claimKey = null } = {}) => {
  const authId = await getCurrentAuthId();

  let query = supabase
    .from("ZoneLootboxClaim")
    .select("id, pool_id, claim_key, reward_id, reward_status, duplicate_seed_value, metadata, created_at")
    .eq("auth_id", authId);

  if (claimKey) {
    query = query.eq("claim_key", claimKey);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  return Array.isArray(data) ? data : [];
};

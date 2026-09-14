import { supabase } from "@/api/supabaseClient";

export async function getPublicPlayerProfile(authId) {
  const normalizedAuthId = String(authId || "").trim();
  if (!normalizedAuthId) return null;

  const { data, error } = await supabase.rpc("get_public_player_profile", {
    p_auth_id: normalizedAuthId,
  });

  if (error) throw error;
  return data && typeof data === "object" ? data : null;
}

export async function getFriendshipStatus(authId) {
  const normalizedAuthId = String(authId || "").trim();
  if (!normalizedAuthId) return null;

  const { data, error } = await supabase.rpc("get_friendship_status", {
    p_target_auth_id: normalizedAuthId,
  });

  if (error) throw error;
  return typeof data === "string" ? data : null;
}
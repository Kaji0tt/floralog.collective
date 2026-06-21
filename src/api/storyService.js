import { supabase } from "@/api/supabaseClient";

const normalizeSeenIds = (value) => {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
};

export const getUserStory = async (authId) => {
  if (!authId) return null;

  const { data, error } = await supabase
    .from("UserStory")
    .select("*")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const ensureUserStoryRow = async ({ authId, storyVersion = "v1" }) => {
  if (!authId) {
    throw new Error("authId is required");
  }

  const { data, error } = await supabase.rpc("ensure_user_story_row", {
    p_auth_id: authId,
    p_story_version: storyVersion,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
};

export const updateUserStory = async (authId, patch) => {
  if (!authId) {
    throw new Error("authId is required");
  }

  const { data, error } = await supabase
    .from("UserStory")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("auth_id", authId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const mergeSeenMilestoneIds = (currentSeenIds, idsToAdd) => {
  return normalizeSeenIds([...(currentSeenIds || []), ...(idsToAdd || [])]);
};

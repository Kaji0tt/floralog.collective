import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const buildRewardDedupKey = (entry) => {
  if (!entry || typeof entry !== "object") return "";

  if (entry.id) return `id:${String(entry.id)}`;

  const rewardId = String(entry.reward_id || "").trim();
  const authId = String(entry.auth_id || "").trim();
  const userEmail = normalizeEmail(entry.user_email);

  if (rewardId || authId || userEmail) {
    return `reward:${rewardId}|auth:${authId}|email:${userEmail}`;
  }

  return "";
};

const mergeRewards = (...lists) => {
  const seen = new Set();
  const merged = [];

  for (const list of lists) {
    for (const entry of Array.isArray(list) ? list : []) {
      const dedupKey = buildRewardDedupKey(entry);
      if (dedupKey && seen.has(dedupKey)) continue;
      if (dedupKey) seen.add(dedupKey);
      merged.push(entry);
    }
  }

  return merged;
};

export const listUserRewardsWithLegacyFallback = async ({ authId = null, userEmail = null } = {}) => {
  const normalizedAuthId = String(authId || "").trim();
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedAuthId && !normalizedEmail) return [];

  const rewardsByAuthId = normalizedAuthId
    ? await Query.UserReward.filter({ auth_id: normalizedAuthId })
    : [];

  if (!normalizedEmail) {
    return Array.isArray(rewardsByAuthId) ? rewardsByAuthId : [];
  }

  const { data: rewardsByEmail, error: rewardsByEmailError } = await supabase
    .from("UserRewards")
    .select("*")
    .ilike("user_email", normalizedEmail);

  if (rewardsByEmailError) {
    console.warn("[userRewardService] Failed to load legacy rewards by email:", rewardsByEmailError);
  }

  return mergeRewards(rewardsByAuthId, rewardsByEmail || []);
};

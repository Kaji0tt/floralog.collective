import { supabase } from "@/api/supabaseClient";

const callRpc = async (name, params) => {
  const { data, error } = await supabase.rpc(name, params);

  if (error) {
    throw error;
  }

  return data;
};

export const createCommunityTag = ({ plantId = null, genusId = null, value }) =>
  callRpc("create_community_tag", {
    p_plant_id: plantId,
    p_genus_id: genusId,
    p_value: value,
  });

export const castCommunityTagVote = ({ tagId, vote = null }) =>
  callRpc("cast_community_tag_vote", {
    p_tag_id: tagId,
    p_vote: vote,
  }).then((data) => (Array.isArray(data) ? data[0] ?? null : data));

export const deleteCommunityTag = (tagId) =>
  callRpc("delete_community_tag", { p_tag_id: tagId });

export const reportCommunityTag = ({ tagId, reason }) =>
  callRpc("report_community_tag", {
    p_tag_id: tagId,
    p_reason: reason,
  });

export const moderateCommunityTag = ({ tagId, status }) =>
  callRpc("moderate_community_tag", {
    p_tag_id: tagId,
    p_status: status,
  });

export const getCommunityTagPersonalStats = () =>
  callRpc("get_community_tag_personal_stats", {}).then((data) =>
    Array.isArray(data) ? data[0] ?? null : data
  );
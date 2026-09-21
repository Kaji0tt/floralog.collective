import { supabase } from "@/api/supabaseClient";

const INVITE_ERROR_MESSAGES = {
  invite_expired: "Diese Einladung ist abgelaufen.",
  invite_not_pending: "Diese Einladung ist nicht mehr offen.",
  invite_not_found: "Diese Einladung wurde nicht gefunden.",
  recipient_not_friend: "Die Person ist nicht mit dir befreundet.",
  zone_not_owned_or_inactive: "Diese Zone ist nicht mehr aktiv.",
};

const invokeRpc = async (name, args) => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const message = INVITE_ERROR_MESSAGES[error.message] || error.message;
    throw new Error(message);
  }
  return data;
};

export const createZoneSharedInvite = ({ recipientAuthId, sourceZoneId }) =>
  invokeRpc("create_zone_shared_invite", {
    p_recipient_auth_id: recipientAuthId,
    p_source_zone_id: sourceZoneId,
  });

export const respondToZoneSharedInvite = ({ inviteId, response }) =>
  invokeRpc("respond_to_zone_shared_invite", {
    p_invite_id: inviteId,
    p_response: response,
  });

export const recordZoneSharedInviteScan = ({ inviteId, discoveryId }) =>
  invokeRpc("record_zone_shared_invite_scan", {
    p_invite_id: inviteId,
    p_discovery_id: discoveryId,
  });

export const getZoneSharedInvites = async ({ authId }) => {
  if (!authId) return [];
  const { data, error } = await supabase
    .from("ZoneSharedInvite")
    .select("*")
    .or(`sender_auth_id.eq.${authId},recipient_auth_id.eq.${authId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

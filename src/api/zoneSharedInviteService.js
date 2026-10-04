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

export const getZoneSharedInviteProgress = async ({ authId }) => {
  if (!authId) return [];
  const { data: invites, error: inviteError } = await supabase
    .from("ZoneSharedInvite")
    .select("*")
    .or(`sender_auth_id.eq.${authId},recipient_auth_id.eq.${authId}`)
    .in("status", ["accepted", "completed"])
    .order("created_at", { ascending: false });
  if (inviteError) throw inviteError;

  const activeInvites = (invites || []).filter((invite) =>
    invite.status === "completed" || new Date(invite.challenge_expires_at || 0).getTime() > Date.now()
  );
  if (activeInvites.length === 0) return [];

  const { data: scans, error: scansError } = await supabase
    .from("ZoneSharedInviteScan")
    .select("invite_id, auth_id")
    .in("invite_id", activeInvites.map((invite) => invite.id));
  if (scansError) throw scansError;

  const countsByInvite = new Map();
  (scans || []).forEach(({ invite_id, auth_id: scannerAuthId }) => {
    const counts = countsByInvite.get(invite_id) || new Map();
    counts.set(scannerAuthId, (counts.get(scannerAuthId) || 0) + 1);
    countsByInvite.set(invite_id, counts);
  });

  return activeInvites.map((invite) => {
    const counts = countsByInvite.get(invite.id) || new Map();
    return {
      ...invite,
      sender_scan_count: counts.get(invite.sender_auth_id) || 0,
      recipient_scan_count: counts.get(invite.recipient_auth_id) || 0,
    };
  });
};

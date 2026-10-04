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

export const respondToZoneSharedInvite = async ({ inviteId, response }) => {
  const invite = await invokeRpc("respond_to_zone_shared_invite", {
    p_invite_id: inviteId,
    p_response: response,
  });

  if (invite?.recipient_auth_id) {
    const { data: notifications, error: notificationsError } = await supabase
      .from("UserNotification")
      .select("id, description")
      .eq("auth_id", invite.recipient_auth_id)
      .eq("notification_type", "zone_shared_invite")
      .eq("seen", false);

    if (notificationsError) {
      console.warn("[ZoneSharedInvite] Could not mark invite notifications as seen:", notificationsError.message);
    } else {
      const matchingIds = (notifications || []).filter((notification) => {
        try {
          return JSON.parse(notification.description || "{}").inviteId === inviteId;
        } catch {
          return false;
        }
      }).map((notification) => notification.id);

      if (matchingIds.length > 0) {
        const { error: updateError } = await supabase
          .from("UserNotification")
          .update({ seen: true })
          .in("id", matchingIds);
        if (updateError) {
          console.warn("[ZoneSharedInvite] Could not update invite notifications:", updateError.message);
        }
      }
    }
  }

  return invite;
};

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
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (inviteError) throw inviteError;

  const activeInvites = (invites || []).filter(
    (invite) => new Date(invite.challenge_expires_at || 0).getTime() > Date.now()
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

export const getPendingSharedZoneMapEvents = async ({ authId }) => {
  if (!authId) return { pendingInvites: [], sharedZoneInvites: [], pendingBudOffers: [] };

  const { data: invites, error: inviteError } = await supabase
    .from("ZoneSharedInvite")
    .select("*")
    .or(`sender_auth_id.eq.${authId},recipient_auth_id.eq.${authId}`)
    .in("status", ["pending", "accepted", "completed"])
    .order("created_at", { ascending: false });
  if (inviteError) throw inviteError;

  const now = Date.now();
  const pendingInvites = (invites || []).filter((invite) =>
    invite.status === "pending" &&
    String(invite.recipient_auth_id) === String(authId) &&
    new Date(invite.expires_at || 0).getTime() > now
  );
  const activeInvites = (invites || []).filter((invite) =>
    invite.status === "accepted" &&
    new Date(invite.challenge_expires_at || 0).getTime() > now
  );
  const completedInvites = (invites || []).filter((invite) => invite.status === "completed");
  const claimKeys = completedInvites.map(
    (invite) => `zone-lootbox:${authId}:${invite.source_zone_id}:${invite.id}`
  );

  const { data: claims, error: claimsError } = claimKeys.length > 0
    ? await supabase
      .from("ZoneLootboxClaim")
      .select("claim_key")
      .eq("auth_id", authId)
      .in("claim_key", claimKeys)
    : { data: [], error: null };
  if (claimsError) throw claimsError;

  const { data: scans, error: scansError } = activeInvites.length > 0
    ? await supabase
      .from("ZoneSharedInviteScan")
      .select("invite_id, auth_id")
      .in("invite_id", activeInvites.map((invite) => invite.id))
    : { data: [], error: null };
  if (scansError) throw scansError;

  const countsByInvite = new Map();
  (scans || []).forEach(({ invite_id, auth_id: scannerAuthId }) => {
    const counts = countsByInvite.get(invite_id) || new Map();
    counts.set(scannerAuthId, (counts.get(scannerAuthId) || 0) + 1);
    countsByInvite.set(invite_id, counts);
  });
  const sharedZoneInvites = activeInvites.map((invite) => {
    const counts = countsByInvite.get(invite.id) || new Map();
    return {
      ...invite,
      sender_scan_count: counts.get(invite.sender_auth_id) || 0,
      recipient_scan_count: counts.get(invite.recipient_auth_id) || 0,
    };
  });

  const claimedKeys = new Set((claims || []).map((claim) => claim.claim_key));
  const pendingBudOffers = completedInvites
    .map((invite) => ({
      id: `zone-lootbox-offer:${invite.id}`,
      display_name: "Gemeinsame Entdecker-Knospe",
      name: "Gemeinsame Entdecker-Knospe",
      lootboxName: "Entdecker-Knospe",
      type: "lootbox",
      zoneTheme: invite.zone_theme,
      zoneId: invite.source_zone_id,
      requiredScanCount: Number(invite.required_scan_count) || 5,
      claimKey: `zone-lootbox:${authId}:${invite.source_zone_id}:${invite.id}`,
      requiresClaim: true,
      isSharedZone: true,
      inviteId: invite.id,
    }))
    .filter((offer) => !claimedKeys.has(offer.claimKey));

  return { pendingInvites, sharedZoneInvites, pendingBudOffers };
};

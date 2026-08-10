import { supabase } from "@/api/supabaseClient";

export const ONLINE_USERS_CHANNEL = "community-online-users";

const toDisplayName = ({ authUser = null, profile = null, presence = null } = {}) => {
  return (
    profile?.display_name ||
    profile?.full_name ||
    presence?.displayName ||
    authUser?.user_metadata?.display_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.email ||
    presence?.email ||
    "Unbekannt"
  );
};

const toTitle = ({ profile = null, presence = null } = {}) => {
  return profile?.selected_title || profile?.title || presence?.title || "";
};

const toPresencePayload = ({ authUser, profile }) => ({
  authId: String(authUser?.id || ""),
  email: String(authUser?.email || ""),
  displayName: toDisplayName({ authUser, profile }),
  title: toTitle({ profile }),
  joinedAt: new Date().toISOString(),
});

const toTimestamp = (value) => {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const getOnlinePresenceDisplayName = (presence) =>
  toDisplayName({ presence });

export const mapOnlinePresenceState = (state) => {
  return Object.entries(state || {})
    .map(([presenceKey, presences]) => {
      const normalizedPresences = Array.isArray(presences) ? presences.filter(Boolean) : [];
      if (normalizedPresences.length === 0) return null;

      const latestPresence = [...normalizedPresences].sort(
        (left, right) => toTimestamp(right?.joinedAt) - toTimestamp(left?.joinedAt)
      )[0];

      return {
        presenceKey,
        authId: latestPresence?.authId || presenceKey,
        email: latestPresence?.email || "",
        displayName: latestPresence?.displayName || "",
        title: latestPresence?.title || "",
        joinedAt: latestPresence?.joinedAt || null,
        connectionCount: normalizedPresences.length,
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      getOnlinePresenceDisplayName(left).localeCompare(getOnlinePresenceDisplayName(right), "de", {
        sensitivity: "base",
      })
    );
};

// Multiple independent `supabase.channel(ONLINE_USERS_CHANNEL)` joins from the same
// client (e.g. AuthContext presence tracking + multiple UI subscribers) caused
// repeated CHANNEL_ERROR/reconnect loops because the same topic was joined more than
// once concurrently. All consumers now share a single underlying channel instance.
let sharedChannel = null;
let sharedChannelRefCount = 0;
let sharedChannelSubscribed = false;
let sharedChannelStatus = null;
const statusListeners = new Set();

const getSharedChannel = () => {
  if (!sharedChannel) {
    sharedChannel = supabase.channel(ONLINE_USERS_CHANNEL);
  }
  return sharedChannel;
};

const acquireSharedChannel = () => {
  sharedChannelRefCount += 1;
  const channel = getSharedChannel();

  if (!sharedChannelSubscribed) {
    sharedChannelSubscribed = true;
    channel.subscribe((status) => {
      sharedChannelStatus = status;
      console.info("[onlinePresenceService] subscribe status", { status, channel: ONLINE_USERS_CHANNEL });

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[onlinePresenceService] subscribe status problem", { status, channel: ONLINE_USERS_CHANNEL });
      }

      statusListeners.forEach((listener) => listener(status));
    });
  }

  return channel;
};

const releaseSharedChannel = () => {
  sharedChannelRefCount = Math.max(0, sharedChannelRefCount - 1);
  if (sharedChannelRefCount === 0 && sharedChannel) {
    const channelToRemove = sharedChannel;
    sharedChannel = null;
    sharedChannelSubscribed = false;
    sharedChannelStatus = null;
    statusListeners.clear();
    void supabase.removeChannel(channelToRemove);
  }
};

export const trackCurrentUserPresence = ({ authUser, profile }) => {
  if (!authUser?.id) {
    return () => {};
  }

  let isDisposed = false;
  const channel = acquireSharedChannel();

  const handleStatus = async (status) => {
    if (status !== "SUBSCRIBED" || isDisposed) return;

    try {
      await channel.track(toPresencePayload({ authUser, profile }));
    } catch (error) {
      console.warn("[onlinePresenceService] Failed to track current user presence", error);
    }
  };

  statusListeners.add(handleStatus);
  if (sharedChannelStatus === "SUBSCRIBED") {
    void handleStatus("SUBSCRIBED");
  }

  return () => {
    isDisposed = true;
    statusListeners.delete(handleStatus);
    Promise.resolve(channel.untrack()).catch(() => null).finally(() => {
      releaseSharedChannel();
    });
  };
};

export const subscribeToOnlineUsers = ({ onUsersChange, onError } = {}) => {
  const channel = acquireSharedChannel();

  const emitUsers = () => onUsersChange?.(mapOnlinePresenceState(channel.presenceState()));

  channel.on("presence", { event: "sync" }, emitUsers);
  channel.on("presence", { event: "join" }, emitUsers);
  channel.on("presence", { event: "leave" }, emitUsers);

  const handleStatus = (status) => {
    if (status === "SUBSCRIBED") {
      emitUsers();
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      onError?.(status);
    }
  };

  statusListeners.add(handleStatus);
  if (sharedChannelStatus === "SUBSCRIBED") {
    emitUsers();
  }

  return () => {
    statusListeners.delete(handleStatus);
    releaseSharedChannel();
  };
};
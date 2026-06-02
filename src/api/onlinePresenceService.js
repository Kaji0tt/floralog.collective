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

export const trackCurrentUserPresence = ({ authUser, profile }) => {
  if (!authUser?.id) {
    return () => {};
  }

  let isDisposed = false;
  const channel = supabase.channel(ONLINE_USERS_CHANNEL, {
    config: {
      presence: {
        key: String(authUser.id),
      },
    },
  });

  channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED" || isDisposed) return;

    try {
      await channel.track(toPresencePayload({ authUser, profile }));
    } catch (error) {
      console.warn("[onlinePresenceService] Failed to track current user presence", error);
    }
  });

  return () => {
    isDisposed = true;
    Promise.resolve(channel.untrack()).catch(() => null).finally(() => {
      void supabase.removeChannel(channel);
    });
  };
};

export const subscribeToOnlineUsers = ({ onUsersChange, onError } = {}) => {
  const channel = supabase.channel(ONLINE_USERS_CHANNEL);

  channel.on("presence", { event: "sync" }, () => {
    onUsersChange?.(mapOnlinePresenceState(channel.presenceState()));
  });

  channel.on("presence", { event: "join" }, () => {
    onUsersChange?.(mapOnlinePresenceState(channel.presenceState()));
  });

  channel.on("presence", { event: "leave" }, () => {
    onUsersChange?.(mapOnlinePresenceState(channel.presenceState()));
  });

  channel.subscribe((status) => {
    console.info("[onlinePresenceService] subscribe status", { status, channel: ONLINE_USERS_CHANNEL });

    if (status === "SUBSCRIBED") {
      onUsersChange?.(mapOnlinePresenceState(channel.presenceState()));
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("[onlinePresenceService] subscribe status problem", { status, channel: ONLINE_USERS_CHANNEL });
      onError?.(status);
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
};
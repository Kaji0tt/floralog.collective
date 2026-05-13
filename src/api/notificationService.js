import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";

const safeLower = (value) => (value || "").toLowerCase();

export const getUserDisplayName = (userLike, fallback = "Jemand") => {
  return (
    userLike?.display_name ||
    userLike?.full_name ||
    userLike?.user_email ||
    userLike?.email ||
    fallback
  );
};

export async function createUserNotification({
  authId,
  userEmail,
  notificationType = "custom",
  title,
  message,
  actionUrl = "",
  description = "",
  priority = "medium",
  displayLocation = "banner",
  createdBy = "system"
}) {
  if (!authId && !userEmail) {
    console.warn("[NotificationService] Skip createUserNotification: missing target", {
      authId,
      userEmail,
      notificationType,
    });
    return null;
  }

  if (!title || !message) {
    console.warn("[NotificationService] Skip createUserNotification: missing title/message", {
      title,
      message,
      notificationType,
    });
    return null;
  }

  const payload = {
    authId,
    userEmail,
    notificationType,
    title,
    message,
    actionUrl,
    description,
    priority,
    displayLocation,
    createdBy,
  };

  console.info("[NotificationService] createUserNotification -> createNotification", payload);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const invokeOptions = {
    body: payload,
  };

  if (session?.access_token) {
    invokeOptions.headers = {
      Authorization: `Bearer ${session.access_token}`,
    };
  } else {
    console.warn("[NotificationService] No active session token found for createNotification call");
  }

  const { data, error } = await supabase.functions.invoke("createNotification", {
    ...invokeOptions,
  });

  if (error) {
    console.error("[NotificationService] Edge function call failed", error);
    throw error;
  }

  if (!data?.success) {
    console.error("[NotificationService] Edge function returned non-success", data);
    throw new Error(data?.error || "createNotification failed");
  }

  console.info("[NotificationService] Notification created", data?.debug || {});
  return data.notification;
}

export async function notifyAcceptedFriends({
  actorUser,
  notificationType,
  title,
  message,
  actionUrl,
  description = ""
}) {
  if (!actorUser?.email) return;

  const actorEmailLower = safeLower(actorUser.email);
  const [allFriendRecords, allProfiles] = await Promise.all([
    Query.Friend.list(),
    Query.PublicProfile.list(),
  ]);

  const acceptedFriends = allFriendRecords.filter(
    (f) =>
      f.status === "accepted" &&
      (safeLower(f.request_sent_by) === actorEmailLower ||
        safeLower(f.request_sent_to) === actorEmailLower)
  );

  const profileByEmail = new Map(
    allProfiles.map((profile) => [safeLower(profile.user_email), profile])
  );

  console.info("[NotificationService] notifyAcceptedFriends", {
    actor: actorUser.email,
    acceptedFriends: acceptedFriends.length,
    notificationType,
  });

  const notifications = acceptedFriends.map((friendship) => {
    const friendEmail =
      safeLower(friendship.request_sent_by) === actorEmailLower
        ? friendship.request_sent_to
        : friendship.request_sent_by;

    const friendProfile = profileByEmail.get(safeLower(friendEmail));

    return createUserNotification({
      authId: friendProfile?.auth_id,
      userEmail: friendProfile?.user_email || friendEmail,
      notificationType,
      title,
      message,
      actionUrl,
      description,
      createdBy: actorUser.email,
    });
  });

  await Promise.allSettled(notifications);
}

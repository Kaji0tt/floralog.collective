import { Query } from "@/api/entities";

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
  imageUrl = "",
  priority = "medium",
  displayLocation = "banner",
  createdBy = "system"
}) {
  if (!authId && !userEmail) return null;
  if (!title || !message) return null;

  return Query.UserNotification.create({
    auth_id: authId || undefined,
    user_email: userEmail || undefined,
    notification_type: notificationType,
    title,
    message,
    description,
    image_url: imageUrl,
    action_url: actionUrl,
    priority,
    display_location: displayLocation,
    seen: false,
    created_by: createdBy
  });
}

export async function notifyAcceptedFriends({
  actorUser,
  notificationType,
  title,
  message,
  actionUrl,
  description = "",
  imageUrl = ""
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
      imageUrl,
      createdBy: actorUser.email,
    });
  });

  await Promise.allSettled(notifications);
}

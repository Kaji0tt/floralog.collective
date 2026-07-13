import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useUiTheme } from "@/lib/UiThemeContext";
import { computeAverageColorFromImage } from "@/lib/friendColorUtils";

/**
 * Central data hook for all Friend-context pages.
 *
 * Responsibilities:
 * - Loads visiting user (currentUser)
 * - Loads friend's PublicProfile
 * - Checks friendship status (accepted / pending / none)
 * - Computes background color from friend's profile
 * - Applies the friend's ui_theme as a scoped override via UiThemeContext
 *   (restored automatically when the Friend page unmounts)
 *
 * @param {string|null} friendEmail - From ?email= URL param
 */
export function useFriendData(friendEmail) {
  const { pushThemeOverride, popThemeOverride } = useUiTheme();

  const [currentUser, setCurrentUser] = useState(null);
  const [friendUser, setFriendUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);

  // ── Load visiting user ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((u) => { if (!cancelled) setCurrentUser(u); });
    return () => { cancelled = true; };
  }, []);

  // ── Friend's PublicProfile (world-readable) ────────────────────────────────
  const { data: publicProfile, isLoading: publicProfileLoading } = useQuery({
    queryKey: ["publicProfile", friendEmail],
    queryFn: async () => {
      if (!friendEmail) return null;
      const profiles = await Query.PublicProfile.list();
      return (
        profiles.find(
          (p) => p.user_email?.toLowerCase() === friendEmail.toLowerCase()
        ) ?? null
      );
    },
    enabled: !!friendEmail,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ── Friendship record (to gate access to sub-pages) ────────────────────────
  const { data: myFriendship, isLoading: friendshipLoading } = useQuery({
    queryKey: ["myFriendship", currentUser?.email, friendEmail],
    queryFn: async () => {
      if (!currentUser?.email || !friendEmail) return null;
      const allFriends = await Query.Friend.list();
      const meL = currentUser.email.toLowerCase();
      const theyL = friendEmail.toLowerCase();
      return (
        allFriends.find(
          (f) =>
            (f.request_sent_by?.toLowerCase() === meL &&
              f.request_sent_to?.toLowerCase() === theyL) ||
            (f.request_sent_by?.toLowerCase() === theyL &&
              f.request_sent_to?.toLowerCase() === meL)
        ) ?? null
      );
    },
    enabled: !!currentUser?.email && !!friendEmail,
    staleTime: 10_000,
  });

  const isFriend = myFriendship?.status === "accepted";
  const hasPendingRequest = !!myFriendship && myFriendship.status !== "accepted";

  // ── Resolve friendUser (profile → friendship fallback → minimal stub) ──────
  useEffect(() => {
    if (!friendEmail) {
      setFriendUser(null);
      return;
    }
    if (publicProfile) {
      setFriendUser(publicProfile);
    } else if (!publicProfileLoading && !friendshipLoading) {
      // No public profile found — use a minimal stub so the shell can render
      setFriendUser({
        email: friendEmail,
        user_email: friendEmail,
        full_name: friendEmail,
        display_name: friendEmail,
        level: 1,
        xp: 0,
        title: "Pflanzen-Anfänger",
        selected_title: null,
        avatar_url: null,
        background_color: null,
        background_image_url: null,
        ui_theme: null,
        auth_id: null,
      });
    }
  }, [publicProfile, friendEmail, publicProfileLoading, friendshipLoading]);

  // ── Background color ───────────────────────────────────────────────────────
  useEffect(() => {
    if (friendUser?.background_color) {
      setAverageColor(friendUser.background_color);
    } else if (friendUser?.background_image_url) {
      computeAverageColorFromImage(friendUser.background_image_url).then((c) => {
        setAverageColor(c ?? null);
      });
    } else {
      setAverageColor(null);
    }
  }, [friendUser?.background_color, friendUser?.background_image_url]);

  // ── Apply friend's ui_theme as scoped override ─────────────────────────────
  // This runs when the Friend page mounts and pops automatically on unmount.
  // If friend has no explicit preference, we default to "dark".
  useEffect(() => {
    if (!friendUser) return;
    const friendTheme = friendUser.ui_theme === "light" ? "light" : "dark";
    pushThemeOverride(friendTheme);
    return () => {
      popThemeOverride();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendUser?.ui_theme]);

  const isLoading =
    !currentUser || publicProfileLoading || friendshipLoading || !friendUser;

  return {
    friendEmail,
    friendUser,
    currentUser,
    myFriendship,
    isFriend,
    hasPendingRequest,
    averageColor,
    isLoading,
    publicProfile,
  };
}

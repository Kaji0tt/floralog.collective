import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QuestNotificationDisplay from "./QuestNotificationDisplay";
import ScanOfTheWeekNotification from "./ScanOfTheWeekNotification";
import { AnimatePresence } from "framer-motion";

// Notification types that belong to the Friends news tab.
// These must NOT be marked as seen when dismissed from the Home page banner,
// so that the Friends page unread counter remains accurate.
const FRIENDS_NEWS_TYPES = [
  "gift_received",
  "collection_followed",
  "friendship_accepted",
  "friend_request_received",
  "friend_achievement",
  "scan_liked",
];

const DISMISSED_BANNERS_KEY = "floralog_dismissed_news_banners";

function getDismissedBannerIds() {
  try {
    const stored = localStorage.getItem(DISMISSED_BANNERS_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function addDismissedBannerId(id) {
  try {
    const ids = getDismissedBannerIds();
    ids.add(id);
    localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore localStorage errors
  }
}

function cleanupDismissedBanners(seenIds) {
  try {
    const ids = getDismissedBannerIds();
    const cleaned = [...ids].filter((id) => !seenIds.has(id));
    if (cleaned.length < ids.size) {
      localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // ignore
  }
}

function extractScanLikerName(message) {
  const text = String(message || "").trim();
  if (!text) return null;

  const directMatch = text.match(/^(.+?)\s+gef[äa]llt\s+dein\s+Scan/i);
  if (directMatch?.[1]) return directMatch[1].trim();

  const groupedMatch = text.match(/^(.+?)\s+und\s+\d+\s+andere\s+gef[äa]llt\s+dein\s+Scan/i);
  if (groupedMatch?.[1]) return groupedMatch[1].trim();

  return null;
}

function buildScanLikeSummaryNotification(scanLikeNotifications) {
  const sorted = [...scanLikeNotifications].sort((a, b) => {
    const aTime = new Date(a.created_date || a.created_at || 0).getTime();
    const bTime = new Date(b.created_date || b.created_at || 0).getTime();
    return bTime - aTime;
  });

  const count = sorted.length;
  const uniqueNames = [];
  const seenNames = new Set();

  for (const item of sorted) {
    const name = extractScanLikerName(item.message);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;

    seenNames.add(key);
    uniqueNames.push(name);
    if (uniqueNames.length >= 3) break;
  }

  const namesPreview = uniqueNames.length > 0 ? uniqueNames.join(", ") : "deinen Freund:innen";
  const remainingCount = Math.max(0, count - uniqueNames.length);
  const moreText = remainingCount > 0 ? ` und ${remainingCount} weitere` : "";
  const base = sorted[0] || {};

  return {
    ...base,
    id: `scan-liked-summary:${sorted.map((n) => n.id).join(",")}`,
    title: `❤️ ${count} neue Likes`,
    message: `Du hast ${count} neue Likes erhalten, unter anderem von ${namesPreview}${moreText}. Sieh direkt nach, wofür!`,
    action_url: "Friends?tab=news",
    display_location: "banner",
    priority: "high",
    _groupedNotificationIds: sorted.map((n) => n.id),
  };
}

/**
 * Manager fuer User-Benachrichtigungen
 * Zeigt ungesehene Benachrichtigungen basierend auf display_location an
 */
export default function UserNotificationManager({ user }) {
  const [currentNotification, setCurrentNotification] = useState(null);
  const [shownNotificationIds, setShownNotificationIds] = useState(new Set());
  const queryClient = useQueryClient();

  // Lade ungesehene Benachrichtigungen (nur initiales Laden)
  const { data: notifications = [] } = useQuery({
    queryKey: ["userNotifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const allNotifications = await Query.UserNotification.list("-created_date");

      // Remove IDs from the dismissed-banner list that are now marked as seen in DB
      const seenIds = new Set(allNotifications.filter((n) => n.seen === true).map((n) => n.id));
      cleanupDismissedBanners(seenIds);

      const dismissedBannerIds = getDismissedBannerIds();

      const filtered = allNotifications.filter(
        (n) => n.auth_id === user.id && n.seen === false && !dismissedBannerIds.has(n.id)
      );

      console.log("[UserNotificationManager] Loaded notifications", {
        userId: user.id,
        total: allNotifications.length,
        filtered: filtered.length,
        sample: filtered[0] || null,
      });

      return filtered;
    },
    enabled: !!user?.id,
    staleTime: Infinity,   // Echtzeit-Updates durch Subscription
    refetchOnMount: 'always', // Immer beim Mount neu laden – verhindert, dass der persistierte Cache alte (leere) Ergebnisse einfriert
  });

  useEffect(() => {
    if (!user?.id) return;

    console.log("[UserNotificationManager] notifications state changed", {
      userId: user.id,
      count: notifications.length,
      ids: notifications.map((n) => n.id),
    });
  }, [notifications, user?.id]);

  // Echtzeit-Subscription fuer UserNotification-Aenderungen
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = Query.UserNotification.subscribe((event) => {
      if (event.type === "create") {
        const notification = event.data;
        if (notification.auth_id === user.id && !notification.seen) {
          queryClient.invalidateQueries({ queryKey: ["userNotifications"] });
        }
      } else if (event.type === "update" || event.type === "delete") {
        queryClient.invalidateQueries({ queryKey: ["userNotifications"] });
      }
    });

    return unsubscribe;
  }, [user?.id]);

  // Mutation zum Markieren als gesehen
  const markAsSeenMutation = useMutation({
    mutationFn: (notificationId) => Query.UserNotification.update(notificationId, { seen: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userNotifications"] });
    },
  });

  // Zeige die naechste Benachrichtigung
  useEffect(() => {
    if (notifications.length === 0 || currentNotification) return;

    // Priorisiere nach priority: high -> medium -> low
    const sortedNotifications = [...notifications].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
    });

    const dismissedBannerIds = getDismissedBannerIds();
    const availableNotifications = sortedNotifications.filter(
      (n) => !shownNotificationIds.has(n.id) && !dismissedBannerIds.has(n.id)
    );

    const nextNotification = availableNotifications[0] || null;
    if (!nextNotification) return;

    // If multiple unseen likes are queued, show one summary instead of many individual banners.
    if (nextNotification.notification_type === "scan_liked") {
      const availableScanLikes = availableNotifications.filter(
        (n) => n.notification_type === "scan_liked"
      );

      if (availableScanLikes.length > 1) {
        const summaryNotification = buildScanLikeSummaryNotification(availableScanLikes);
        setCurrentNotification(summaryNotification);
        setShownNotificationIds((prev) => new Set([...prev, ...availableScanLikes.map((n) => n.id)]));
        return;
      }
    }

    setCurrentNotification(nextNotification);
    setShownNotificationIds((prev) => new Set([...prev, nextNotification.id]));
  }, [notifications, currentNotification, shownNotificationIds]);

  const handleClose = () => {
    if (currentNotification) {
      const groupedIds = Array.isArray(currentNotification._groupedNotificationIds)
        ? currentNotification._groupedNotificationIds
        : [currentNotification.id];

      if (FRIENDS_NEWS_TYPES.includes(currentNotification.notification_type)) {
        // For Friends news-type notifications: track dismissal in localStorage so the
        // banner doesn't reappear, but do NOT mark as seen in the DB. The notification
        // stays unseen so the Friends page unread counter reflects it correctly.
        groupedIds.forEach((id) => addDismissedBannerId(id));
      } else {
        groupedIds.forEach((id) => markAsSeenMutation.mutate(id));
      }
    }

    setCurrentNotification(null);
  };

  const handleMarkAsSeen = (notificationId) => {
    markAsSeenMutation.mutate(notificationId);
  };

  if (!user || !currentNotification) return null;

  if (currentNotification.notification_type === "scan_of_the_week") {
    return (
      <ScanOfTheWeekNotification
        notification={currentNotification}
        onComplete={handleClose}
      />
    );
  }

  return (
    <AnimatePresence>
      <QuestNotificationDisplay
        notification={currentNotification}
        onClose={handleClose}
        onMarkAsSeen={handleMarkAsSeen}
      />
    </AnimatePresence>
  );
}

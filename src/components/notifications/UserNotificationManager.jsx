import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QuestNotificationDisplay from "./QuestNotificationDisplay";
import { AnimatePresence } from "framer-motion";

// Notification types that belong to the Friends news tab.
// These must NOT be marked as seen when dismissed from the Home page banner,
// so that the Friends page unread counter remains accurate.
const FRIENDS_NEWS_TYPES = [
  'gift_received',
  'collection_followed',
  'friendship_accepted',
  'friend_request_received',
  'friend_achievement',
  'scan_liked',
];

const DISMISSED_BANNERS_KEY = 'floralog_dismissed_news_banners';

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
    const cleaned = [...ids].filter(id => !seenIds.has(id));
    if (cleaned.length < ids.size) {
      localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // ignore
  }
}

/**
 * Manager für User-Benachrichtigungen
 * Zeigt ungesehene Benachrichtigungen basierend auf display_location an
 */
export default function UserNotificationManager({ user }) {
  const [currentNotification, setCurrentNotification] = useState(null);
  const [shownNotificationIds, setShownNotificationIds] = useState(new Set());
  const queryClient = useQueryClient();

  // Lade ungesehene Benachrichtigungen (nur initiales Laden)
  const { data: notifications = [] } = useQuery({
    queryKey: ['userNotifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const allNotifications = await Query.UserNotification.list('-created_date');

      // Remove IDs from the dismissed-banner list that are now marked as seen in DB
      const seenIds = new Set(allNotifications.filter(n => n.seen === true).map(n => n.id));
      cleanupDismissedBanners(seenIds);

      const dismissedBannerIds = getDismissedBannerIds();

      const filtered = allNotifications.filter(n =>
        n.auth_id === user.id &&
        n.seen === false &&
        !dismissedBannerIds.has(n.id)
      );
      console.log('[UserNotificationManager] Loaded notifications', {
        userId: user.id,
        total: allNotifications.length,
        filtered: filtered.length,
        sample: filtered[0] || null
      });
      return filtered;
    },
    enabled: !!user?.id,
    staleTime: Infinity, // Echtzeit-Updates durch Subscription
  });

  useEffect(() => {
    if (!user?.id) return;
    console.log('[UserNotificationManager] notifications state changed', {
      userId: user.id,
      count: notifications.length,
      ids: notifications.map(n => n.id)
    });
  }, [notifications, user?.id]);

  // Echtzeit-Subscription für UserNotification-Änderungen
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = Query.UserNotification.subscribe((event) => {
      if (event.type === 'create') {
        const notification = event.data;
        if (notification.auth_id === user.id && !notification.seen) {
          queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
        }
      } else if (event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
      }
    });

    return unsubscribe;
  }, [user?.id]);

  // Mutation zum Markieren als gesehen
  const markAsSeenMutation = useMutation({
    mutationFn: (notificationId) => 
      Query.UserNotification.update(notificationId, { seen: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
    }
  });

  // Zeige die nächste Benachrichtigung
  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      // Priorisiere nach priority: high -> medium -> low
      const sortedNotifications = [...notifications].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
      });

      // Also exclude notifications that were dismissed as banners in a previous session
      const dismissedBannerIds = getDismissedBannerIds();
      
      // Finde die erste Benachrichtigung, die noch nicht gezeigt wurde
      const nextNotification = sortedNotifications.find(n =>
        !shownNotificationIds.has(n.id) && !dismissedBannerIds.has(n.id)
      );
      
      if (nextNotification) {
        setCurrentNotification(nextNotification);
        setShownNotificationIds(prev => new Set([...prev, nextNotification.id]));
      }
    }
  }, [notifications, currentNotification, shownNotificationIds]);

  const handleClose = () => {
    if (currentNotification) {
      if (FRIENDS_NEWS_TYPES.includes(currentNotification.notification_type)) {
        // For Friends news-type notifications: track dismissal in localStorage so the
        // banner doesn't reappear, but do NOT mark as seen in the DB. The notification
        // stays unseen so the Friends page unread counter reflects it correctly.
        addDismissedBannerId(currentNotification.id);
      } else {
        markAsSeenMutation.mutate(currentNotification.id);
      }
    }
    setCurrentNotification(null);
  };

  const handleMarkAsSeen = (notificationId) => {
    markAsSeenMutation.mutate(notificationId);
  };

  if (!user || !currentNotification) return null;

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
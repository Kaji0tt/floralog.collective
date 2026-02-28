import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QuestNotificationDisplay from "./QuestNotificationDisplay";
import { AnimatePresence } from "framer-motion";

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
      const filtered = allNotifications.filter(n => 
        n.auth_id === user.id && 
        n.seen === false
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
      
      // Finde die erste Benachrichtigung, die noch nicht gezeigt wurde
      const nextNotification = sortedNotifications.find(n => !shownNotificationIds.has(n.id));
      
      if (nextNotification) {
        setCurrentNotification(nextNotification);
        setShownNotificationIds(prev => new Set([...prev, nextNotification.id]));
      }
    }
  }, [notifications, currentNotification, shownNotificationIds]);

  const handleClose = () => {
    if (currentNotification) {
      markAsSeenMutation.mutate(currentNotification.id);
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
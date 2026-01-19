import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QuestNotificationDisplay from "./QuestNotificationDisplay";
import { AnimatePresence } from "framer-motion";

/**
 * Manager für User-Benachrichtigungen
 * Zeigt ungesehene Benachrichtigungen basierend auf display_location an
 */
export default function UserNotificationManager({ user }) {
  const [currentNotification, setCurrentNotification] = useState(null);
  const queryClient = useQueryClient();

  // Lade ungesehene Benachrichtigungen
  const { data: notifications = [] } = useQuery({
    queryKey: ['userNotifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allNotifications = await base44.entities.UserNotification.list('-created_date');
      return allNotifications.filter(n => 
        n.user_email === user.email && 
        n.seen === false
      );
    },
    enabled: !!user?.email,
    refetchInterval: 5000 // Alle 5 Sekunden prüfen
  });

  // Mutation zum Markieren als gesehen
  const markAsSeenMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.UserNotification.update(notificationId, { seen: true }),
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
      
      setCurrentNotification(sortedNotifications[0]);
    }
  }, [notifications, currentNotification]);

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
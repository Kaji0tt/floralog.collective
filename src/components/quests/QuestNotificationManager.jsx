import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Scroll } from "lucide-react";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest, getTodayString, getWeekNumber, getMonthString } from "./QuestRotationHelper";

export default function QuestNotificationManager({ user }) {
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list('quest_number'),
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => base44.entities.MonthlyQuest.list('quest_number'),
  });

  const { data: dailyQuests = [] } = useQuery({
    queryKey: ['dailyQuests'],
    queryFn: () => base44.entities.DailyQuest.list('quest_number'),
  });

  useEffect(() => {
    if (!user || weeklyQuests.length === 0 || monthlyQuests.length === 0 || dailyQuests.length === 0) return;

    checkAndShowNewQuests();
  }, [user, weeklyQuests, monthlyQuests, dailyQuests]);

  const checkAndShowNewQuests = () => {
    const today = getTodayString();
    const currentWeek = getWeekNumber();
    const currentMonth = getMonthString();

    // Lade gespeicherte Quest-Stati aus localStorage
    const shownQuests = JSON.parse(localStorage.getItem('shownQuestNotifications') || '{}');

    const newNotifications = [];

    // Prüfe wöchentliche Quest
    const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);
    if (currentWeeklyQuest && shownQuests[`weekly-${currentWeek}`] !== currentWeeklyQuest.id) {
      newNotifications.push({
        type: 'weekly',
        quest: currentWeeklyQuest,
        title: '🏆 Neue Wöchentliche Challenge!',
        key: `weekly-${currentWeek}`,
        questId: currentWeeklyQuest.id
      });
    }

    // Prüfe monatliche Quest
    const currentMonthlyQuest = getCurrentMonthlyQuest(monthlyQuests);
    if (currentMonthlyQuest && shownQuests[`monthly-${currentMonth}`] !== currentMonthlyQuest.id) {
      newNotifications.push({
        type: 'monthly',
        quest: currentMonthlyQuest,
        title: '📅 Neue Monats-Quest!',
        key: `monthly-${currentMonth}`,
        questId: currentMonthlyQuest.id
      });
    }

    // Prüfe tägliche Quest
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const currentDailyQuest = dailyQuests.length > 0 ? dailyQuests[dayOfYear % dailyQuests.length] : null;
    if (currentDailyQuest && shownQuests[`daily-${today}`] !== currentDailyQuest.id) {
      newNotifications.push({
        type: 'daily',
        quest: currentDailyQuest,
        title: '⭐ Neue Tages-Quest!',
        key: `daily-${today}`,
        questId: currentDailyQuest.id
      });
    }

    if (newNotifications.length > 0) {
      setNotificationQueue(newNotifications);
      setCurrentNotification(newNotifications[0]);
    }
  };

  const handleClose = () => {
    if (!currentNotification) return;

    // Markiere als angezeigt
    const shownQuests = JSON.parse(localStorage.getItem('shownQuestNotifications') || '{}');
    shownQuests[currentNotification.key] = currentNotification.questId;
    localStorage.setItem('shownQuestNotifications', JSON.stringify(shownQuests));

    // Gehe zur nächsten Benachrichtigung
    const remainingQueue = notificationQueue.slice(1);
    setNotificationQueue(remainingQueue);
    
    if (remainingQueue.length > 0) {
      setCurrentNotification(remainingQueue[0]);
    } else {
      setCurrentNotification(null);
    }
  };

  if (!currentNotification) return null;

  const quest = currentNotification.quest;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[100] flex items-start justify-start p-6"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="relative w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quest Content Box */}
          <div className="bg-amber-50 border-4 border-amber-300 rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto relative">
            {/* Schließen Button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-10 h-10 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center transition-colors z-10 shadow-lg"
            >
              <X className="w-6 h-6 text-amber-900" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Scroll className="w-6 h-6 text-amber-600" />
              <h3 className="text-xl font-bold text-stone-900">
                {currentNotification.title}
              </h3>
            </div>

            <h4 className="font-bold text-stone-900 mb-3 text-lg">
              {quest.title}
            </h4>
            
            <p className="text-base text-stone-700 leading-relaxed mb-3">
              {quest.description}
            </p>
            
            {quest.requirement && (
              <p className="text-sm text-stone-600 mb-3 italic bg-amber-100 p-3 rounded-lg border border-amber-200">
                📋 {quest.requirement}
              </p>
            )}

            {notificationQueue.length > 1 && (
              <div className="mt-4 text-sm text-stone-500 text-center bg-amber-100 py-2 rounded-lg">
                Weitere Quest wartet... ({notificationQueue.length - 1})
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
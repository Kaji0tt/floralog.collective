import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Scroll } from "lucide-react";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest, getTodayString, getWeekNumber, getMonthString } from "./QuestRotationHelper";

// Default-Bild (kann später durch eine Einstellung ersetzt werden)
const DEFAULT_QUEST_GIVER_IMAGE = "https://blauzahn.eu/PlantDexIcon.png";

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
        className="fixed inset-0 bg-black/40 z-[100] flex items-end md:items-center justify-center md:justify-end p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="relative max-w-md w-full md:mr-8 mb-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Person/Charakter Bild */}
          <div className="absolute bottom-0 left-4 md:left-0 w-32 h-32 md:w-40 md:h-40 z-10">
            <img
              src={user?.quest_giver_image || DEFAULT_QUEST_GIVER_IMAGE}
              alt="Quest Giver"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </div>

          {/* Sprechblase */}
          <div className="ml-24 md:ml-36 bg-white rounded-2xl shadow-2xl border-4 border-stone-300 relative">
            {/* Sprechblasen-Spitze */}
            <div className="absolute left-0 bottom-8 w-0 h-0 border-t-[20px] border-t-transparent border-b-[20px] border-b-transparent border-r-[30px] border-r-white -ml-[26px]" />
            <div className="absolute left-0 bottom-8 w-0 h-0 border-t-[24px] border-t-transparent border-b-[24px] border-b-transparent border-r-[34px] border-r-stone-300 -ml-[34px]" />

            {/* Schließen Button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 bg-stone-200 hover:bg-stone-300 rounded-full flex items-center justify-center transition-colors z-10"
            >
              <X className="w-5 h-5 text-stone-700" />
            </button>

            {/* Content */}
            <div className="p-6 pr-12">
              <div className="flex items-center gap-2 mb-3">
                <Scroll className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-stone-900">
                  {currentNotification.title}
                </h3>
              </div>

              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                <h4 className="font-bold text-stone-900 mb-2 text-base">
                  {quest.title}
                </h4>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {quest.description}
                </p>
                {quest.requirement && (
                  <p className="text-xs text-stone-600 mt-2 italic">
                    📋 {quest.requirement}
                  </p>
                )}
                {quest.xp_reward && (
                  <div className="mt-3 pt-3 border-t border-amber-300">
                    <span className="text-sm font-bold text-green-600">
                      🎁 Belohnung: {quest.xp_reward} XP
                    </span>
                  </div>
                )}
              </div>

              {notificationQueue.length > 1 && (
                <div className="mt-3 text-xs text-stone-500 text-center">
                  Weitere Quest wartet... ({notificationQueue.length - 1})
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
// Helper-Funktionen für tägliche und wöchentliche Quest-Rotation

// Gibt den aktuellen Tag des Jahres zurück (1-366)
export const getDayOfYear = (date = new Date()) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

// Gibt die Kalenderwoche im Format "YYYY-Wxx" zurück
export const getWeekNumber = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// Gibt das heutige Datum im Format "YYYY-MM-DD" zurück
export const getTodayString = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};

// Bestimmt die aktuelle tägliche Quest basierend auf dem Tag
export const getCurrentDailyQuest = (dailyQuests) => {
  if (!dailyQuests || dailyQuests.length === 0) return null;
  const sortedQuests = [...dailyQuests].sort((a, b) => a.quest_number - b.quest_number);
  const dayOfYear = getDayOfYear();
  const index = dayOfYear % sortedQuests.length;
  return sortedQuests[index];
};

// Bestimmt die aktuelle wöchentliche Quest basierend auf der Woche
export const getCurrentWeeklyQuest = (weeklyQuests) => {
  if (!weeklyQuests || weeklyQuests.length === 0) return null;
  const sortedQuests = [...weeklyQuests].sort((a, b) => a.quest_number - b.quest_number);
  const weekString = getWeekNumber();
  const weekNumber = parseInt(weekString.split('-W')[1]);
  const index = weekNumber % sortedQuests.length;
  return sortedQuests[index];
};

// Holt oder erstellt die aktive UserDailyQuest für heute
export const getOrCreateActiveDailyQuest = async (base44, currentDailyQuest, userDailyQuests, userEmail) => {
  if (!currentDailyQuest) return null;
  
  const today = getTodayString();
  let activeUserQuest = userDailyQuests.find(
    udq => udq.daily_quest_id === currentDailyQuest.id && udq.active_date === today
  );
  
  if (!activeUserQuest) {
    activeUserQuest = await base44.entities.UserDailyQuest.create({
      daily_quest_id: currentDailyQuest.id,
      active_date: today,
      progress: 0,
      completed: false,
      created_by: userEmail
    });
  }
  
  return activeUserQuest;
};

// Holt oder erstellt die aktive UserWeeklyQuest für diese Woche
export const getOrCreateActiveWeeklyQuest = async (base44, currentWeeklyQuest, userWeeklyQuests, userEmail) => {
  if (!currentWeeklyQuest) return null;
  
  const currentWeek = getWeekNumber();
  let activeUserQuest = userWeeklyQuests.find(
    uwq => uwq.weekly_quest_id === currentWeeklyQuest.id && uwq.active_week === currentWeek
  );
  
  if (!activeUserQuest) {
    activeUserQuest = await base44.entities.UserWeeklyQuest.create({
      weekly_quest_id: currentWeeklyQuest.id,
      active_week: currentWeek,
      progress: 0,
      completed: false,
      created_by: userEmail
    });
  }
  
  return activeUserQuest;
};

// Prüft ob die tägliche Quest heute abgeschlossen wurde
export const isDailyQuestCompletedToday = (userDailyQuests, questId) => {
  const today = getTodayString();
  const todayQuest = userDailyQuests.find(
    udq => udq.daily_quest_id === questId && udq.active_date === today
  );
  return todayQuest?.completed === true;
};

// Prüft ob die wöchentliche Quest diese Woche abgeschlossen wurde
export const isWeeklyQuestCompletedThisWeek = (userWeeklyQuests, questId) => {
  const currentWeek = getWeekNumber();
  const weekQuest = userWeeklyQuests.find(
    uwq => uwq.weekly_quest_id === questId && uwq.active_week === currentWeek
  );
  return weekQuest?.completed === true;
};
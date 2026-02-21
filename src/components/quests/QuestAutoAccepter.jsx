import React, { useEffect } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Auto-Accept Component für Quests
 * Nimmt automatisch verfügbare Quests an
 */
export default function QuestAutoAccepter({ user }) {
  const queryClient = useQueryClient();
  // Insert-Guard: Verhindert doppelte Inserts pro Seite
  const insertGuard = React.useRef({ regular: false, weekly: false, monthly: false, collection: false });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => Query.Quest.list('quest_number'),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', user?.id],
    queryFn: () => Query.UserQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
  });

  const { data: weeklyQuests = [] } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => Query.WeeklyQuest.list('quest_number')
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ['userWeeklyQuests', user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: monthlyQuests = [] } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => Query.MonthlyQuest.list('quest_number')
  });

  const { data: userMonthlyQuests = [] } = useQuery({
    queryKey: ['userMonthlyQuests', user?.id],
    queryFn: () => Query.UserMonthlyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list()
  });

  const { data: userCollectionQuests = [] } = useQuery({
    queryKey: ['userCollectionQuests', user?.id],
    queryFn: () => Query.UserCollectionQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id
  });

  const acceptQuestMutation = useMutation({
    mutationFn: async ({ questId, questType, activeWeek, activeMonth }) => {
      const now = new Date().toISOString();
      if (questType === 'regular') {
        return Query.UserQuest.create({
          quest_id: questId,
          auth_id: user.id,
          created_by: user.email,
          accepted: true,
          accepted_date: now
        });
      } else if (questType === 'weekly') {
        return Query.UserWeeklyQuest.create({
          weekly_quest_id: questId,
          active_week: activeWeek,
          auth_id: user.id,
          created_by: user.email,
          accepted: true,
          accepted_date: now
        });
      } else if (questType === 'monthly') {
        return Query.UserMonthlyQuest.create({
          monthly_quest_id: questId,
          active_month: activeMonth,
          auth_id: user.id,
          created_by: user.email,
          accepted: true,
          accepted_date: now
        });
      } else if (questType === 'collection') {
        return Query.UserCollectionQuest.create({
          collection_quest_id: questId,
          auth_id: user.id,
          created_by: user.email,
          accepted: true,
          accepted_date: now
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userWeeklyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userMonthlyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['userCollectionQuests'] });
    }
  });

  const getWeekNumber = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getMonthString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getCurrentWeeklyQuest = () => {
    if (!weeklyQuests || weeklyQuests.length === 0) return null;
    const sortedQuests = [...weeklyQuests].sort((a, b) => a.quest_number - b.quest_number);
    const weekString = getWeekNumber();
    const weekNumber = parseInt(weekString.split('-W')[1]);
    const index = weekNumber % sortedQuests.length;
    return sortedQuests[index];
  };

  const getCurrentMonthlyQuest = () => {
    if (!monthlyQuests || monthlyQuests.length === 0) return null;
    const sortedQuests = [...monthlyQuests].sort((a, b) => a.quest_number - b.quest_number);
    const month = new Date().getMonth() + 1;
    const index = (month - 1) % sortedQuests.length;
    return sortedQuests[index];
  };

  useEffect(() => {
    if (!user?.email || acceptQuestMutation.isPending) return;

    // 1. Regular Quests automatisch annehmen
    const availableRegularQuests = quests.filter((q) => {
      const userQuest = userQuests.find((uq) => uq.quest_id === q.id);
      const isUnlocked = (q.unlocked_at_level || 1) <= (user?.level || 1);

      // Prüfe Voraussetzung
      let prerequisiteMet = true;
      if (q.prerequisite_quest_number) {
        const prerequisiteQuest = quests.find((pq) => pq.quest_number === q.prerequisite_quest_number);
        if (prerequisiteQuest) {
          const prerequisiteUserQuest = userQuests.find((uq) => uq.quest_id === prerequisiteQuest.id);
          prerequisiteMet = prerequisiteUserQuest?.redeemed || false;
        }
      }

      return !userQuest?.accepted && isUnlocked && prerequisiteMet;
    });

    if (availableRegularQuests.length > 0) {
      if (!insertGuard.current.regular) {
        insertGuard.current.regular = true;
        const quest = availableRegularQuests[0];
        console.log('[UserQuest] Auto-Insert regular:', quest);
        acceptQuestMutation.mutate({
          questId: quest.id,
          questType: 'regular'
        });
      } else {
        console.warn('[UserQuest] Insert regular skipped: already inserted on this page load.');
      }
      return;
    }

    // 2. Weekly Quest automatisch annehmen
    const currentWeeklyQuest = getCurrentWeeklyQuest();
    const currentWeeklyUserQuest = currentWeeklyQuest ? 
      userWeeklyQuests.find((uwq) => uwq.weekly_quest_id === currentWeeklyQuest.id) : null;
    
    if (currentWeeklyQuest && !currentWeeklyUserQuest?.accepted) {
      if (!insertGuard.current.weekly) {
        insertGuard.current.weekly = true;
        console.log('[UserQuest] Auto-Insert weekly:', currentWeeklyQuest);
        acceptQuestMutation.mutate({
          questId: currentWeeklyQuest.id,
          questType: 'weekly',
          activeWeek: getWeekNumber()
        });
      } else {
        console.warn('[UserQuest] Insert weekly skipped: already inserted on this page load.');
      }
      return;
    }

    // 3. Monthly Quest automatisch annehmen
    const currentMonthlyQuest = getCurrentMonthlyQuest();
    const currentMonthlyUserQuest = currentMonthlyQuest ?
      userMonthlyQuests.find((umq) => umq.monthly_quest_id === currentMonthlyQuest.id) : null;
    
    if (currentMonthlyQuest && !currentMonthlyUserQuest?.accepted) {
      if (!insertGuard.current.monthly) {
        insertGuard.current.monthly = true;
        console.log('[UserQuest] Auto-Insert monthly:', currentMonthlyQuest);
        acceptQuestMutation.mutate({
          questId: currentMonthlyQuest.id,
          questType: 'monthly',
          activeMonth: getMonthString()
        });
      } else {
        console.warn('[UserQuest] Insert monthly skipped: already inserted on this page load.');
      }
      return;
    }

    // 4. Collection Quests automatisch annehmen
    const availableCollectionQuests = collectionQuests.filter((quest) => {
      const userQuest = userCollectionQuests.find((ucq) => ucq.collection_quest_id === quest.id);
      return quest.is_active && !userQuest?.accepted;
    });

    if (availableCollectionQuests.length > 0) {
      if (!insertGuard.current.collection) {
        insertGuard.current.collection = true;
        const quest = availableCollectionQuests[0];
        console.log('[UserQuest] Auto-Insert collection:', quest);
        acceptQuestMutation.mutate({
          questId: quest.id,
          questType: 'collection'
        });
      } else {
        console.warn('[UserQuest] Insert collection skipped: already inserted on this page load.');
      }
      return;
    }
  }, [
    user,
    quests,
    userQuests,
    weeklyQuests,
    userWeeklyQuests,
    monthlyQuests,
    userMonthlyQuests,
    collectionQuests,
    userCollectionQuests,
    acceptQuestMutation.isPending
  ]);

  return null; // Unsichtbare Komponente
}


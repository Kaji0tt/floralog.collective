import React, { useEffect } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWeekNumber, getMonthString, getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";

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
    mutationFn: async ({ questId, questType, activeMonth }) => {
      const now = new Date().toISOString();
      if (questType === 'regular') {
        // Falls bereits eine aktive oder abgeschlossene UserQuest existiert, nichts neu anlegen
        const existing = await Query.UserQuest.filter({ auth_id: user.id, quest_id: questId });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Skip regular insert, existing row found:', existing[0]);
          return existing[0];
        }
        return Query.UserQuest.create({
          quest_id: questId,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
          accepted: true,
          accepted_date: now
        });
      } else if (questType === 'weekly') {
        const existing = await Query.UserWeeklyQuest.filter({ auth_id: user.id, weekly_quest_id: questId, active_week: activeWeek });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Skip weekly insert, existing row found:', existing[0]);
          return existing[0];
        }
        return Query.UserWeeklyQuest.create({
          weekly_quest_id: questId,
          active_week: activeWeek,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
          accepted: true,
          accepted_date: now
        });
      } else if (questType === 'monthly') {
        const existing = await Query.UserMonthlyQuest.filter({ auth_id: user.id, monthly_quest_id: questId, active_month: activeMonth });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Skip monthly insert, existing row found:', existing[0]);
          return existing[0];
        }
        return Query.UserMonthlyQuest.create({
          monthly_quest_id: questId,
          active_month: activeMonth,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
          accepted: true,
          accepted_date: now
        });
      } else if (questType === 'collection') {
        const existing = await Query.UserCollectionQuest.filter({ auth_id: user.id, collection_quest_id: questId });
        if (existing && existing.length > 0) {
          console.log('[UserQuest] Skip collection insert, existing row found:', existing[0]);
          return existing[0];
        }
        return Query.UserCollectionQuest.create({
          collection_quest_id: questId,
          auth_id: user.id,
          created_by: user.email,
          status: 'active',
          accepted_at: now,
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

  const currentWeeklyQuest = getCurrentWeeklyQuest(weeklyQuests);
  const currentMonthlyQuest = getCurrentMonthlyQuest(monthlyQuests);

  useEffect(() => {
    if (!user?.email || acceptQuestMutation.isPending) return;

    // 1. Regular Quests automatisch annehmen
    const availableRegularQuests = quests.filter((q) => {
      const userQuest = userQuests.find((uq) => uq.quest_id === q.id);

      // Prüfe Voraussetzung
      let prerequisiteMet = true;
      if (q.prerequisite_quest_number) {
        const prerequisiteQuest = quests.find((pq) => pq.quest_number === q.prerequisite_quest_number);
        if (prerequisiteQuest) {
          const prerequisiteUserQuest = userQuests.find((uq) => uq.quest_id === prerequisiteQuest.id);
          prerequisiteMet = prerequisiteUserQuest?.status
            ? (prerequisiteUserQuest.status === 'redeemed')
            : (prerequisiteUserQuest?.redeemed || false);
        }
      }

      const hasUserQuest = !!userQuest;
      const isAccepted = userQuest?.accepted || !!userQuest?.status;

      return (!hasUserQuest || !isAccepted) && prerequisiteMet;
    });

    if (availableRegularQuests.length > 0) {
      // Alle regulären Quests mit erfüllter Voraussetzung automatisch annehmen
      availableRegularQuests.forEach((quest) => {
        console.log('[UserQuest] Auto-Insert regular:', quest);
        acceptQuestMutation.mutate({
          questId: quest.id,
          questType: 'regular'
        });
      });
    }

    // 2. Weekly quests are assigned as active on app entry. The discovery trigger
    // owns their progress and completion, so this branch only creates the row.
    const currentWeeklyUserQuest = currentWeeklyQuest
      ? userWeeklyQuests.find(
          (userWeeklyQuest) =>
            userWeeklyQuest.weekly_quest_id === currentWeeklyQuest.id &&
            userWeeklyQuest.active_week === getWeekNumber()
        )
      : null;
    if (currentWeeklyQuest && !currentWeeklyUserQuest) {
      if (!insertGuard.current.weekly) {
        insertGuard.current.weekly = true;
        acceptQuestMutation.mutate({
          questId: currentWeeklyQuest.id,
          questType: 'weekly',
          activeWeek: getWeekNumber()
        });
        return;
      }
    }

    // 3. Monthly Quest automatisch annehmen
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
        return;
      } else {
        console.warn('[UserQuest] Insert monthly skipped: already inserted on this page load.');
      }
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
        return;
      } else {
        console.warn('[UserQuest] Insert collection skipped: already inserted on this page load.');
      }
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


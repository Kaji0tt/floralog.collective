import HomeEventStripe from "@/components/home/HomeEventStripe";
import { trackAction } from "@/api/analyticsService";
import {
  formatCommunityEventRemaining,
  getCommunityEventTargetLabel,
  getCommunityEventTheme,
  getNextCommunityEventTier,
  pluralizeCommunityEventTarget,
  useCommunityEvent,
} from "@/lib/communityEvents";

function buildCommunityEventStripeItem({ event, phase, progress, target, contributedCount, onOpenAchievements }) {
  if (!event || phase !== "active") return null;
  const nextTier = getNextCommunityEventTier(event, contributedCount);
  const remaining = Math.max(0, target - progress);
  const targetLabel = getCommunityEventTargetLabel(event);
  const targetPlural = pluralizeCommunityEventTarget(targetLabel);
  const theme = getCommunityEventTheme(event);

  let description;
  if (phase === "succeeded") {
    description = `Geschafft! Gemeinsam habt ihr ${progress} ${targetPlural} kartiert. Die Belohnungen wurden verteilt.`;
  } else if (phase === "failed" || phase === "ended") {
    description = `Das Event ist beendet: ${progress} von ${target} ${targetPlural} kartiert.`;
  } else if (remaining <= 0) {
    description = `Ziel erreicht! Scannt weiter bis zum Ende – jeder Scan bringt euch höhere Belohnungsstufen.`;
  } else {
    description = `Noch ${remaining} ${remaining === 1 ? targetLabel : targetPlural} bis zum Gemeinschaftsziel. ${event.description || ""}`.trim();
  }

  let personalLabel = `Dein Beitrag: ${contributedCount}`;
  if (phase === "active" && nextTier) {
    personalLabel += ` · nächste Stufe ab ${nextTier.min}`;
  }

  return {
    id: `community-event-${event.id}`,
    kind: "community",
    highlight: true,
    theme: theme.key,
    icon: event.icon_emoji || theme.emoji,
    title: event.title,
    metaLabel: phase === "active" ? formatCommunityEventRemaining(event) : "beendet",
    description,
    progressCurrent: progress,
    progressTarget: target,
    progressPrefix: "Community ",
    personalLabel,
    isCompleted: false,
    onClick: () => {
      trackAction("home_event_stripe_community", { sourcePage: "Home" });
      onOpenAchievements?.();
    },
  };
}

export default function HomeEventStripeContent({
  userId,
  isLightUi,
  displayedWeeklyQuest,
  currentWeeklyUserQuest,
  activeWeeklyQuest,
  availableWeeklyQuest,
  currentMonthlyQuest,
  currentMonthlyUserQuest,
  activeMonthlyQuest,
  availableMonthlyQuest,
  isRedeemedStatus,
  onOpenAchievements,
}) {
  const communityEvent = useCommunityEvent(userId, { enabled: Boolean(userId) });
  const communityEventItem = buildCommunityEventStripeItem({ ...communityEvent, onOpenAchievements });

  const homeEventStripeItems = [];
  if (communityEventItem) homeEventStripeItems.push(communityEventItem);
  homeEventStripeItems.push({
    id: "geozone-info",
    kind: "geo-info",
    title: "Gemeinsam erkunden",
    dismissible: true,
    description: "Erkunde Geozonen auf der Karte, um Knospen mit besonderen Belohnungen freizuschalten und neue Areale zu erschließen. Teile eine Geozone mit Freunden: Erkundet ihr sie innerhalb von 30 Minuten, gilt die Belohnung für euch beide und ihr erhaltet garantiert je 3 Areale.",
  });

  if (displayedWeeklyQuest && !isRedeemedStatus(currentWeeklyUserQuest)) {
    const weeklyQuestTargetLabel = displayedWeeklyQuest.target_species_name
      || displayedWeeklyQuest.target_genus_name
      || displayedWeeklyQuest.title;
    homeEventStripeItems.push({
      id: `weekly-quest-${displayedWeeklyQuest.id}`,
      kind: "weekly",
      title: weeklyQuestTargetLabel,
      description: displayedWeeklyQuest.description,
      progressCurrent: Number(currentWeeklyUserQuest?.progress || 0),
      progressTarget: Number(displayedWeeklyQuest.required_discoveries || 0),
      isCompleted: activeWeeklyQuest?.isCompleted || false,
      isAvailable: Boolean(availableWeeklyQuest),
      onClick: () => {
        trackAction("home_event_stripe_weekly", { sourcePage: "Home" });
        onOpenAchievements?.();
      },
    });
  }

  if (currentMonthlyQuest && !isRedeemedStatus(currentMonthlyUserQuest)) {
    homeEventStripeItems.push({
      id: `monthly-quest-${currentMonthlyQuest.id}`,
      kind: "monthly",
      title: currentMonthlyQuest.title,
      description: currentMonthlyQuest.description,
      progressCurrent: Number(currentMonthlyUserQuest?.progress || 0),
      progressTarget: Number(currentMonthlyQuest.required_discoveries || 0),
      isCompleted: activeMonthlyQuest?.isCompleted || false,
      isAvailable: Boolean(availableMonthlyQuest),
      onClick: () => {
        trackAction("home_event_stripe_monthly", { sourcePage: "Home" });
        onOpenAchievements?.();
      },
    });
  }

  return <HomeEventStripe isLightUi={isLightUi} events={homeEventStripeItems} />;
}
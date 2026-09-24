import HomeEventStripe from "@/components/home/HomeEventStripe";
import { trackAction } from "@/api/analyticsService";

export default function HomeEventStripeContent({
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
  const homeEventStripeItems = [{
    id: "geozone-info",
    kind: "geo-info",
    title: "Gemeinsam erkunden",
    dismissible: true,
    description: "Erkunde Geozonen auf der Karte, um Knospen mit besonderen Belohnungen freizuschalten und neue Areale zu erschließen. Teile eine Geozone mit Freunden: Erkundet ihr sie innerhalb von 30 Minuten, gilt die Belohnung für euch beide und ihr erhaltet garantiert je 3 Areale.",
  }];

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
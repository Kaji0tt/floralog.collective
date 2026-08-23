import { AnimatePresence } from "framer-motion";
import HomeFlorabotOverlay from "@/components/home/HomeFlorabotOverlay";

export default function HomeMilestoneOverlayToggle({
  isOpen,
  milestone,
  profile,
  authId,
  currentUser,
  badgeMetrics = null,
  initialShopCategory = "root",
  initialShopOpen = false,
  logoAssets = [],
  playerSparks,
  playerAmber,
  plantHealthState,
  healthStats = [],
  ambientMessage,
  quizAvailable = false,
  onQuizClick,
  scanStreakStatus = null,
  careInteractionCountToday = 0,
  careInteractionLimitPerDay = 3,
  remainingCareInteractionsToday = 0,
  isDailyCareLoading = false,
  isCareInteractionPending = false,
  onSpawnBubble,
  onCustomize,
  onUserUpdated,
  onClose,
}) {
  return (
    <AnimatePresence>
      {isOpen && milestone ? (
        <HomeFlorabotOverlay
          profile={profile}
          authId={authId}
          currentUser={currentUser}
          badgeMetrics={badgeMetrics}
          initialShopCategory={initialShopCategory}
          initialShopOpen={initialShopOpen}
          logoAssets={logoAssets}
          playerSparks={playerSparks}
          playerAmber={playerAmber}
          plantHealthState={plantHealthState}
          healthStats={healthStats}
          ambientMessage={ambientMessage}
          quizAvailable={quizAvailable}
          onQuizClick={onQuizClick}
          scanStreakStatus={scanStreakStatus}
          careInteractionCountToday={careInteractionCountToday}
          careInteractionLimitPerDay={careInteractionLimitPerDay}
          remainingCareInteractionsToday={remainingCareInteractionsToday}
          isDailyCareLoading={isDailyCareLoading}
          isCareInteractionPending={isCareInteractionPending}
          onSpawnBubble={onSpawnBubble}
          onCustomize={onCustomize}
          onUserUpdated={onUserUpdated}
          onClose={() => onClose?.()}
        />
      ) : null}
    </AnimatePresence>
  );
}

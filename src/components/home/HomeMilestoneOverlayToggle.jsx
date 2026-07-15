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
  logoAssets = [],
  playerSparks,
  playerAmber,
  plantHealthState,
  healthStats = [],
  ambientMessage,
  wateringCountToday = 0,
  wateringLimitPerDay = 3,
  remainingWatersToday = 0,
  isDailyCareLoading = false,
  isWateringPending = false,
  onWaterPlant = () => {},
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
          logoAssets={logoAssets}
          playerSparks={playerSparks}
          playerAmber={playerAmber}
          plantHealthState={plantHealthState}
          healthStats={healthStats}
          ambientMessage={ambientMessage}
          wateringCountToday={wateringCountToday}
          wateringLimitPerDay={wateringLimitPerDay}
          remainingWatersToday={remainingWatersToday}
          isDailyCareLoading={isDailyCareLoading}
          isWateringPending={isWateringPending}
          onWaterPlant={onWaterPlant}
          onSpawnBubble={onSpawnBubble}
          onCustomize={onCustomize}
          onUserUpdated={onUserUpdated}
          onClose={() => onClose?.()}
        />
      ) : null}
    </AnimatePresence>
  );
}

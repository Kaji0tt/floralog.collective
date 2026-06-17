import { AnimatePresence } from "framer-motion";
import HomeFlorabotOverlay from "@/components/home/HomeFlorabotOverlay";

export default function HomeMilestoneOverlayToggle({
  isOpen,
  milestone,
  profile,
  authId,
  currentUser,
  initialShopCategory = "accessories",
  logoAssets = [],
  playerSparks,
  playerAmber,
  plantHealthState,
  healthStats = [],
  ambientMessage,
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
          initialShopCategory={initialShopCategory}
          logoAssets={logoAssets}
          playerSparks={playerSparks}
          playerAmber={playerAmber}
          plantHealthState={plantHealthState}
          healthStats={healthStats}
          ambientMessage={ambientMessage}
          onCustomize={onCustomize}
          onUserUpdated={onUserUpdated}
          onClose={() => onClose?.()}
        />
      ) : null}
    </AnimatePresence>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUiTheme } from "@/lib/UiThemeContext";
import HomeBackgroundShell from "@/components/home/HomeBackgroundShell";
import HomeBottomNavigation from "@/components/navigation/HomeBottomNavigation";
import HomeShellBorderGlow from "@/components/effects/HomeShellBorderGlow";
import HomeRarityBorderGlow from "@/components/effects/HomeRarityBorderGlow";
import { getRgbaFromRgb } from "@/lib/friendColorUtils";
import { getNavButtonStyle, NAV_COLOR_ORDER } from "@/components/navigation/navButtonStyles";
import { hexToFilter } from "@/lib/hexToFilter";
import { Leaf, Users, Scroll, Home as HomeIcon, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ─── Friend tab definitions ───────────────────────────────────────────────────
const FRIEND_TABS = [
  { id: "collection",   label: "Entdeckungen",  icon: Leaf },
  { id: "achievements", label: "Erfolge",   icon: Scroll },
  { id: "friends",      label: "Freunde",   icon: Users },
  { id: "profile",      label: "Profil",    icon: HomeIcon },
];

// ─── Shell ────────────────────────────────────────────────────────────────────
/**
 * FriendExperienceShell
 *
 * Shared layout shell used by all four Friend pages.
 * Reuses HomeBackgroundShell, HomeHeaderBar and HomeBottomNavigation
 * so the look is identical to the new Home experience.
 *
 * Props:
 *   friendUser    — resolved friend PublicProfile (or fallback stub)
 *   activeTab     — "profile" | "achievements" | "collection" | "friends"
 *   friendEmail   — raw email string from URL param
 *   averageColor  — computed background dominant color (may be null)
 *   isLoading     — show spinner when true
 *   accessDenied  — show access-denied state when true
 *   children      — page content (manages its own overflow)
 */
export default function FriendExperienceShell({
  friendUser,
  friendLogoAssets,
  activeTab,
  friendEmail,
  friendAuthId,
  showFriendsTab = false,
  averageColor,
  isLoading,
  _accessDenied,
  onTabChange,
  children,
}) {
  const navigate = useNavigate();
  const { isLightUi } = useUiTheme();
  const [showSocialLockedDialog, setShowSocialLockedDialog] = useState(false);

  // HomeBackgroundShell expects a user-like object with background fields
  const bgUser = friendUser
    ? {
        background_image_url: friendUser.background_image_url ?? null,
        background_color: friendUser.background_color ?? averageColor ?? null,
      }
    : null;

  // ── Bottom nav items ─────────────────────────────────────────────────────
  const visibleTabs = FRIEND_TABS;
  const navItems = useMemo(() => visibleTabs.map((tab) => {
    const isActive = tab.id === activeTab;
    const isLocked = tab.id === "friends" && !showFriendsTab;
    const { gradientClass, shadowStyle } = getNavButtonStyle({
      palette: NAV_COLOR_ORDER[visibleTabs.findIndex((item) => item.id === tab.id)],
      isLightUi,
      isActive: isActive && !isLocked,
    });
    return {
      label: tab.label,
      icon: tab.icon,
      isActive: isActive && !isLocked,
      isDisabled: isLocked,
      onClick: () => {
        if (isLocked) {
          setShowSocialLockedDialog(true);
          return;
        }
        if (isActive) return;
        if (typeof onTabChange === "function") {
          onTabChange(tab.id);
          return;
        }
        if (!friendAuthId) return;
        navigate(
          createPageUrl(
            `FriendProfile?auth_id=${encodeURIComponent(friendAuthId)}&tab=${encodeURIComponent(tab.id)}`
          )
        );
      },
      gradientClass,
      shadowStyle,
    };
  }), [activeTab, friendAuthId, friendEmail, isLightUi, navigate, onTabChange, showFriendsTab, visibleTabs]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <HomeBackgroundShell user={bgUser} getRgbaFromRgb={getRgbaFromRgb}>
        <div className="flex items-center justify-center w-full h-full">
          <Leaf
            className={`w-12 h-12 animate-spin ${
              isLightUi ? "text-emerald-700" : "text-[#f0e5a5]"
            }`}
          />
        </div>
      </HomeBackgroundShell>
    );
  }

  const friendDisplayName =
    friendUser?.display_name || friendUser?.full_name || friendEmail;
  const friendTitle =
    friendUser?.selected_title || friendUser?.title || "Pflanzen-Entdecker";

  // ── Normal layout ────────────────────────────────────────────────────────
  return (
    <HomeBackgroundShell user={bgUser} getRgbaFromRgb={getRgbaFromRgb}>
      <Dialog open={showSocialLockedDialog} onOpenChange={setShowSocialLockedDialog}>
        <DialogContent className={`max-w-md rounded-2xl border ${isLightUi ? "border-[#c8ac62]/40 bg-white text-stone-900" : "border-[#f0e5a5]/20 bg-[#151912] text-stone-100"}`}>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <UserPlus className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl">Freundesdaten gesperrt</DialogTitle>
            <DialogDescription className={isLightUi ? "text-stone-600" : "text-stone-300"}>
              Du musst mit dieser Person befreundet sein, bevor du deren Social-Ansicht öffnest.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative h-full w-full overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={bgUser?.background_image_url ? {
            backgroundImage: isLightUi
              ? `linear-gradient(180deg, rgba(255,246,210,0.65) 0%, rgba(244,230,181,0.75) 100%), url(${bgUser.background_image_url})`
              : `linear-gradient(180deg, rgba(19,37,24,0.42) 0%, rgba(12,20,15,0.66) 100%), url(${bgUser.background_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : bgUser?.background_color ? {
            background: isLightUi
              ? `linear-gradient(180deg, ${getRgbaFromRgb(bgUser.background_color, 0.25)} 0%, rgba(255, 249, 225, 0.9) 100%)`
              : `linear-gradient(180deg, ${getRgbaFromRgb(bgUser.background_color, 0.28)} 0%, rgba(14, 22, 16, 0.74) 100%)`,
          } : {
            background: isLightUi
              ? "linear-gradient(180deg, rgba(255, 248, 221, 0.92) 0%, rgba(243, 229, 183, 0.9) 100%)"
              : "linear-gradient(180deg, rgba(126, 171, 98, 0.45) 0%, rgba(10, 22, 15, 0.78) 100%)",
          }}
        />
        <HomeShellBorderGlow active={friendUser?.selected_profile_effect === "shell_border_glow"} />
        <HomeRarityBorderGlow active={friendUser?.selected_logo_effect === "rarity_border_glow"} borderColor={friendUser?.selected_border_color} />

        <div className="relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6">
          <header className="shrink-0 flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <div className={`relative w-12 h-12 rounded-full border overflow-hidden shrink-0 ${
                isLightUi ? "border-[#c8ac62]/55 bg-white/60" : "border-[#f0e5a5]/35 bg-black/35"
              }`}>
                <div className="absolute inset-[10%]">
                  {(friendLogoAssets?.border?.imageUrl || friendLogoAssets?.plant?.imageUrl || friendLogoAssets?.face?.imageUrl) && (
                    <div className="absolute left-1/2 top-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
                  )}
                  {friendLogoAssets?.border?.imageUrl && (
                    <img
                      src={friendLogoAssets.border.imageUrl}
                      alt="Logo Rahmen"
                      className="absolute inset-0 w-full h-full object-contain"
                      style={friendLogoAssets.borderColor
                        ? { filter: `brightness(0) saturate(100%) ${hexToFilter(friendLogoAssets.borderColor)}` }
                        : undefined}
                    />
                  )}
                  {friendLogoAssets?.plant?.imageUrl && (
                    <img
                      src={friendLogoAssets.plant.imageUrl}
                      alt="Logo Pflanze"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  )}
                  {friendLogoAssets?.face?.imageUrl && (
                    <img
                      src={friendLogoAssets.face.imageUrl}
                      alt="Logo Gesicht"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  )}
                  {!friendLogoAssets?.border?.imageUrl && !friendLogoAssets?.plant?.imageUrl && !friendLogoAssets?.face?.imageUrl && (
                    <Leaf className={`w-full h-full ${isLightUi ? "text-emerald-700" : "text-[#f0e5a5]"}`} />
                  )}
                </div>
              </div>

              <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold leading-tight text-white truncate" title={friendDisplayName}>
                {friendDisplayName}
              </h1>
              <p className="mt-1 text-sm md:text-base text-white/90 truncate" title={friendTitle}>
                {friendTitle}
              </p>
            </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(createPageUrl("Home"))}
              className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors shrink-0 ${
                isLightUi
                  ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80"
                  : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"
              }`}
              aria-label="Zur Home-Ansicht"
            >
              <HomeIcon className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
            </button>
          </header>

          <div className={`my-[clamp(0.5rem,1.2vh,1rem)] h-px ${isLightUi ? "bg-[#c8ac62]/35" : "bg-[#f0e5a5]/25"}`} />

          <section
            className="relative flex-1 min-h-0 rounded-3xl overflow-hidden bg-transparent"
          >
            <div className="relative z-10 h-full">
              {children}
            </div>
          </section>

          <div className="mt-[clamp(0.5rem,1.2vh,1rem)] shrink-0">
            <HomeBottomNavigation
              navItems={navItems}
              controlsScale={1}
              centerContext="outside"
              onCenterAction={() => navigate(createPageUrl("Home"))}
            />
          </div>
        </div>
      </motion.div>
    </HomeBackgroundShell>
  );
}

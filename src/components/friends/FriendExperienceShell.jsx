import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUiTheme } from "@/lib/UiThemeContext";
import HomeBackgroundShell from "@/components/home/HomeBackgroundShell";
import HomeHeaderBar from "@/components/navigation/HomeHeaderBar";
import HomeBottomNavigation from "@/components/navigation/HomeBottomNavigation";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import { getRgbaFromRgb } from "@/lib/friendColorUtils";
import { Leaf, Users, Lock, Scroll, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

// ─── Friend tab definitions ───────────────────────────────────────────────────
const FRIEND_TABS = [
  { id: "profile",      label: "Profil",    icon: Leaf   },
  { id: "achievements", label: "Erfolge",   icon: Scroll },
  { id: "collection",   label: "Sammlung",  icon: BookOpen },
  { id: "friends",      label: "Freunde",   icon: Users  },
];

const TAB_PAGES = {
  profile:      "FriendProfile",
  achievements: "FriendAchievements",
  collection:   "FriendCollection",
  friends:      "FriendFriendsList",
};

// ─── Nav button gradient/shadow tokens ────────────────────────────────────────
const getNavGradient = (isActive, isLightUi) => {
  if (isActive) {
    return isLightUi
      ? "bg-gradient-to-b from-[#f8f1cf]/95 via-[#efe3b3]/95 to-[#e4d591]/95"
      : "bg-gradient-to-b from-[#2b4a3a]/90 via-[#1a2f25]/96 to-[#0b1713]/99";
  }
  return isLightUi
    ? "bg-gradient-to-b from-[#f8f1cf]/60 via-[#efe3b3]/60 to-[#e4d591]/60"
    : "bg-gradient-to-b from-[#1e2b22]/70 via-[#131d19]/85 to-[#060d0a]/92";
};

const getNavShadow = (isActive, isLightUi) =>
  isLightUi
    ? `inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -12px 18px rgba(133,105,40,${isActive ? "0.22" : "0.12"}), 0 8px 16px rgba(133,105,40,${isActive ? "0.24" : "0.12"})`
    : `inset 0 1px 0 rgba(214,255,230,${isActive ? "0.20" : "0.10"}), inset 0 -12px 18px rgba(0,0,0,${isActive ? "0.46" : "0.32"}), 0 8px 16px rgba(0,0,0,${isActive ? "0.32" : "0.2"})`;

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
  activeTab,
  friendEmail,
  averageColor,
  isLoading,
  accessDenied,
  children,
}) {
  const navigate = useNavigate();
  const { isLightUi } = useUiTheme();

  // HomeBackgroundShell expects a user-like object with background fields
  const bgUser = friendUser
    ? {
        background_image_url: friendUser.background_image_url ?? null,
        background_color: friendUser.background_color ?? averageColor ?? null,
      }
    : null;

  // ── Bottom nav items ─────────────────────────────────────────────────────
  const navItems = FRIEND_TABS.map((tab) => {
    const isActive = tab.id === activeTab;
    return {
      label:         tab.label,
      icon:          tab.icon,
      isActive,
      onClick:       () => {
        if (isActive) return;
        navigate(createPageUrl(`${TAB_PAGES[tab.id]}?email=${encodeURIComponent(friendEmail ?? "")}`));
      },
      gradientClass: getNavGradient(isActive, isLightUi),
      shadowStyle:   getNavShadow(isActive, isLightUi),
    };
  });

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

  // ── Access denied state ──────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <HomeBackgroundShell user={null} getRgbaFromRgb={getRgbaFromRgb}>
        <MobileBackButton backUrl={createPageUrl("Friends")} />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="flex flex-col items-center justify-center h-full gap-6 text-center px-6 w-full"
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isLightUi ? "bg-red-100" : "bg-red-900/30"
            }`}
          >
            <Lock
              className={`w-8 h-8 ${isLightUi ? "text-red-600" : "text-red-400"}`}
            />
          </div>
          <div>
            <h2
              className={`text-2xl font-bold mb-2 ${
                isLightUi ? "text-stone-900" : "text-stone-100"
              }`}
            >
              Zugriff verweigert
            </h2>
            <p
              className={`text-base ${
                isLightUi ? "text-stone-600" : "text-stone-400"
              }`}
            >
              Du musst mit dieser Person befreundet sein, um diese Seite zu sehen.
            </p>
          </div>
          <button
            onClick={() => navigate(createPageUrl("Friends"))}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              isLightUi
                ? "bg-white/80 border border-[#c8ac62]/55 text-[#8f6b22] hover:bg-white"
                : "bg-black/35 border border-[#f0e5a5]/35 text-[#f0e5a5] hover:bg-black/45"
            }`}
          >
            Zurück zu Freunden
          </button>
        </motion.div>
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
      <MobileBackButton backUrl={createPageUrl("Friends")} />

      {/* Same max-width and flex layout as the Home page inner container */}
      <div className="w-full max-w-md md:max-w-3xl h-full flex flex-col gap-[clamp(0.5rem,1.2vh,1rem)]">
        {/* Header – reuse HomeHeaderBar with "friend" panel mode */}
        <HomeHeaderBar
          activePanel="friend"
          embeddedTitle={friendDisplayName}
          embeddedSubtitle={friendTitle}
          displayName={friendDisplayName}
          userTitle={friendTitle}
          onPrimaryAction={() => navigate(createPageUrl("Home"))}
        />

        {/* Content – each page controls its own overflow */}
        <div className="flex-1 min-h-0">
          {children}
        </div>

        {/* Bottom navigation */}
        <HomeBottomNavigation navItems={navItems} controlsScale={1} />
      </div>
    </HomeBackgroundShell>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { useUiTheme } from "@/lib/UiThemeContext";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trophy, Lock, Loader2 } from "lucide-react";

export default function FriendAchievementsPanel({ friendUser }) {
  const { isLightUi } = useUiTheme();

  const { data: achievements = [], isLoading: achievementsLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => Query.Achievement.list("achievement_number"),
  });

  const { data: userAchievements = [], isLoading: userAchievementsLoading } = useQuery({
    queryKey: ["userAchievements", friendUser?.auth_id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: friendUser.auth_id }),
    enabled: !!friendUser?.auth_id,
  });

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case "Ungewöhnlich": return "bg-green-500";
      case "Selten": return "bg-blue-500";
      case "Episch": return "bg-purple-500";
      case "Legendär": return "bg-amber-500";
      default: return "bg-stone-400";
    }
  };

  const getRarityValue = (rarity) => {
    switch (rarity) {
      case "Ungewöhnlich": return 1;
      case "Selten": return 2;
      case "Episch": return 3;
      case "Legendär": return 4;
      default: return 0;
    }
  };

  const isTextTitleReward = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return false;
    if (/^https?:\/\//i.test(normalized)) return false;
    if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(normalized)) return false;
    return true;
  };

  const sortedAchievements = [...achievements].sort(
    (a, b) => getRarityValue(a.rarity) - getRarityValue(b.rarity)
  );
  const unlockedAchievements = sortedAchievements.filter((a) =>
    userAchievements.some((ua) => ua.achievement_id === a.id)
  );
  const lockedAchievements = sortedAchievements.filter(
    (a) => !userAchievements.some((ua) => ua.achievement_id === a.id)
  );
  const unlockedCount = unlockedAchievements.length;
  const totalAchievements = achievements.length;

  const cardSurface = isLightUi
    ? "bg-white/65 border border-[#c8ac62]/35 backdrop-blur-md"
    : "bg-black/30 border border-[#f0e5a5]/20 backdrop-blur-md";
  const cardUnlocked = isLightUi
    ? "bg-amber-50/70 border border-amber-300/60 backdrop-blur-md"
    : "bg-amber-900/20 border border-amber-400/30 backdrop-blur-md";
  const cardLocked = isLightUi
    ? "bg-stone-100/60 border border-stone-300/50 backdrop-blur-md opacity-55"
    : "bg-stone-800/20 border border-stone-600/30 backdrop-blur-md opacity-55";
  const textPrimary = isLightUi ? "text-stone-900" : "text-stone-100";
  const textSecondary = isLightUi ? "text-stone-600" : "text-stone-300";
  const textMuted = isLightUi ? "text-stone-500" : "text-stone-400";

  if ((achievementsLoading || userAchievementsLoading) && achievements.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Erfolge werden geladen
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-[clamp(0.75rem,2vw,1.25rem)] pb-[clamp(1rem,2.5vh,1.5rem)] space-y-3">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`rounded-2xl p-3 flex items-center gap-3 ${cardSurface}`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isLightUi ? "bg-amber-100" : "bg-amber-900/40"
          }`}
        >
          <Trophy className={`w-5 h-5 ${isLightUi ? "text-amber-600" : "text-amber-400"}`} />
        </div>
        <div>
          <div className={`text-xl font-bold ${isLightUi ? "text-amber-700" : "text-amber-400"}`}>
            {unlockedCount} / {totalAchievements}
          </div>
          <div className={`text-xs ${textSecondary}`}>Erfolge freigeschaltet</div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {unlockedAchievements.map((achievement, index) => {
          const userAchievement = userAchievements.find(
            (ua) => ua.achievement_id === achievement.id
          );
          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`rounded-2xl p-4 ${cardUnlocked}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">{achievement.icon_emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold text-white px-2 py-0.5 rounded-full ${getRarityColor(achievement.rarity)}`}
                    >
                      {achievement.rarity}
                    </span>
                    <div
                      className={`ml-auto w-6 h-6 rounded-full flex items-center justify-center ${
                        isLightUi ? "bg-amber-400" : "bg-amber-600"
                      }`}
                    >
                      <Trophy className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <h3 className={`font-bold text-base mb-0.5 ${textPrimary}`}>
                    {achievement.title}
                  </h3>
                  <p className={`text-xs mb-1 ${textSecondary}`}>
                    {achievement.description}
                  </p>
                  <p className={`text-xs font-semibold ${textMuted}`}>
                    {achievement.requirement}
                  </p>
                  {isTextTitleReward(achievement.title_reward) && (
                    <p className={`text-xs mt-1 ${isLightUi ? "text-purple-700" : "text-purple-300"}`}>
                      ⭐ Titel: „{achievement.title_reward}"
                    </p>
                  )}
                  {userAchievement?.unlocked_date && (
                    <p className={`text-[10px] mt-1 ${textMuted}`}>
                      Freigeschaltet am {" "}
                      {format(new Date(userAchievement.unlocked_date), "d. MMMM yyyy", {
                        locale: de,
                      })}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {lockedAchievements.map((achievement, index) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (unlockedCount + index) * 0.04 }}
            className={`rounded-2xl p-4 ${cardLocked}`}
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl flex-shrink-0 grayscale opacity-40">
                {achievement.icon_emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full bg-stone-400">
                    {achievement.rarity}
                  </span>
                  <div className="ml-auto w-6 h-6 rounded-full bg-stone-400/60 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-white/70" />
                  </div>
                </div>
                <h3 className={`font-bold text-base mb-0.5 ${textSecondary}`}>
                  {achievement.title}
                </h3>
                <p className={`text-xs mb-1 ${textMuted}`}>
                  {achievement.description}
                </p>
                <p className={`text-xs font-semibold ${textMuted}`}>
                  {achievement.requirement}
                </p>
                {isTextTitleReward(achievement.title_reward) && (
                  <p className={`text-xs mt-1 ${textMuted}`}>
                    ⭐ Titel: „{achievement.title_reward}"
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {sortedAchievements.length === 0 && (
        <div className={`rounded-2xl p-12 text-center ${cardSurface}`}>
          <Trophy className={`w-12 h-12 mx-auto mb-3 ${textMuted}`} />
          <p className={`font-semibold ${textSecondary}`}>
            Noch keine Erfolge verfügbar
          </p>
        </div>
      )}
    </div>
  );
}

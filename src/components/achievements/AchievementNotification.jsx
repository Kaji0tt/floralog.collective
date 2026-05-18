import React from "react";
import { motion } from "framer-motion";
import { Trophy, Sparkles } from "lucide-react";

export default function AchievementNotification({ achievement, onComplete }) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const getRarityColor = (rarity) => {
    switch(rarity) {
      case "Gewöhnlich": return "from-gray-500 to-gray-600";
      case "Selten": return "from-blue-500 to-blue-600";
      case "Episch": return "from-purple-500 to-purple-600";
      case "Legendär": return "from-amber-400 to-amber-600";
      default: return "from-gray-500 to-gray-600";
    }
  };

  const normalizedTitleReward = String(achievement?.title_reward || "").trim();
  const titleRewardLooksLikeBackground =
    /^https?:\/\//i.test(normalizedTitleReward) ||
    /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(normalizedTitleReward);
  const hasVisibleTitleReward = Boolean(normalizedTitleReward) && !titleRewardLooksLikeBackground;

  return (
    <motion.div
      initial={{ opacity: 0, y: -100, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ type: "spring", damping: 15 }}
      className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] pointer-events-none"
    >
      <div className={`bg-gradient-to-r ${getRarityColor(achievement.rarity)} rounded-2xl shadow-2xl border-4 border-white p-6 min-w-[320px] max-w-md`}>
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1.1, 1.1, 1.1, 1]
            }}
            transition={{ duration: 0.6, repeat: 2 }}
            className="text-5xl"
          >
            {achievement.icon_emoji}
          </motion.div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-bold uppercase tracking-wide">
                Erfolg freigeschaltet!
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {achievement.title}
            </h3>
            <p className="text-white/90 text-sm">
              {achievement.description}
            </p>
            {hasVisibleTitleReward && (
              <div className="mt-2 bg-white/20 rounded-lg px-3 py-1 inline-block">
                <span className="text-white text-xs font-semibold">
                  ⭐ Titel: "{normalizedTitleReward}"
                </span>
              </div>
            )}
            {titleRewardLooksLikeBackground && (
              <div className="mt-2 bg-white/20 rounded-lg px-3 py-1 inline-block">
                <span className="text-white text-xs font-semibold">
                  🎨 Neuer Hintergrund freigeschaltet
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sparkle Effekte */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const distance = 80;
        return (
          <motion.div
            key={i}
            initial={{ 
              x: 0,
              y: 0,
              scale: 0,
              opacity: 0
            }}
            animate={{ 
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              scale: [0, 1, 0],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 1,
              delay: 0.3 + i * 0.1,
              ease: "easeOut"
            }}
            className="absolute top-1/2 left-1/2"
          >
            <Sparkles className="w-6 h-6 text-amber-400" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
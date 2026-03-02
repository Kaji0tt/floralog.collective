import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export default function ScanFeedbackNotification({ feedback, onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!feedback) return null;

  const { type, plantName, questTitle, rewardName } = feedback;

  let title = "Scan erfolgreich!";
  let message = "Dein Scan wurde gespeichert.";
  let containerClasses = "bg-emerald-50/95 border-emerald-200";
  let ringClasses = "bg-emerald-200";
  let emojiSet = [
    "✨",
    "✨",
    "✨"
  ];
  let animationVariant = "rescanned";

  if (type === "rescanned") {
    title = "Erneut gescannt";
    message = plantName
      ? `${plantName} wurde erneut bestätigt.`
      : "Deine Pflanze wurde erneut bestätigt.";
    containerClasses = "bg-emerald-50/95 border-emerald-200";
    ringClasses = "bg-emerald-200/70";
    emojiSet = ["✨", "🌿", "✨"];
    animationVariant = "rescanned";
  } else if (type === "newDiscovery") {
    title = "Neue Entdeckung!";
    message = plantName
      ? `${plantName} wurde zu deinem Floralog hinzugefügt.`
      : "Eine neue Pflanze wurde deinem Floralog hinzugefügt.";
    containerClasses = "bg-emerald-50/95 border-emerald-300";
    ringClasses = "bg-emerald-300/80";
    emojiSet = ["✨", "🌿", "✨", "🌱"]; 
    animationVariant = "newDiscovery";
  } else if (type === "globalNewPlant") {
    title = "Globales Floralog erweitert!";
    message = plantName
      ? `${plantName} ist jetzt im globalen Floralog verfügbar.`
      : "Eine neue Pflanze ist jetzt im globalen Floralog verfügbar.";
    containerClasses = "bg-amber-50/95 border-amber-300";
    ringClasses = "bg-amber-300/80";
    emojiSet = ["✨", "🌟", "✨", "🌼"]; 
    animationVariant = "globalNewPlant";
  } else if (type === "questCompleted") {
    title = "Quest abgeschlossen!";
    message = questTitle
      ? `Du hast "${questTitle}" erfolgreich abgeschlossen.`
      : "Du hast eine Quest erfolgreich abgeschlossen.";
    if (rewardName) {
      message += ` Belohnung: ${rewardName}.`;
    }
    containerClasses = "bg-emerald-50/95 border-emerald-300";
    ringClasses = "bg-emerald-300/80";
    emojiSet = ["✨", "🎯", "🎁", "✨"]; 
    animationVariant = "newDiscovery";
  }

  // Emoji-Startpositionen einmal pro Mount berechnen, damit sie "zufällig" wirken,
  // aber nicht bei jedem Re-Render springen
  const emojiPositions = useMemo(() => {
    return emojiSet.map((_, index) => {
      // Basiswinkel um die Karte herum
      const baseAngle = (index / emojiSet.length) * Math.PI * 2;
      // Leichte zufällige Abweichung je Emoji
      const jitter = (Math.random() - 0.5) * (Math.PI / 6);
      const angle = baseAngle + jitter;

      // Radius knapp außerhalb der Kachel
      const radius = 80;
      const x = Math.cos(angle) * radius;

      // Start eher im unteren Bereich rund um die Karte
      const y = Math.sin(angle) * radius + 10;

      // Ziel: ein Stück weiter oben (Floating-Effekt von unten nach oben)
      const targetY = y - 35;

      return { x, y, targetY };
    });
  }, [emojiSet.length]);

  const variants = {
    rescanned: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 }
    },
    newDiscovery: {
      initial: { opacity: 0, scale: 0.7 },
      animate: { opacity: 1, scale: 1.05 },
      exit: { opacity: 0, scale: 0.9 }
    },
    globalNewPlant: {
      initial: { opacity: 0, scale: 0.6, rotate: -4 },
      animate: { opacity: 1, scale: 1.06, rotate: 0 },
      exit: { opacity: 0, scale: 0.9, rotate: 2 }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      <motion.div
        variants={variants[animationVariant]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 16, stiffness: 260 }}
        className={`relative pointer-events-auto ${containerClasses} backdrop-blur-md rounded-2xl shadow-xl border px-6 py-4 max-w-sm w-[90%] flex flex-col items-center text-center`}
      >
        <div className={`absolute -inset-px rounded-2xl opacity-40 blur-xl ${ringClasses}`} />
        <div className="relative z-10 flex flex-col items-center">
          <h3 className="text-lg font-bold text-stone-900 mb-1">{title}</h3>
          <p className="text-sm text-stone-700">{message}</p>
        </div>
        {emojiSet.map((emoji, index) => {
          const { x, y, targetY } = emojiPositions[index] || { x: 0, y: 40, targetY: 5 };

          let delayBase = 0.12;
          if (animationVariant === "newDiscovery") delayBase = 0.08;
          if (animationVariant === "globalNewPlant") delayBase = 0.05;

          // Scale-Kurve je Typ
          let scaleKeyframes = [0, 1.05, 0.85, 0];
          if (animationVariant === "rescanned") {
            scaleKeyframes = [0, 0.95, 0.85, 0];
          } else if (animationVariant === "globalNewPlant") {
            scaleKeyframes = [0, 1.3, 0.9, 0];
          }

          return (
            <motion.div
              key={`${emoji}-${index}`}
              initial={{ opacity: 0, scale: 0, x, y }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: scaleKeyframes,
                x,
                y: [y, (y + targetY) / 2, targetY]
              }}
              transition={{
                duration: animationVariant === "rescanned" ? 0.7 : 1.0,
                delay: delayBase + index * 0.06,
                ease: "easeOut"
              }}
              className="absolute inset-0 flex items-center justify-center text-xl select-none"
              style={{ transformOrigin: "center" }}
            >
              <span>{emoji}</span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

import React, { useEffect } from "react";
import { motion } from "framer-motion";

export default function ScanFeedbackNotification({ feedback, onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!feedback) return null;

  const { type, plantName } = feedback;

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
  }

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
          const angle = (index / emojiSet.length) * Math.PI * 2;
          const radius = 60;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          let delayBase = 0.12;
          if (animationVariant === "newDiscovery") delayBase = 0.08;
          if (animationVariant === "globalNewPlant") delayBase = 0.05;

          return (
            <motion.div
              key={`${emoji}-${index}`}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0, 1.1, 1, 0.9],
                x: [0, x * 0.6, x],
                y: [0, y * 0.6, y]
              }}
              transition={{
                duration: animationVariant === "rescanned" ? 0.8 : 1.1,
                delay: delayBase + index * 0.05,
                ease: "easeOut"
              }}
              className="absolute inset-0 flex items-center justify-center text-xl select-none"
            >
              <span>{emoji}</span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

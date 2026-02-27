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

  let title = "Scan erfolgreich! ✨";
  let message = "Dein Scan wurde gespeichert.";

  if (type === "rescanned") {
    title = "Erneut gescannt! ✨✨";
    message = plantName
      ? `${plantName} wurde erneut bestätigt.`
      : "Deine Pflanze wurde erneut bestätigt.";
  } else if (type === "newDiscovery") {
    title = "Neue Entdeckung! ✨";
    message = plantName
      ? `${plantName} wurde zu deinem Floralog hinzugefügt.`
      : "Eine neue Pflanze wurde deinem Floralog hinzugefügt.";
  } else if (type === "globalNewPlant") {
    title = "Globales Floralog erweitert! ✨";
    message = plantName
      ? `${plantName} ist jetzt im globalen Floralog verfügbar.`
      : "Eine neue Pflanze ist jetzt im globalen Floralog verfügbar.";
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 18 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        exit={{ y: -10 }}
        className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-emerald-300 px-6 py-4 max-w-sm w-[90%] flex flex-col items-center text-center"
      >
        <div className="text-3xl mb-2">✨✨</div>
        <h3 className="text-lg font-bold text-stone-900 mb-1">{title}</h3>
        <p className="text-sm text-stone-700">{message}</p>
      </motion.div>
    </motion.div>
  );
}

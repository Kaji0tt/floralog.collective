import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, Gift } from "lucide-react";

export default function QuestCompletionAnimation({ reward, onComplete }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Erstelle 30 zufällige Partikel
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      emoji: ['🌿', '🍃', '✨', '⭐', '🎉', '💚', '🌱'][Math.floor(Math.random() * 7)],
      x: Math.random() * 100 - 50,
      y: Math.random() * -100 - 50,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.3
    }));
    setParticles(newParticles);

    // Animation beenden nach 3 Sekunden
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
    >
      {/* Gold Schimmer Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, 0.3, 0],
          background: [
            "radial-gradient(circle, rgba(251,191,36,0) 0%, rgba(251,191,36,0) 100%)",
            "radial-gradient(circle, rgba(251,191,36,0.6) 0%, rgba(251,191,36,0) 70%)",
            "radial-gradient(circle, rgba(251,191,36,0) 0%, rgba(251,191,36,0) 100%)"
          ]
        }}
        transition={{ duration: 2, times: [0, 0.5, 1] }}
        className="absolute inset-0"
      />

      {/* Zentrale Belohnung */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: [0, 1.2, 1], rotate: 0 }}
        transition={{ duration: 0.6, ease: "backOut" }}
        className="relative z-10"
      >
        <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-full p-8 shadow-2xl border-4 border-white">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 0.8,
              repeat: 3,
              ease: "easeInOut"
            }}
          >
            <Trophy className="w-20 h-20 text-white" />
          </motion.div>
        </div>
        

      </motion.div>

      {/* Fliegende Partikel */}
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ 
              x: "50vw",
              y: "50vh",
              scale: 0,
              opacity: 1,
              rotate: 0
            }}
            animate={{ 
              x: `calc(50vw + ${particle.x}vw)`,
              y: `calc(50vh + ${particle.y}vh)`,
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
              rotate: particle.rotation
            }}
            transition={{ 
              duration: 2,
              delay: particle.delay,
              ease: "easeOut"
            }}
            className="absolute text-4xl pointer-events-none"
          >
            {particle.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Leuchtende Ringe */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ 
            scale: [0, 3],
            opacity: [0.8, 0]
          }}
          transition={{ 
            duration: 1.5,
            delay: i * 0.3,
            ease: "easeOut"
          }}
          className="absolute w-40 h-40 border-4 border-amber-400 rounded-full"
        />
      ))}

      {/* Sterne die erscheinen */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const distance = 150;
        return (
          <motion.div
            key={i}
            initial={{ 
              x: "50vw",
              y: "50vh",
              scale: 0,
              opacity: 0
            }}
            animate={{ 
              x: `calc(50vw + ${Math.cos(angle) * distance}px)`,
              y: `calc(50vh + ${Math.sin(angle) * distance}px)`,
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
              rotate: [0, 360]
            }}
            transition={{ 
              duration: 1.5,
              delay: 0.5 + i * 0.1,
              ease: "easeOut"
            }}
            className="absolute"
          >
            <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
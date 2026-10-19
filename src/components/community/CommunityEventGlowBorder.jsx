import { motion, useReducedMotion } from "framer-motion";

const CHESTNUT_CONIC =
  "conic-gradient(from 0deg, rgba(120,53,15,0.15) 0%, rgba(245,158,11,0.95) 10%, rgba(254,243,199,1) 14%, rgba(245,158,11,0.95) 18%, rgba(120,53,15,0.15) 30%, rgba(120,53,15,0.15) 50%, rgba(217,119,6,0.9) 60%, rgba(253,230,138,1) 64%, rgba(217,119,6,0.9) 68%, rgba(120,53,15,0.15) 80%, rgba(120,53,15,0.15) 100%)";

export const COMMUNITY_EVENT_GLOW_SHADOW = "0 0 16px rgba(245,158,11,0.32), 0 0 38px rgba(180,83,9,0.2)";

/**
 * Animated chestnut/gold border shared by every Community-Event surface
 * (Home stripe, quest card, explorer log entry) so players recognise the link.
 * Drop into any `relative` container; it does not affect layout.
 */
export default function CommunityEventGlowBorder({ radius = "1rem", borderWidth = 2, className = "" }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        padding: borderWidth,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
        zIndex: 5,
      }}
      data-community-event-glow="true"
    >
      <motion.div
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          width: "max(250%, 600px)",
          aspectRatio: "1 / 1",
          x: "-50%",
          y: "-50%",
          background: CHESTNUT_CONIC,
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 6, ease: "linear", repeat: Infinity }}
      />
    </div>
  );
}

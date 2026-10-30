import { motion, useReducedMotion } from "framer-motion";
import { DEFAULT_COMMUNITY_EVENT_THEME } from "@/lib/communityEvents";

/**
 * Animated border shared by every Community-Event surface (Home stripe, quest card,
 * explorer log entry) so players recognise the link. Colors come from the event
 * theme; themes with `blink` additionally flash the border.
 * Drop into any `relative` container; it does not affect layout.
 */
export default function CommunityEventGlowBorder({ radius = "1rem", borderWidth = 2, className = "", theme = DEFAULT_COMMUNITY_EVENT_THEME }) {
  const reduceMotion = useReducedMotion();
  const resolvedTheme = theme || DEFAULT_COMMUNITY_EVENT_THEME;
  const shouldBlink = resolvedTheme.blink && !reduceMotion;

  return (
    <motion.div
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
      animate={shouldBlink ? { opacity: [1, 0.2, 1] } : undefined}
      transition={shouldBlink ? { duration: 1.1, ease: "easeInOut", repeat: Infinity } : undefined}
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
          background: resolvedTheme.conic,
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: resolvedTheme.blink ? 40 : 60, ease: "linear", repeat: Infinity }}
      />
    </motion.div>
  );
}

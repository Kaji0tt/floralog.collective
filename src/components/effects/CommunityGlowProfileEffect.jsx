import { motion, useReducedMotion } from "framer-motion";
import CommunityEventGlowBorder from "@/components/community/CommunityEventGlowBorder";
import { getCommunityEventTheme } from "@/lib/communityEvents";

/**
 * Profile effect built from a community-event glow (e.g. "pumpkin_glow"): the same
 * rotating, optionally blinking event border plus an inner glow, since an outer
 * box-shadow would be clipped at the viewport edge.
 */
export default function CommunityGlowProfileEffect({ themeKey, radius = "2rem", borderWidth = 2 }) {
  const reduceMotion = useReducedMotion();
  const theme = getCommunityEventTheme(themeKey);
  const shouldBlink = theme.blink && !reduceMotion;
  const innerGlow = theme.glowShadow
    .split(/,(?![^(]*\))/)
    .map((shadow) => `inset ${shadow.trim()}`)
    .join(", ");

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 3, borderRadius: radius }}>
      <motion.div
        className="absolute inset-0"
        style={{ borderRadius: radius, boxShadow: innerGlow }}
        animate={shouldBlink ? { opacity: [1, 0.25, 1] } : undefined}
        transition={shouldBlink ? { duration: 1.1, ease: "easeInOut", repeat: Infinity } : undefined}
      />
      <CommunityEventGlowBorder radius={radius} borderWidth={borderWidth} theme={theme} />
    </div>
  );
}

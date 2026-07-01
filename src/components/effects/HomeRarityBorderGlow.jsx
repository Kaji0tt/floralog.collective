import React from "react";
import { motion } from "framer-motion";

/**
 * Converts a hex color string to an rgb object.
 * Returns null if the input is not a valid hex color.
 */
function hexToRgb(hex) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Fallback gold color when no border color is set
const FALLBACK_RGB = { r: 200, g: 172, b: 98 };

/**
 * HomeRarityBorderGlow – renders a pulsing glow effect around the home shell border
 * when the "rarity_border_glow" profile effect is active.
 *
 * The pulse color is derived from the player's selected border color (borderColor prop).
 * Falls back to a warm gold when no border color is set.
 */
export default function HomeRarityBorderGlow({ active = false, borderColor = null }) {
  if (!active) return null;

  const { r, g, b } = hexToRgb(borderColor) || FALLBACK_RGB;

  return (
    <>
      {/* Outer pulsing glow – breathes in and out */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-[2rem]"
        style={{ zIndex: 2 }}
        animate={{
          boxShadow: [
            `0 0 0px rgba(${r},${g},${b},0), 0 0 10px rgba(${r},${g},${b},0.06), inset 0 0 0px rgba(${r},${g},${b},0)`,
            `0 0 32px rgba(${r},${g},${b},0.62), 0 0 64px rgba(${r},${g},${b},0.30), inset 0 0 20px rgba(${r},${g},${b},0.20)`,
            `0 0 0px rgba(${r},${g},${b},0), 0 0 10px rgba(${r},${g},${b},0.06), inset 0 0 0px rgba(${r},${g},${b},0)`,
          ],
        }}
        transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
      />
      {/* Border ring that brightens on each pulse */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-[2rem]"
        style={{
          zIndex: 2,
          border: `1.5px solid rgba(${r},${g},${b},0.12)`,
        }}
        animate={{
          borderColor: [
            `rgba(${r},${g},${b},0.14)`,
            `rgba(${r},${g},${b},0.78)`,
            `rgba(${r},${g},${b},0.14)`,
          ],
        }}
        transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
      />
    </>
  );
}

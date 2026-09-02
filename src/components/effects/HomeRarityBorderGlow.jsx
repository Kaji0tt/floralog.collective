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
 * HomeRarityBorderGlow – replicates the species-card threat-glow-border effect
 * (moving orbs along the border ring + inset glow) for the home shell profile effect.
 *
 * Color is driven by the player's selected border color (borderColor prop).
 * Falls back to warm gold when none is set.
 */
export default function HomeRarityBorderGlow({ active = false, borderColor = null, borderImageUrl = null }) {
  if (!active) return null;

  const { r, g, b } = hexToRgb(borderColor) || FALLBACK_RGB;
  const color = `rgba(${r},${g},${b},0.88)`;

  if (borderImageUrl) {
    return (
      <img
        src={borderImageUrl}
        alt=""
        aria-hidden="true"
        className="rarity-profile-logo-glow"
        style={{ '--rarity-profile-color': color }}
      />
    );
  }

  return (
    <>
      {/* Inner glow border – steady subtle inset shadow, matches ::before on species cards */}
      <div
        className="rarity-profile-glow-inner"
        style={{ '--rarity-profile-color': color }}
      />
      {/* Moving orbs around border ring with CSS mask, matches ::after on species cards */}
      <div
        className="rarity-profile-glow-orbs"
        style={{ '--rarity-profile-color': color }}
      />
    </>
  );
}

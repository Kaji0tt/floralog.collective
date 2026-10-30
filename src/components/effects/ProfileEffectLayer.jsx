import HomeShellBorderGlow from "@/components/effects/HomeShellBorderGlow";
import CommunityGlowProfileEffect from "@/components/effects/CommunityGlowProfileEffect";

const PumpkinGlowProfileEffect = ({ radius, borderWidth }) => (
  <CommunityGlowProfileEffect themeKey="pumpkin" radius={radius} borderWidth={borderWidth} />
);

// Rendering per profile effect (Rewards.type = "profile_effect", value = key).
// New profile effects only need an entry here to appear on every profile surface.
const PROFILE_EFFECT_COMPONENTS = {
  shell_border_glow: HomeShellBorderGlow,
  pumpkin_glow: PumpkinGlowProfileEffect,
};

// Surface presets: the full-screen shell (Home, friend profile) and the mini profile card.
const SURFACE_PROPS = {
  viewport: { radius: "2rem", borderWidth: 3, particleCount: 14 },
  card: { radius: "1rem", borderWidth: 2, particleCount: 5 },
};

/**
 * Renders the player's selected profile effect along the border of the surrounding
 * `relative` container. Profile effects are shown in Home, the friend profile and the
 * mini profile – not in the explorer log.
 */
export default function ProfileEffectLayer({ effect, surface = "viewport" }) {
  const EffectComponent = PROFILE_EFFECT_COMPONENTS[String(effect || "").trim().toLowerCase()];
  if (!EffectComponent) return null;
  return <EffectComponent active {...(SURFACE_PROPS[surface] || SURFACE_PROPS.viewport)} />;
}

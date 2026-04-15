const PALETTES = {
  green: {
    lightGradient: "bg-gradient-to-b from-[#d4f7d4]/95 via-[#b3eab3]/95 to-[#8ad48a]/95",
    darkGradient: "bg-gradient-to-b from-[#1a3a2a]/90 via-[#0e2218]/96 to-[#040f09]/99",
    lightShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(60,140,60,0.18)",
    darkShadow: "inset 0 1px 0 rgba(180,255,200,0.14), 0 6px 12px rgba(0,0,0,0.28)",
  },
  amber: {
    lightGradient: "bg-gradient-to-b from-[#fef3c7]/95 via-[#fde68a]/95 to-[#fbbf24]/95",
    darkGradient: "bg-gradient-to-b from-[#3a2e0a]/90 via-[#231c06]/96 to-[#0d0b00]/99",
    lightShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(180,130,20,0.18)",
    darkShadow: "inset 0 1px 0 rgba(255,230,100,0.14), 0 6px 12px rgba(0,0,0,0.28)",
  },
  blue: {
    lightGradient: "bg-gradient-to-b from-[#dbeafe]/95 via-[#bfdbfe]/95 to-[#93c5fd]/95",
    darkGradient: "bg-gradient-to-b from-[#0a1e3a]/90 via-[#061025]/96 to-[#020610]/99",
    lightShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(60,100,200,0.15)",
    darkShadow: "inset 0 1px 0 rgba(150,200,255,0.12), 0 6px 12px rgba(0,0,0,0.28)",
  },
  orange: {
    lightGradient: "bg-gradient-to-b from-[#ffedd5]/95 via-[#fed7aa]/95 to-[#fdba74]/95",
    darkGradient: "bg-gradient-to-b from-[#3a1a0a]/90 via-[#220e04]/96 to-[#0d0400]/99",
    lightShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 12px rgba(180,100,30,0.15)",
    darkShadow: "inset 0 1px 0 rgba(255,200,140,0.12), 0 6px 12px rgba(0,0,0,0.28)",
  },
};

export const NAV_COLOR_ORDER = ["green", "amber", "blue", "orange"];

export function getNavButtonStyle({ palette, isLightUi, isActive = true }) {
  const themePalette = PALETTES[palette] || PALETTES.green;
  const gradient = isLightUi ? themePalette.lightGradient : themePalette.darkGradient;
  const shadow = isLightUi ? themePalette.lightShadow : themePalette.darkShadow;

  if (isActive) {
    return {
      gradientClass: gradient,
      shadowStyle: shadow,
    };
  }

  return {
    gradientClass: `${gradient} opacity-65`,
    shadowStyle: shadow,
  };
}

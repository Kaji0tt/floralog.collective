// Shared visual for the small gold-gradient icon circles used across the Home hero UI
// (profile badges, reward cards, ...). Keeping the gradient/shadow definitions in one
// place guarantees every circle in the app stays visually consistent.
export const BADGE_CIRCLE_BORDER_GRADIENT = "linear-gradient(to bottom, #FFF589, #464324)";
export const BADGE_CIRCLE_BACKGROUND_GRADIENT = "linear-gradient(to bottom, #8B7B42, #1F2416)";
export const BADGE_CIRCLE_SHADOW = "0 10px 14px rgba(0,0,0,0.45)";

// Muted/neutral variant for lower-priority contexts (e.g. reward catalog list) that should
// read as secondary next to the gold profile-badges circles, without leaving the Home look.
export const MUTED_CIRCLE_BORDER_GRADIENT = "linear-gradient(to bottom, #cbd5cc, #55605a)";
export const MUTED_CIRCLE_BACKGROUND_GRADIENT = "linear-gradient(to bottom, #4b5650, #23291f)";
export const MUTED_CIRCLE_SHADOW = "0 4px 8px rgba(0,0,0,0.25)";

export default function BadgeCircleIcon({
  size = "3.5rem",
  className = "",
  contentClassName = "",
  style = {},
  borderGradient = BADGE_CIRCLE_BORDER_GRADIENT,
  backgroundGradient = BADGE_CIRCLE_BACKGROUND_GRADIENT,
  shadow = BADGE_CIRCLE_SHADOW,
  children,
  ...rest
}) {
  return (
    <div
      className={`rounded-full p-[2px] ${className}`}
      style={{ width: size, height: size, background: borderGradient, boxShadow: shadow, ...style }}
      {...rest}
    >
      <div
        className={`flex h-full w-full items-center justify-center rounded-full ${contentClassName}`}
        style={{ background: backgroundGradient }}
      >
        {children}
      </div>
    </div>
  );
}

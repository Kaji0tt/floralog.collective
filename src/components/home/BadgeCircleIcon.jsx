// Shared visual for the small gold-gradient icon circles used across the Home hero UI
// (profile badges, reward cards, ...). Keeping the gradient/shadow definitions in one
// place guarantees every circle in the app stays visually consistent.
export const BADGE_CIRCLE_BORDER_GRADIENT = "linear-gradient(to bottom, #FFF589, #464324)";
export const BADGE_CIRCLE_BACKGROUND_GRADIENT = "linear-gradient(to bottom, #8B7B42, #1F2416)";
export const BADGE_CIRCLE_SHADOW = "0 10px 14px rgba(0,0,0,0.45)";

export default function BadgeCircleIcon({
  size = "3.5rem",
  className = "",
  contentClassName = "",
  style = {},
  children,
  ...rest
}) {
  return (
    <div
      className={`rounded-full p-[2px] ${className}`}
      style={{ width: size, height: size, background: BADGE_CIRCLE_BORDER_GRADIENT, boxShadow: BADGE_CIRCLE_SHADOW, ...style }}
      {...rest}
    >
      <div
        className={`flex h-full w-full items-center justify-center rounded-full ${contentClassName}`}
        style={{ background: BADGE_CIRCLE_BACKGROUND_GRADIENT }}
      >
        {children}
      </div>
    </div>
  );
}

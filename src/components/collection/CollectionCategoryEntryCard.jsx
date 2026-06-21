import { ChevronRight } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";

const parseColorToRgbTriplet = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();

  const rgbMatch = trimmed.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[1], 10))),
      g: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[2], 10))),
      b: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[3], 10))),
    };
  }

  const hex = trimmed.replace(/^#/, "");
  if (hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length === 6 && /^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
};

const toRgba = (colorValue, opacity) => {
  const rgb = parseColorToRgbTriplet(colorValue);
  if (!rgb) return null;
  const safeOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeOpacity})`;
};

const ACCENT_STYLES = {
  global: {
    tint: "rgba(146, 181, 93, 0.38)",
    borderLight: "rgba(156, 172, 130, 0.44)",
    borderDark: "rgba(199, 224, 151, 0.30)",
    iconBgLight: "bg-lime-100/20",
    iconBgDark: "bg-lime-300/16",
    iconFgLight: "text-lime-100",
    iconFgDark: "text-lime-100",
  },
  themes: {
    tint: "rgba(101, 166, 132, 0.36)",
    borderLight: "rgba(133, 167, 151, 0.44)",
    borderDark: "rgba(158, 223, 189, 0.30)",
    iconBgLight: "bg-emerald-100/20",
    iconBgDark: "bg-emerald-300/16",
    iconFgLight: "text-emerald-100",
    iconFgDark: "text-emerald-100",
  },
  shared: {
    tint: "rgba(98, 154, 168, 0.34)",
    borderLight: "rgba(132, 161, 171, 0.42)",
    borderDark: "rgba(147, 208, 222, 0.30)",
    iconBgLight: "bg-cyan-100/20",
    iconBgDark: "bg-cyan-300/16",
    iconFgLight: "text-cyan-100",
    iconFgDark: "text-cyan-100",
  },
  browse: {
    tint: "rgba(104, 134, 189, 0.34)",
    borderLight: "rgba(133, 148, 179, 0.42)",
    borderDark: "rgba(167, 190, 237, 0.30)",
    iconBgLight: "bg-blue-100/20",
    iconBgDark: "bg-blue-300/16",
    iconFgLight: "text-blue-100",
    iconFgDark: "text-blue-100",
  },
};

export default function CollectionCategoryEntryCard({
  title,
  description,
  info,
  descriptionClassName = "",
  infoClassName = "",
  icon: Icon,
  accent = "global",
  onClick,
  disabled = false,
  className = "",
  customBackgroundColor = null,
  descriptionMaxHeightClass = "max-h-12",
  descriptionScrollable = true,
  secondaryActionIcon: SecondaryActionIcon = null,
  secondaryActionLabel = "Aktion",
  onSecondaryAction = null,
  secondaryActionVisible = false,
  secondaryActionDisabled = false,
  leadingVisual = null,
  leadingBadges = null,
  metaChips = [],
  metaChipClassName = "",
  detailContent = null,
  showChevron = false,
}) {
  const { isLightUi } = useUiTheme();
  const style = ACCENT_STYLES[accent] || ACCENT_STYLES.global;
  const customGradient = customBackgroundColor
    ? `linear-gradient(135deg, ${toRgba(customBackgroundColor, 0.38) || customBackgroundColor} 0%, rgba(9, 12, 17, 0.84) 100%)`
    : null;
  const baseBackground = customGradient || `linear-gradient(145deg, ${style.tint} 0%, rgba(10, 13, 19, 0.86) 58%, rgba(7, 10, 16, 0.94) 100%)`;
  const descriptionToneClass = descriptionClassName || (isLightUi ? "text-white/86" : "text-white/84");
  const infoToneClass = infoClassName || (isLightUi ? "text-white/70" : "text-white/68");
  const chipToneClass = metaChipClassName || (isLightUi ? "border-white/25 bg-black/26 text-white/84" : "border-white/25 bg-black/28 text-white/84");
  const descriptionOverflowClass = descriptionScrollable
    ? `min-h-0 overflow-y-auto pr-1 ${descriptionMaxHeightClass}`
    : "overflow-visible";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "relative w-full rounded-[1.35rem] border p-4 md:p-5 text-left shadow-[0_16px_42px_rgba(0,0,0,0.34)] transition-all duration-200 " +
        className +
        " " +
        (disabled ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(0,0,0,0.42)]")
      }
      style={{
        background: baseBackground,
        borderColor: isLightUi ? style.borderLight : style.borderDark,
      }}
      aria-label={title}
    >
      <div className="absolute inset-0 pointer-events-none rounded-[1.35rem] bg-gradient-to-br from-white/14 via-transparent to-black/38" />
      <div className="relative flex items-start gap-3 md:gap-4 h-full min-h-0">
        <div className="shrink-0 flex flex-col items-center gap-2">
          {leadingVisual || (
            <div
              className={
                "h-11 w-11 md:h-12 md:w-12 rounded-xl border flex items-center justify-center shrink-0 backdrop-blur-sm " +
                (isLightUi
                  ? `${style.iconBgLight} ${style.iconFgLight} border-white/35`
                  : `${style.iconBgDark} ${style.iconFgDark} border-white/20`)
              }
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          {leadingBadges}
        </div>

        <div className="min-w-0 flex-1 h-full min-h-0 flex flex-col justify-center">
          <h3 className={"w-full text-lg md:text-xl font-semibold tracking-[0.01em] leading-tight text-left " + (isLightUi ? "text-white" : "text-white")}>{title}</h3>
          {(description || info) && (
            <div className={`mt-0.5 ${descriptionOverflowClass}`}>
              {description && (
                <p className={"text-sm md:text-[0.95rem] leading-snug " + descriptionToneClass}>
                  {description}
                </p>
              )}
              {info && (
                <p className={"mt-1 text-xs md:text-sm font-medium leading-snug " + infoToneClass}>
                  {info}
                </p>
              )}
            </div>
          )}
          {metaChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {metaChips.map((chip) => (
                <span
                  key={chip}
                  className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] md:text-[11px] font-medium " + chipToneClass}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          {detailContent && <div className="mt-2.5">{detailContent}</div>}
        </div>

        {showChevron && (
          <ChevronRight className={"w-5 h-5 shrink-0 " + (isLightUi ? "text-white/65" : "text-white/65")} />
        )}
      </div>

      {secondaryActionVisible && SecondaryActionIcon && (
        <span className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (typeof onSecondaryAction === "function") {
                onSecondaryAction(event);
              }
            }}
            disabled={secondaryActionDisabled}
            className={
              "h-8 w-8 md:h-9 md:w-9 rounded-full border flex items-center justify-center transition-colors " +
              (isLightUi
                ? "border-stone-500/35 bg-white/70 text-stone-700 hover:bg-white"
                : "border-white/30 bg-black/40 text-white hover:bg-black/55") +
              (secondaryActionDisabled ? " opacity-60 cursor-not-allowed" : "")
            }
            aria-label={secondaryActionLabel}
          >
            <SecondaryActionIcon className="w-4 h-4" />
          </button>
        </span>
      )}
    </button>
  );
}

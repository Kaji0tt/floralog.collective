import { MapPin, Mountain, Sprout, Zap } from "lucide-react";

const toPercentBonus = (multiplier) => Math.round((Number(multiplier || 1) - 1) * 100);

/**
 * Always-visible row of the 4 multiplier indicators currently applied on Home.
 */
export default function HomeScanInfoRow({
  isLightUi = false,
  conqueredZonesDisplay = "0",
  zoneMultiplier = 1,
  careMultiplier = 1,
  activityBonusDisplay = 0,
  className = "",
}) {
  const zonePercent = toPercentBonus(zoneMultiplier);
  const carePercent = toPercentBonus(careMultiplier);

  const items = [
    { Icon: Mountain, value: `${zonePercent >= 0 ? "+" : ""}${zonePercent}%`, label: "Zonen-Multiplikator" },
    { Icon: MapPin, value: String(conqueredZonesDisplay), label: "Geclaimte Zonen" },

    { Icon: Zap, value: `+${Math.max(0, Math.round(Number(activityBonusDisplay) || 0))}`, label: "Aktivitätsbonus" },
    { Icon: Sprout, value: `${carePercent >= 0 ? "+" : ""}${carePercent}%`, label: "Pflege-Bonus" },
  ];
  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2, 4);

  // Same glass + gold-gradient-border look as HomeEventStripe / RewardCard.
  const borderGradient = isLightUi
    ? "linear-gradient(to bottom right, #000000, #272625, rgba(143,107,34,0.7))"
    : "linear-gradient(to bottom right, #333333, rgba(70, 67, 58, 0.85), #8f6b22)";

  const renderItem = (item) => (
    <span
      key={item.label}
      className="relative inline-flex min-w-0 items-center gap-1"
      title={item.label}
      aria-label={item.label}
    >
      <item.Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-semibold">{item.value}</span>
    </span>
  );

  const renderPill = (pillItems, sideClassName) => (
    <div
      className={`relative flex items-center gap-12 rounded-full py-1 pl-[8%] pr-[8%] shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)] ${sideClassName}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-full backdrop-blur-sm ${isLightUi ? "bg-white/40" : "bg-black/20"}`}
      />
      {pillItems.map(renderItem)}
      <div aria-hidden="true" className="gold-gradient-border-mask gold-gradient-border-mask-thin" style={{ background: borderGradient }} />
    </div>
  );

  return (
    <div
      className={`grid grid-cols-2 gap-1.5 px-[6%] text-[0.72rem] ${
        isLightUi ? "text-stone-700" : "text-stone-200/90"
      } ${className}`}
    >
      <div className="flex items-center justify-center">{renderPill(leftItems, "mr-[16%]")}</div>
      <div className="flex items-center justify-center">{renderPill(rightItems, "ml-[16%]")}</div>
    </div>
  );
}

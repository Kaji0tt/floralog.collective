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
    { Icon: MapPin, value: String(conqueredZonesDisplay), label: "Geclaimte Zonen" },
    { Icon: Mountain, value: `${zonePercent >= 0 ? "+" : ""}${zonePercent}%`, label: "Zonen-Multiplikator" },
    { Icon: Sprout, value: `${carePercent >= 0 ? "+" : ""}${carePercent}%`, label: "Pflege-Bonus" },
    { Icon: Zap, value: `+${Math.max(0, Math.round(Number(activityBonusDisplay) || 0))}`, label: "Aktivitätsbonus" },
  ];

  return (
    <div
      className={`flex items-center justify-between gap-1.5 px-1 text-[0.72rem] ${
        isLightUi ? "text-stone-700" : "text-stone-200/90"
      } ${className}`}
    >
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex min-w-0 items-center gap-1"
          title={item.label}
          aria-label={item.label}
        >
          <item.Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-semibold">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

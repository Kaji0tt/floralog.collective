import { Sparkles, Gem } from "lucide-react";

/**
 * Currency KPI row shown in the footer slot while the "Anpassen" shop stack is open, replacing
 * HomeScanInfoRow. Shows Funken + Bernstein on the left and the amber purchase action on the right.
 */
export default function HomeCurrencyInfoRow({
  isLightUi = false,
  playerSparks = 0,
  playerAmber = 0,
  onOpenAmberPurchase,
  className = "",
}) {
  const formatValue = (value) => Math.max(0, Math.round(Number(value) || 0)).toLocaleString("de-DE");

  const currencyItems = [
    { Icon: Sparkles, value: formatValue(playerSparks), label: "Funken" },
    { Icon: Gem, value: formatValue(playerAmber), label: "Bernstein" },
  ];

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
      <div className="flex items-center justify-start">{renderPill(currencyItems, "")}</div>
      <div className="flex items-center justify-end">
        <div className="relative flex items-center rounded-full py-1 pl-[8%] pr-[8%] shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]">
          <div
            aria-hidden="true"
            className={`absolute inset-0 rounded-full backdrop-blur-sm ${isLightUi ? "bg-white/40" : "bg-black/20"}`}
          />
          <button
            type="button"
            onClick={onOpenAmberPurchase}
            className={`relative inline-flex items-center gap-1.5 font-semibold ${
              isLightUi ? "text-[#6f5314]" : "text-[#f8efbe]"
            }`}
          >
            <Gem className="h-3.5 w-3.5" aria-hidden="true" />
            Bernstein kaufen
          </button>
          <div aria-hidden="true" className="gold-gradient-border-mask gold-gradient-border-mask-thin" style={{ background: borderGradient }} />
        </div>
      </div>
    </div>
  );
}

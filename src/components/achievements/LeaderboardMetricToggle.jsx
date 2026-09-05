import { motion } from "framer-motion";
import { Sparkles, Sprout } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";

/**
 * @param {{
 *   metric: "seeds" | "highest_scan",
 *   onChangeMetric: (metric: "seeds" | "highest_scan") => void,
 *   isLightUi?: boolean,
 * }} props
 */
export default function LeaderboardMetricToggle({
  metric,
  onChangeMetric,
  isLightUi = false,
}) {
  const options = [
    {
      id: "seeds",
      label: "Samenbestenliste",
      shortLabel: "Samen",
      icon: Sprout,
    },
    {
      id: "highest_scan",
      label: "Scanergebnis",
      shortLabel: "Scanergebnis",
      icon: Sparkles,
    },
  ];

  return (
    <GoldGradientCard
      as="div"
      className="w-full"
      blur
      rounded="2xl"
      shadow={false}
      borderClassName="gold-gradient-border-mask-thin"
      contentClassName="p-1 grid grid-cols-2 gap-1"
    >
      {options.map((opt) => {
        const isSelected = metric === opt.id;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChangeMetric(opt.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              isSelected
                ? isLightUi
                  ? "text-[#785918]"
                  : "text-[#fefce8]"
                : isLightUi
                ? "text-stone-600 hover:text-stone-900"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="metricToggleHighlight"
                className={`absolute inset-0 rounded-xl border -z-10 ${
                  isLightUi
                    ? "bg-white/90 border-[#d9c48a]/80 shadow-sm"
                    : "bg-black/55 border-[#f0e5a5]/40 shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                }`}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon
              className={`w-4 h-4 flex-shrink-0 ${
                isSelected
                  ? isLightUi
                    ? "text-[#8f6b22]"
                    : "text-amber-300"
                  : isLightUi
                  ? "text-stone-500"
                  : "text-stone-400"
              }`}
            />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </GoldGradientCard>
  );
}

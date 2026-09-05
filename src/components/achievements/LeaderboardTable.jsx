import { useState } from "react";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * @param {{
 *   entries: Array<{
 *     rank: number,
 *     authId?: string,
 *     email?: string,
 *     name?: string,
 *     botName?: string | null,
 *     score: number,
 *     growth7d: number,
 *     detail?: string | null,
 *     isOwn: boolean,
 *     logoAssets?: any,
 *   }>,
 *   ownScore: number,
 *   maxScore: number,
 *   metric: "seeds" | "highest_scan",
 *   onPlayerClick?: (email: string) => void,
 *   isLightUi?: boolean,
 * }} props
 */
export default function LeaderboardTable({
  entries = [],
  ownScore = 0,
  maxScore = 1,
  metric = "seeds",
  onPlayerClick,
  isLightUi = false,
}) {
  const [showAll, setShowAll] = useState(false);

  if (entries.length === 0) {
    return (
      <div
        className={`w-full py-8 text-center rounded-2xl border ${
          isLightUi ? "bg-white/70 border-stone-200" : "bg-black/30 border-[#f0e5a5]/15"
        }`}
      >
        <p className="text-sm text-stone-400">Keine weiteren Spieler in diesem Zeitraum.</p>
      </div>
    );
  }

  const scoreUnit = metric === "seeds" ? "Samen" : "Seeds";
  const ownEntryIndex = entries.findIndex((entry) => entry.isOwn);
  const compactStartIndex = ownEntryIndex >= 0 ? Math.max(0, ownEntryIndex - 3) : 0;
  const compactEndIndex = ownEntryIndex >= 0
    ? Math.min(entries.length, ownEntryIndex + 4)
    : Math.min(entries.length, 7);
  const displayedEntries = showAll
    ? entries
    : entries.slice(compactStartIndex, compactEndIndex);
  const hasHiddenEntries = displayedEntries.length < entries.length;

  return (
    <GoldGradientCard
      as="section"
      className="w-full"
      blur
      rounded="2xl"
      shadow={false}
      borderClassName="gold-gradient-border-mask-thin"
      contentClassName="p-2 space-y-1.5"
    >
      {/* Table header */}
      <div
        className={`grid grid-cols-12 gap-1 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider ${
          isLightUi ? "text-stone-500" : "text-stone-400"
        }`}
      >
        <div className="col-span-5 sm:col-span-4">Spieler</div>
        <div className="col-span-3 text-right">
          {metric === "seeds" ? "Samen" : "Ergebnis"}
        </div>
        <div className="col-span-2 text-right">7-Tage</div>
        <div className="col-span-2 sm:col-span-3 text-right">Diff.</div>
      </div>

      {/* Rows */}
      {displayedEntries.map((entry) => {
        const delta = entry.score - ownScore;
        const barPercent = maxScore > 0 ? Math.min(100, Math.max(8, (entry.score / maxScore) * 100)) : 10;

        return (
          <div
            key={`table-row-${entry.authId || entry.email || entry.rank}`}
            className={`grid grid-cols-12 gap-1 items-center px-3 py-2.5 rounded-2xl border transition-all ${
              entry.isOwn
                ? isLightUi
                  ? "border-lime-500 bg-lime-50/90 shadow-sm"
                  : "border-lime-400/80 bg-gradient-to-r from-lime-950/40 via-emerald-950/30 to-black/40 shadow-[0_0_16px_rgba(163,230,53,0.2)]"
                : isLightUi
                ? "border-stone-200 bg-white/70 hover:bg-white"
                : "border-[#f0e5a5]/15 bg-black/35 hover:bg-black/50"
            }`}
          >
            {/* Col 1 & 2: Rank + Logo + Name (with bot_name) */}
            <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
              <span
                className={`w-5 flex-shrink-0 text-xs font-black ${
                  entry.isOwn
                    ? "text-[#a3e635]"
                    : isLightUi
                    ? "text-stone-600"
                    : "text-stone-400"
                }`}
              >
                {entry.rank}
              </span>

              <div className="w-8 h-8 rounded-full overflow-hidden border border-stone-400/40 flex-shrink-0 bg-black/40">
                <CustomLogoAvatar
                  logoAssets={entry.logoAssets}
                  className="w-full h-full"
                  tooltipText={entry.name || "Unbekannt"}
                  fallbackText={entry.name?.charAt(0) || "?"}
                  fallbackClassName="text-[10px] font-bold text-white"
                />
              </div>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => entry.email && onPlayerClick && onPlayerClick(entry.email)}
                  disabled={!entry.email}
                  className={`block text-left text-xs font-bold truncate p-0 m-0 border-0 bg-transparent transition-colors ${
                    entry.isOwn
                      ? "text-lime-300"
                      : isLightUi
                      ? "text-stone-900 hover:text-emerald-700"
                      : "text-stone-100 hover:text-lime-300"
                  } ${entry.email ? "cursor-pointer" : "cursor-default"}`}
                >
                  {entry.name || "Unbekannt"}
                </button>

                {metric === "highest_scan" && entry.detail ? (
                  <p className="text-[10px] text-stone-400 truncate">
                    🌱 {entry.detail}
                  </p>
                ) : entry.botName ? (
                  <p className="text-[10px] text-stone-400 truncate">
                    🤖 {entry.botName}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Col 3: Score + Progress bar */}
            <div className="col-span-3 text-right flex flex-col items-end justify-center min-w-0 pr-1">
              <span
                className={`text-xs font-black whitespace-nowrap ${
                  entry.isOwn
                    ? "text-[#a3e635]"
                    : isLightUi
                    ? "text-stone-900"
                    : "text-stone-100"
                }`}
              >
                {entry.score.toLocaleString()} <span className="text-[9px] font-medium text-stone-400">{scoreUnit}</span>
              </span>

              {/* Progress bar */}
              <div className="w-14 sm:w-18 h-1 bg-black/40 rounded-full overflow-hidden mt-1 border border-stone-700/30">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    entry.isOwn
                      ? "bg-gradient-to-r from-lime-400 to-emerald-300 shadow-[0_0_4px_rgba(163,230,53,0.8)]"
                      : "bg-lime-500/80"
                  }`}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
            </div>

            {/* Col 4: Zuwachs letzte 7 Tage */}
            <div className="col-span-2 text-right">
              <span
                className={`text-[11px] font-bold whitespace-nowrap ${
                  entry.growth7d > 0
                    ? isLightUi
                      ? "text-emerald-700"
                      : "text-emerald-400"
                    : "text-stone-500"
                }`}
              >
                {entry.growth7d > 0 ? `+${entry.growth7d.toLocaleString()} 🌱` : "0 🌱"}
              </span>
            </div>

            {/* Col 5: Differenz zur eigenen Samenzahl */}
            <div className="col-span-2 sm:col-span-3 text-right">
              {entry.isOwn ? (
                <span className="text-xs font-bold text-stone-400">—</span>
              ) : delta > 0 ? (
                <span className="text-[11px] font-black text-amber-300 whitespace-nowrap inline-flex items-center gap-0.5">
                  +{delta.toLocaleString()} <span className="text-[9px]">↑</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-rose-400 whitespace-nowrap inline-flex items-center gap-0.5">
                  {delta.toLocaleString()} <span className="text-[9px]">↓</span>
                </span>
              )}
            </div>
          </div>
        );
      })}

      {hasHiddenEntries && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowAll((isOpen) => !isOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold transition-colors ${
              isLightUi
                ? "text-[#785918] hover:text-stone-900"
                : "text-[#f8efbe] hover:text-white [text-shadow:_0_2px_8px_rgba(0,0,0,0.8)]"
            }`}
          >
            <span>{showAll ? "Nur deinen Bereich anzeigen" : "Alle Spieler anzeigen"}</span>
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

    </GoldGradientCard>
  );
}

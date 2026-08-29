import { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";
import { SCAN_STREAK_CONFIG } from "@/lib/robotPlantConfig";
import { computeScanStreakPreview } from "@/lib/robotPlantEconomy";

// Pflege uses the exact color of the "care" stat bar in the Home health/status display.
const PFLEGE_TEXT_COLOR = "#f59e0b";

// The reward chronology stops changing once the final, repeating boundary tier is reached.
const MAX_DISPLAY_DAY =
  SCAN_STREAK_CONFIG.weekBoundaryStartDay +
  SCAN_STREAK_CONFIG.weekBoundaryIntervalDays * SCAN_STREAK_CONFIG.boundaryBernsteinFromIndex;

// Horizontal, scrollable preview of the full Scan-Streak reward chronology (day 1 up to the
// final/repeating reward tier) - replaces the old login-streak sparks claim. Read-only -
// actual grants happen server-side on first scan.
export default function ScanStreakRewardTrack({ streakDays = 0, jokerCount = 0 }) {
  const { isLightUi } = useUiTheme();
  const safeStreakDays = Math.max(0, Number(streakDays ?? 0));
  const safeJokerCount = Math.max(0, Number(jokerCount ?? 0));
  // Day 0 (no streak yet) previews as if the next scan starts day 1.
  const currentDay = safeStreakDays > 0 ? safeStreakDays : 1;
  // Once the plateau is reached, keep highlighting the last card (nothing new to show beyond it).
  const highlightedDay = Math.min(currentDay, MAX_DISPLAY_DAY);

  const currentCardRef = useRef(null);

  const slots = useMemo(() => {
    const items = [];
    for (let day = 1; day <= MAX_DISPLAY_DAY; day += 1) {
      items.push({
        day,
        ...computeScanStreakPreview(day),
        isAchieved: day < highlightedDay,
        isCurrent: day === highlightedDay,
      });
    }
    return items;
  }, [highlightedDay]);

  useEffect(() => {
    currentCardRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [highlightedDay]);

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between text-[11px] md:text-xs ${
          isLightUi ? "text-stone-700" : "text-stone-100/90"
        }`}
      >
        <span className="font-semibold uppercase tracking-wide">Scan-Streak</span>
        {safeJokerCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/40 bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-200 text-[9px]">
            {safeJokerCount} {safeJokerCount === 1 ? "freier Tag" : "freie Tage"}
          </span>
        )}
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0 pointer-events-auto"
        role="list"
        aria-label="Scan-Streak Belohnungen"
      >
        {slots.map((slot) => (
          <div
            key={slot.day}
            ref={slot.isCurrent ? currentCardRef : null}
            role="listitem"
            className={`relative flex-shrink-0 w-20 rounded-lg border px-1.5 py-1 text-center ${
              slot.isCurrent
                ? "border-amber-300/80 bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
                : slot.isBoundaryDay
                ? "border-amber-200/50 bg-amber-500/10"
                : isLightUi
                ? "border-[#c8ac62]/45 bg-white/50"
                : "border-[#f0e5a5]/25 bg-black/30"
            }`}
          >
            {slot.isAchieved && (
              <Check className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 p-0.5 text-white" />
            )}
            <div className={`text-[9px] font-semibold ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
              Tag {slot.day}
            </div>
            <div className="mt-0.5 flex flex-col items-center gap-0.5 text-[9px] font-semibold leading-tight">
              <span style={{ color: PFLEGE_TEXT_COLOR }}>+{slot.pflegeDelta} Pflege</span>
              <span className="text-amber-300">+{slot.funkenDelta} Funken</span>
              {slot.bernsteinDelta > 0 && <span className="text-orange-300">+{slot.bernsteinDelta} Bernstein</span>}
              {slot.willGrantJoker && <span className="text-sky-300">+1 freier Tag</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

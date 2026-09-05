import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";

/**
 * @param {{
 *   topEntries: Array<{
 *     email?: string,
 *     authId?: string,
 *     name?: string,
 *     botName?: string | null,
 *     score: number,
 *     scoreLabel?: string,
 *     detail?: string | null,
 *     logoAssets?: any,
 *   }>,
 *   metric: "seeds" | "highest_scan",
 *   onPlayerClick?: (email: string) => void,
 *   isLightUi?: boolean,
 *   fillAvailable?: boolean,
 * }} props
 */
export default function LeaderboardPodium({
  topEntries = [],
  metric = "seeds",
  onPlayerClick,
  isLightUi = false,
  fillAvailable = false,
}) {
  const first = topEntries[0] || null;
  const second = topEntries[1] || null;
  const third = topEntries[2] || null;

  const medalEmojis = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
  };

  const renderSlot = (entry, rank, avatarSizeClass) => {
    const isFirst = rank === 1;
    const medal = medalEmojis[rank];

    if (!entry) {
      return (
        <div className="basis-0 flex-1 flex flex-col items-center justify-start px-1 min-w-0 opacity-40">
          <div className={`${avatarSizeClass} flex items-center justify-center`}>
            <span className="text-sm font-bold text-stone-400">#{rank}</span>
          </div>
          <div className="mt-2 text-center">
            <p className="text-xs font-semibold text-stone-400">—</p>
          </div>
          <div className="mt-1.5 text-lg leading-none">{medal}</div>
        </div>
      );
    }

    return (
      <div
        className={`basis-0 flex-1 flex flex-col items-center justify-start px-1 min-w-0 cursor-pointer group transition-transform active:scale-95 ${
          isFirst ? "z-10 -mx-1" : "z-0"
        }`}
        onClick={() => entry.email && onPlayerClick && onPlayerClick(entry.email)}
      >
        {/* Avatar (clean without extra circle rings or clipping) */}
        <div className="relative flex flex-col items-center">
          {/* Subtle warm glow behind 1st place */}
          {isFirst && (
            <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl -z-10 animate-pulse" />
          )}

          <div className={`${avatarSizeClass} transition-transform group-hover:scale-105 overflow-visible`}>
            <CustomLogoAvatar
              noClip
              logoAssets={entry.logoAssets}
              className="w-full h-full"
              tooltipText={entry.name || "Unbekannt"}
              fallbackText={entry.name?.charAt(0)?.toUpperCase() || "?"}
              fallbackClassName="text-sm font-black text-white"
            />
          </div>
        </div>

        {/* Player Information */}
        <div className="mt-2 text-center w-full min-w-0 px-1 flex flex-col items-center">
          <p
            className={`font-black truncate w-full ${
              isFirst
                ? isLightUi
                  ? "text-sm sm:text-base text-stone-900 drop-shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
                  : "text-sm sm:text-base text-stone-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                : isLightUi
                ? "text-xs sm:text-sm text-stone-800"
                : "text-xs sm:text-sm text-stone-200"
            }`}
          >
            {entry.name || "Unbekannt"}
          </p>

          {entry.botName && (
            <p className="text-[10px] sm:text-[11px] text-stone-400 truncate w-full mt-0.5">
              🤖 {entry.botName}
            </p>
          )}

          {/* Score display */}
          <p
            className={`font-black mt-0.5 ${
              isFirst
                ? "text-xs sm:text-sm text-[#a3e635] drop-shadow-[0_0_8px_rgba(163,230,53,0.4)]"
                : "text-[11px] sm:text-xs text-lime-300"
            }`}
          >
            {entry.score.toLocaleString()} {metric === "seeds" ? "Samen" : "Seeds"}
          </p>

          {/* Plant Name if metric is Scanergebnis */}
          {metric === "highest_scan" && entry.detail && (
            <p className="text-[9px] sm:text-[10px] text-stone-300 truncate w-full mt-0.5">
              🌱 {entry.detail}
            </p>
          )}

          {/* 1ter, 2ter, 3ter Emoji Medal placed underneath */}
          <div className="mt-1.5 flex items-center justify-center">
            <span
              className={`${
                isFirst ? "text-2xl sm:text-3xl drop-shadow-[0_2px_8px_rgba(250,204,21,0.5)]" : "text-xl sm:text-2xl"
              }`}
            >
              {medal}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const sideAvatarSizeClass = fillAvailable
    ? "w-[clamp(4rem,11vh,7rem)] h-[clamp(4rem,11vh,7rem)]"
    : "w-16 h-16 sm:w-18 sm:h-18";
  const firstAvatarSizeClass = fillAvailable
    ? "w-[clamp(5rem,14vh,8.5rem)] h-[clamp(5rem,14vh,8.5rem)]"
    : "w-20 h-20 sm:w-24 sm:h-24";

  return (
    <div className={`relative w-full px-1 ${fillAvailable ? "flex items-center py-2" : "py-3"}`}>
      <div className="flex w-full items-start justify-center gap-1 sm:gap-2 min-w-0">
        {/* Place 2 (Silver) */}
        {renderSlot(second, 2, sideAvatarSizeClass)}

        {/* Place 1 (Gold - Center) */}
        {renderSlot(first, 1, firstAvatarSizeClass)}

        {/* Place 3 (Bronze) */}
        {renderSlot(third, 3, sideAvatarSizeClass)}
      </div>
    </div>
  );
}

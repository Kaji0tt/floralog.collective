import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { ChevronRight, Trophy } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";

/**
 * @param {{
 *   ownRank: number,
 *   totalPlayers: number,
 *   ownScore: number,
 *   user: any,
 *   userLogoAssets?: any,
 *   nextOpponent?: {
 *     email?: string,
 *     name?: string,
 *     botName?: string | null,
 *     score: number,
 *     rank: number,
 *     logoAssets?: any,
 *   } | null,
 *   metric: "seeds" | "highest_scan",
 *   onOpponentClick?: (email: string) => void,
 *   isLightUi?: boolean,
 * }} props
 */
export default function LeaderboardUserCard({
  ownRank,
  totalPlayers,
  ownScore,
  user,
  userLogoAssets,
  nextOpponent = null,
  metric = "seeds",
  onOpponentClick,
  isLightUi = false,
}) {
  const scoreUnit = metric === "seeds" ? "Samen" : "Seeds";
  const targetRank = ownRank > 1 ? ownRank - 1 : 1;
  const opponentScore = nextOpponent ? nextOpponent.score : ownScore;
  const gap = nextOpponent ? Math.max(0, opponentScore - ownScore) : 0;

  // Segmented progress calculate (0 to 4 filled bars)
  const progressRatio = nextOpponent && opponentScore > 0
    ? Math.min(1, Math.max(0, ownScore / opponentScore))
    : 1;
  const totalSegments = 4;
  const activeSegments = Math.round(progressRatio * totalSegments);

  return (
    <GoldGradientCard
      as="div"
      className="w-full"
      blur
      rounded="2xl"
      shadow={false}
      borderClassName="gold-gradient-border-mask-thin"
      contentClassName="p-3 sm:p-4 space-y-3"
    >
      {/* ── Top Summary Header (Rank, total players, progress, gap, Trophy) ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xl sm:text-2xl font-black text-[#a3e635] tracking-tight drop-shadow-[0_0_8px_rgba(163,230,53,0.3)]">
            {ownRank > 0 ? `#${ownRank}` : "—"}
          </span>
          <span className={`text-xs font-semibold ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
            von {Math.max(totalPlayers, ownRank > 0 ? ownRank : 1)} Spielern
          </span>
        </div>

        {/* Laurel Trophy Graphic */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400/20 to-yellow-600/10 border border-amber-400/30 text-amber-300 shadow-[0_0_12px_rgba(250,204,21,0.2)]">
          <Trophy className="w-4 h-4 text-amber-300" />
        </div>
      </div>

      {/* Progress & Gap line */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${isLightUi ? "text-stone-700" : "text-stone-300"}`}>
          {ownRank === 1 ? (
            <span className="text-amber-300 font-bold">Platz 1 verteidigen! 👑</span>
          ) : nextOpponent ? (
            <>
              Noch <span className="text-[#a3e635] font-black">{gap.toLocaleString()} {scoreUnit}</span> bis Platz {targetRank}
            </>
          ) : (
            <span>Sammle Samen für die Rangliste</span>
          )}
        </span>

        <span className="font-bold text-lime-300">
          {ownScore.toLocaleString()} {scoreUnit}
        </span>
      </div>

      {/* Progress bar line */}
      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-lime-500/20">
        <div
          className="h-full bg-gradient-to-r from-lime-500 to-emerald-400 transition-all duration-500 rounded-full"
          style={{ width: `${Math.min(100, Math.max(5, progressRatio * 100))}%` }}
        />
      </div>

      {/* ── Personal Card + Next Opponent (ohne Kreisränder um Logos, kein Clipping) ── */}
      <div className="pt-1 flex items-center justify-between gap-2 min-w-0 border-t border-[#f0e5a5]/15">
        {/* User Side */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0 w-12 h-12 overflow-visible">
            <CustomLogoAvatar
              noClip
              logoAssets={userLogoAssets}
              className="w-full h-full"
              tooltipText={user?.display_name || user?.full_name || "Du"}
              fallbackText={user?.display_name?.charAt(0) || "D"}
              fallbackClassName="text-sm font-black text-white"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-lime-400/90">
                DU
              </span>
              <p className="text-sm font-black text-stone-100 truncate">
                {user?.display_name || user?.full_name || "Jascha"}
              </p>
            </div>

            <p className="text-sm font-black text-[#a3e635] drop-shadow-[0_0_6px_rgba(163,230,53,0.4)]">
              {ownScore.toLocaleString()} {scoreUnit}
            </p>
          </div>
        </div>

        {/* Center: Gap / Segmented Bar */}
        <div className="hidden sm:flex flex-col items-center px-2 min-w-0">
          {nextOpponent && ownRank > 1 ? (
            <>
              <p className="text-[10px] text-stone-400 whitespace-nowrap text-center">
                Noch <span className="text-lime-300 font-bold">{gap} {scoreUnit}</span>
                <br />bis Platz {targetRank}
              </p>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: totalSegments }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-1 rounded-full transition-colors ${
                      i < activeSegments
                        ? "bg-lime-400 shadow-[0_0_4px_rgba(163,230,53,0.8)]"
                        : "bg-stone-700/60"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : ownRank === 1 ? (
            <span className="text-xs font-bold text-amber-300">Spitzenreiter 🥇</span>
          ) : null}
        </div>

        {/* Right Side: Next Opponent */}
        {nextOpponent && ownRank > 1 ? (
          <div
            className="flex items-center gap-2 pl-3 border-l border-[#f0e5a5]/20 cursor-pointer group min-w-0"
            onClick={() => nextOpponent.email && onOpponentClick && onOpponentClick(nextOpponent.email)}
          >
            <div className="text-right min-w-0">
              <span className="text-[9px] uppercase tracking-wide text-stone-400 block truncate">
                Nächster Gegner
              </span>
              <p className="text-xs font-bold text-stone-200 truncate group-hover:text-lime-300 transition-colors">
                {nextOpponent.name || "Gegner"}
              </p>
              <p className="text-[11px] font-semibold text-lime-400/90">
                {nextOpponent.score.toLocaleString()} {scoreUnit}
              </p>
            </div>

            <div className="w-10 h-10 flex-shrink-0 overflow-visible">
              <CustomLogoAvatar
                noClip
                logoAssets={nextOpponent.logoAssets}
                className="w-full h-full"
                tooltipText={nextOpponent.name || "Gegner"}
                fallbackText={nextOpponent.name?.charAt(0) || "G"}
                fallbackClassName="text-xs font-bold text-white"
              />
            </div>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-lime-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </div>
        ) : null}
      </div>
    </GoldGradientCard>
  );
}

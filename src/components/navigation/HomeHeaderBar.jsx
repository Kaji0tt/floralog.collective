import { useState } from "react";
import { ChevronLeft, Gem, Home as HomeIcon, Plus, Settings, Sparkles, Bug } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";
import { LockedTooltip } from "@/components/ui/locked-tooltip";

/**
 * @param {{
 *   activePanel: string | null,
 *   embeddedTitle?: string | null,
 *   embeddedSubtitle?: string | null,
 *   embeddedInfoLabel?: string | null,
 *   embeddedCollectionCanGoBack?: boolean,
 *   displayName?: string | null,
 *   userTitle?: string | null,
 *   playerSparks?: number,
 *   playerAmber?: number,
 *   onEmbeddedCollectionBack?: () => void,
 *   onOpenEmbeddedFriendsAddDialog?: () => void,
 *   onOpenAmberPurchase?: () => void,
 *   onOpenAmberShop?: () => void,
 *   onOpenBugReport?: () => void,
 *   onPrimaryAction: () => void,
 * }} props
 */
export default function HomeHeaderBar({
  hidden = false,
  activePanel,
  embeddedTitle,
  embeddedSubtitle,
  embeddedInfoLabel,
  embeddedCollectionCanGoBack,
  displayName,
  userTitle,
  playerSparks,
  playerAmber,
  onEmbeddedCollectionBack,
  onEmbeddedAchievementsBack,
  onOpenEmbeddedFriendsAddDialog,
  onOpenAmberPurchase,
  onOpenAmberShop,
  onOpenBugReport,
  onPrimaryAction,
}) {
  const { isLightUi } = useUiTheme();
  const [showActionModal, setShowActionModal] = useState(false);
  const showEmbeddedCollection = activePanel === "collection";
  const showEmbeddedFriends = activePanel === "friends";
  const showEmbeddedShop = activePanel === "shop";
  const isEmbeddedMode = activePanel !== null;
  const showAchievementsBack = activePanel === "achievements" && typeof onEmbeddedAchievementsBack === "function";
  const shopCurrencyInfo = showEmbeddedShop && embeddedInfoLabel && typeof embeddedInfoLabel === "object"
    ? embeddedInfoLabel
    : null;
  const homeCurrencyInfo = !isEmbeddedMode
    ? {
        sparks: Math.max(0, Number(playerSparks ?? 0)),
        amber: Math.max(0, Number(playerAmber ?? 0)),
      }
    : null;
  const shouldShowEmbeddedInfoChip = Boolean(embeddedInfoLabel) && isEmbeddedMode && !showEmbeddedShop;

  if (hidden) return null;

  const resolvedEmbeddedTitle = embeddedTitle || (showEmbeddedCollection
    ? "Kollektionen"
    : activePanel === "settings"
      ? "Einstellungen"
      : null);

  // Use smaller font when a back button is shown (title can be longer, e.g. "Rangliste · All-Time")
  const titleSizeClass = (showAchievementsBack || (showEmbeddedCollection && embeddedCollectionCanGoBack))
    ? "text-lg md:text-xl"
    : "text-2xl md:text-3xl";

  return (
    <div className={`flex items-start justify-between gap-3 pb-3 border-b ${isLightUi ? "border-[#b99a48]/30" : "border-[#f0e5a5]/20"}`}>
      <div className="min-w-0">
        {resolvedEmbeddedTitle ? (
          <div className="min-w-0 flex items-start gap-2">
            {showEmbeddedCollection && embeddedCollectionCanGoBack && typeof onEmbeddedCollectionBack === "function" && (
              <button
                type="button"
                onClick={onEmbeddedCollectionBack}
                className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors shrink-0 ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
                aria-label="Zur Kategorieauswahl"
              >
                <ChevronLeft className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              </button>
            )}
            {showAchievementsBack && (
              <button
                type="button"
                onClick={onEmbeddedAchievementsBack}
                className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors shrink-0 ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
                aria-label="Zurück"
              >
                <ChevronLeft className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              </button>
            )}

            <div className="min-w-0">
              <h1 className={`font-bold leading-tight truncate ${titleSizeClass}`} title={resolvedEmbeddedTitle}>
                {resolvedEmbeddedTitle}
              </h1>
              {!showEmbeddedShop && embeddedSubtitle && (
                <p className={`${isLightUi ? "text-stone-700/90" : "text-stone-200/85"} text-sm md:text-base truncate mt-0.5`}>
                  {embeddedSubtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <h1
              className="font-bold leading-tight text-2xl md:text-3xl truncate"
              title={displayName || undefined}
            >
              {displayName}
            </h1>
            <p className={`${isLightUi ? "text-stone-700/90" : "text-stone-200/85"} text-sm md:text-base truncate mt-0.5`}>
              {userTitle || "Pflanzen-Entdecker"}
            </p>
          </div>
        )}
        {shouldShowEmbeddedInfoChip && (
          <div className="mt-2">
            <span
              className={`inline-flex items-center h-7 rounded-full border px-2.5 text-[11px] font-semibold max-w-full ${
                isLightUi
                  ? "border-[#c8ac62]/55 bg-white/60 text-[#8f6b22]"
                  : "border-[#f0e5a5]/35 bg-black/30 text-[#f0e5a5]"
              }`}
            >
              <span className="truncate">{embeddedInfoLabel}</span>
            </span>
          </div>
        )}
        <div className="hidden mt-1 h-8 items-center gap-1" aria-hidden="true">
          <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
          <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
          <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {homeCurrencyInfo && (
          <>
            <LockedTooltip
              content={<span className="text-xs leading-relaxed">Funken sind die Ingame-Währung. Du bekommst sie für die aktive Nutzung der App sowie für bestimmte In-App-Aktivitäten.</span>}
            >
              <div
                className={`w-11 h-11 rounded-full border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 ${isLightUi ? "border-[#c8ac62]/55 bg-white/65" : "border-[#f0e5a5]/35 bg-black/30"}`}
                aria-label="Funken"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} aria-hidden="true" />
                <span className={`text-[10px] font-semibold leading-none ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                  {homeCurrencyInfo.sparks}
                </span>
              </div>
            </LockedTooltip>

            <LockedTooltip
              content={<span className="text-xs leading-relaxed">Bernstein ist eine kaufbare Premium-Währung. Tippe, um Bernstein zu kaufen.</span>}
            >
              <button
                type="button"
                onClick={onOpenAmberShop}
                className={`w-11 h-11 rounded-full border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 transition-colors ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
                aria-label="Bernstein kaufen"
              >
                <Gem className={`w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} aria-hidden="true" />
                <span className={`text-[10px] font-semibold leading-none ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                  {homeCurrencyInfo.amber}
                </span>
              </button>
            </LockedTooltip>
          </>
        )}

        {shopCurrencyInfo && (
          <>
            <div
              className={`w-11 h-11 rounded-full border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 ${isLightUi ? "border-[#c8ac62]/55 bg-white/65" : "border-[#f0e5a5]/35 bg-black/30"}`}
              aria-label="Funken"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} aria-hidden="true" />
              <span className={`text-[10px] font-semibold leading-none ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                {Math.max(0, Number(shopCurrencyInfo.sparks ?? 0))}
              </span>
            </div>

            {typeof onOpenAmberPurchase === "function" ? (
              <button
                type="button"
                onClick={onOpenAmberPurchase}
                className={`w-11 h-11 rounded-full border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 transition-colors ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
                aria-label="Bernstein kaufen"
              >
                <span className={`inline-flex items-center justify-center w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} aria-hidden="true">🔸</span>
                <span className={`text-[10px] font-semibold leading-none ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                  {Math.max(0, Number(shopCurrencyInfo.amber ?? 0))}
                </span>
              </button>
            ) : (
              <div
                className={`w-11 h-11 rounded-full border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 ${isLightUi ? "border-[#c8ac62]/55 bg-white/65" : "border-[#f0e5a5]/35 bg-black/30"}`}
                aria-label="Bernstein"
              >
                <span className={`inline-flex items-center justify-center w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} aria-hidden="true">🔸</span>
                <span className={`text-[10px] font-semibold leading-none ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                  {Math.max(0, Number(shopCurrencyInfo.amber ?? 0))}
                </span>
              </div>
            )}
          </>
        )}

        {showEmbeddedFriends && (
          <button
            type="button"
            onClick={onOpenEmbeddedFriendsAddDialog}
            className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
            aria-label="Freund hinzufuegen"
          >
            <Plus className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
          </button>
        )}

        <button
          type="button"
          onClick={() => isEmbeddedMode ? onPrimaryAction() : setShowActionModal(true)}
          className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors relative ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
          aria-label={isEmbeddedMode ? "Zur Home-Ansicht" : "Menü"}
        >
          {isEmbeddedMode ? (
            <HomeIcon className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
          ) : (
            <div className="flex items-center gap-0.5">
              <Bug className={`w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <span className={`text-[9px] font-bold ${isLightUi ? "text-[#8f6b22]/60" : "text-[#f0e5a5]/60"}`}>/</span>
              <Settings className={`w-3.5 h-3.5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
            </div>
          )}
        </button>

        {showActionModal && !isEmbeddedMode && (
          <>
            <div className="fixed inset-0 z-[999] bg-black/40" onClick={() => setShowActionModal(false)} />
            <div className={`absolute right-0 top-14 z-[1000] rounded-xl border shadow-xl p-2 min-w-[160px] ${isLightUi ? "border-[#c8ac62]/55 bg-white/95" : "border-[#f0e5a5]/35 bg-stone-900/95"}`}>
              <button
                type="button"
                onClick={() => { setShowActionModal(false); onOpenBugReport?.(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${isLightUi ? "hover:bg-stone-100" : "hover:bg-stone-800"}`}
              >
                <Bug className={`w-4 h-4 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
                <span className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Bug melden</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowActionModal(false); onPrimaryAction(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${isLightUi ? "hover:bg-stone-100" : "hover:bg-stone-800"}`}
              >
                <Settings className={`w-4 h-4 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
                <span className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Einstellungen</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { Home as HomeIcon, List, Plus, Settings, Sparkles } from "lucide-react";
import { useUiTheme } from "@/lib/UiThemeContext";

/**
 * @param {{
 *   activePanel: string | null,
 *   embeddedTitle?: string | null,
 *   embeddedSubtitle?: string | null,
 *   embeddedInfoLabel?: string | null,
 *   embeddedCollectionPublicPanelOpen?: boolean,
 *   displayName?: string | null,
 *   userTitle?: string | null,
 *   onTogglePublicCollections?: () => void,
 *   onOpenEmbeddedFriendsAddDialog?: () => void,
 *   onOpenAmberPurchase?: () => void,
 *   onPrimaryAction: () => void,
 * }} props
 */
export default function HomeHeaderBar({
  activePanel,
  embeddedTitle,
  embeddedSubtitle,
  embeddedInfoLabel,
  embeddedCollectionPublicPanelOpen,
  displayName,
  userTitle,
  onTogglePublicCollections,
  onOpenEmbeddedFriendsAddDialog,
  onOpenAmberPurchase,
  onPrimaryAction,
}) {
  const { isLightUi } = useUiTheme();
  const showEmbeddedCollection = activePanel === "collection";
  const showEmbeddedFriends = activePanel === "friends";
  const showEmbeddedShop = activePanel === "shop";
  const isEmbeddedMode = activePanel !== null;
  const shopCurrencyInfo = showEmbeddedShop && embeddedInfoLabel && typeof embeddedInfoLabel === "object"
    ? embeddedInfoLabel
    : null;
  const shouldShowEmbeddedInfoChip = Boolean(embeddedInfoLabel) && isEmbeddedMode && !showEmbeddedShop;

  const resolvedEmbeddedTitle = embeddedTitle || (showEmbeddedCollection
    ? "Kollektionen"
    : activePanel === "settings"
      ? "Einstellungen"
      : null);

  return (
    <div className={`flex items-start justify-between gap-3 pb-3 border-b ${isLightUi ? "border-[#b99a48]/30" : "border-[#f0e5a5]/20"}`}>
      <div className="min-w-0">
        {resolvedEmbeddedTitle ? (
          <div className="min-w-0">
            <h1 className="font-bold leading-tight text-2xl md:text-3xl truncate" title={resolvedEmbeddedTitle}>
              {resolvedEmbeddedTitle}
            </h1>
            {!showEmbeddedShop && embeddedSubtitle && (
              <p className={`${isLightUi ? "text-stone-700/90" : "text-stone-200/85"} text-sm md:text-base truncate mt-0.5`}>
                {embeddedSubtitle}
              </p>
            )}
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

        {showEmbeddedCollection && (
          <button
            type="button"
            onClick={onTogglePublicCollections}
            className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
            aria-label={embeddedCollectionPublicPanelOpen ? "Oeffentliche Kollektionen schliessen" : "Oeffentliche Kollektionen anzeigen"}
            aria-pressed={embeddedCollectionPublicPanelOpen}
          >
            <List className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
          </button>
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
          onClick={onPrimaryAction}
          className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors ${isLightUi ? "border-[#c8ac62]/55 bg-white/65 hover:bg-white/80" : "border-[#f0e5a5]/35 bg-black/30 hover:bg-black/45"}`}
          aria-label={isEmbeddedMode ? "Zur Home-Ansicht" : "Einstellungen"}
        >
          {isEmbeddedMode ? (
            <HomeIcon className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
          ) : (
            <Settings className={`w-5 h-5 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
          )}
        </button>
      </div>
    </div>
  );
}

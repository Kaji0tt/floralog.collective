import { Home as HomeIcon, List, Settings } from "lucide-react";

export default function HomeHeaderBar({
  isLightUi,
  embeddedTitle,
  embeddedSubtitle,
  embeddedInfoLabel,
  hasEmbeddedView,
  showEmbeddedCollection,
  showEmbeddedSettings,
  embeddedCollectionPublicPanelOpen,
  displayName,
  displayNameFontSize,
  userTitle,
  onTogglePublicCollections,
  onPrimaryAction,
}) {
  const resolvedEmbeddedTitle = embeddedTitle || (showEmbeddedCollection
    ? "Kollektionen"
    : showEmbeddedSettings
      ? "Einstellungen"
      : null);

  const isEmbeddedMode = Boolean(hasEmbeddedView || showEmbeddedCollection || showEmbeddedSettings || resolvedEmbeddedTitle);

  return (
    <div className={`flex items-start justify-between gap-3 pb-3 border-b ${isLightUi ? "border-[#b99a48]/30" : "border-[#f0e5a5]/20"}`}>
      <div className="min-w-0">
        {resolvedEmbeddedTitle ? (
          <div className="min-w-0">
            <h1 className="font-bold leading-tight text-2xl md:text-3xl truncate" title={resolvedEmbeddedTitle}>
              {resolvedEmbeddedTitle}
            </h1>
            {embeddedSubtitle && (
              <p className={`${isLightUi ? "text-stone-700/90" : "text-stone-200/85"} text-sm md:text-base truncate mt-0.5`}>
                {embeddedSubtitle}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-baseline gap-2 min-w-0">
            <h1
              className="font-bold leading-tight truncate"
              style={{ fontSize: displayNameFontSize }}
              title={displayName}
            >
              {displayName}
            </h1>
            <p className={`${isLightUi ? "text-stone-700/90" : "text-stone-200/85"} text-base md:text-lg whitespace-nowrap truncate`}>
              {userTitle || "Pflanzen-Entdecker"}
            </p>
          </div>
        )}
        <div className="hidden mt-1 h-8 items-center gap-1" aria-hidden="true">
          <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
          <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
          <span className="w-8 h-8 rounded-full border border-white/25 bg-white/10" />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!!embeddedInfoLabel && isEmbeddedMode && (
          <span
            className={`hidden sm:inline-flex items-center h-9 rounded-full border px-3 text-xs font-semibold ${
              isLightUi
                ? "border-[#c8ac62]/55 bg-white/65 text-[#8f6b22]"
                : "border-[#f0e5a5]/35 bg-black/30 text-[#f0e5a5]"
            }`}
          >
            {embeddedInfoLabel}
          </span>
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

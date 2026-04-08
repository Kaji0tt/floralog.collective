import { Leaf, Minus, Plus } from "lucide-react";
import SearchSortBar from "./SearchSortBar";

const parseColorToRgbTriplet = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();

  const rgbMatch = trimmed.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[1], 10))),
      g: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[2], 10))),
      b: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[3], 10))),
    };
  }

  const hex = trimmed.replace(/^#/, "");
  if (hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length === 6 && /^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
};

const toRgba = (colorValue, opacity) => {
  const rgb = parseColorToRgbTriplet(colorValue);
  if (!rgb) return null;
  const safeOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeOpacity})`;
};

export default function PublicCollectionScreen({
  isLightUi,
  uiTheme,
  listTopFadePx,
  listBottomFadePx,
  allPublicCollections,
  followedPublicCollections,
  discoverablePublicCollections,
  searchQuery,
  onSearchQueryChange,
  sortValue,
  onSortChange,
  onOpenCollection,
  onToggleFollow,
  isCollectionTogglePending,
}) {
  const renderCollectionCard = (collectionEntry) => {
    const accent = collectionEntry.background_color || "rgb(34,197,94)";
    const accentSoftBg =
      toRgba(accent, isLightUi ? 0.13 : 0.2) ||
      (isLightUi ? "rgba(34,197,94,0.13)" : "rgba(34,197,94,0.2)");
    const accentLine =
      toRgba(accent, isLightUi ? 0.55 : 0.62) ||
      (isLightUi ? "rgba(34,197,94,0.55)" : "rgba(34,197,94,0.62)");

    return (
      <div key={collectionEntry.id} className="w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenCollection(collectionEntry.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenCollection(collectionEntry.id);
            }
          }}
          className={
            "relative overflow-hidden rounded-2xl border backdrop-blur-md px-3 py-3 cursor-pointer transition-all hover:translate-y-[-1px] " +
            (isLightUi
              ? "bg-white/78 border-[#c8ac62]/35 hover:bg-white/86"
              : "bg-black/36 border-[#f0e5a5]/30 hover:bg-black/48")
          }
        >
          <div className="absolute left-0 top-0 h-full w-1" style={{ background: accentLine }} />
          <div className="absolute left-0 top-0 h-full w-16" style={{ background: `linear-gradient(90deg, ${accentSoftBg} 0%, transparent 100%)` }} />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className={"text-[11px] mb-0.5 truncate flex items-center gap-1.5 " + (isLightUi ? "text-stone-700" : "text-stone-300")}>
                {!collectionEntry.isOwnCollection && (
                  <button
                    type="button"
                    disabled={isCollectionTogglePending}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFollow(collectionEntry);
                    }}
                    aria-label={collectionEntry.isFollowing ? "Abo beenden" : "Abonnieren"}
                    className={
                      "shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors disabled:opacity-60 " +
                      (collectionEntry.isFollowing
                        ? (isLightUi
                          ? "bg-emerald-50/95 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                          : "bg-emerald-950/60 border-emerald-300/60 text-emerald-200 hover:bg-emerald-900/70")
                        : (isLightUi
                          ? "bg-white/85 border-[#c8ac62]/45 text-[#8f6b22] hover:bg-white"
                          : "bg-black/45 border-[#f0e5a5]/35 text-[#f0e5a5] hover:bg-black/60"))
                    }
                  >
                    {collectionEntry.isFollowing ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                  </button>
                )}
                <span className="truncate">{collectionEntry.ownerNameForCard}</span>
              </div>

              <div className={"text-sm font-semibold truncate mb-0.5 " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
                {collectionEntry.title}
              </div>

              <div className={"text-[11px] font-medium mb-0.5 " + (isLightUi ? "text-emerald-700" : "text-emerald-300")}>
                Fortschritt: {collectionEntry.progress.discovered}/{collectionEntry.progress.total}
              </div>

              {collectionEntry.description && (
                <div className={"text-[11px] line-clamp-2 " + (isLightUi ? "text-stone-600" : "text-stone-300/90")}>
                  {collectionEntry.description}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 text-[11px] flex-shrink-0">
              <div className={"rounded-full px-2 py-0.5 border " + (isLightUi ? "bg-white/75 border-[#c8ac62]/35 text-stone-700" : "bg-black/45 border-[#f0e5a5]/30 text-stone-100")}>
                {collectionEntry.itemsCount} Pflanzen
              </div>
              <div className={"rounded-full px-2 py-0.5 border " + (isLightUi ? "bg-white/75 border-[#c8ac62]/35 text-stone-700" : "bg-black/45 border-[#f0e5a5]/30 text-stone-100")}>
                {collectionEntry.followersCount} Follower
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="shrink-0">
        <SearchSortBar
          placeholder="Titel, Beschreibung oder Owner durchsuchen..."
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          sortOptions={[
            { value: "newest", label: "Neu" },
            { value: "title", label: "Titel" },
            { value: "followers", label: "Follower" },
            { value: "items", label: "Pflanzen" },
          ]}
          sortValue={sortValue}
          onSortChange={onSortChange}
          uiTheme={uiTheme}
        />
      </div>

      <div
        className="relative flex-1 min-h-0 overflow-y-auto pb-2"
        style={{
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
          maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
        }}
      >
        {!allPublicCollections.length ? (
          <div className="text-center py-16 px-3" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
            <div className={"w-20 h-20 rounded-full border mx-auto mb-4 flex items-center justify-center " + (isLightUi ? "bg-white/75 border-[#c8ac62]/35" : "bg-black/45 border-[#f0e5a5]/30")}>
              <Leaf className={"w-10 h-10 " + (isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]")} />
            </div>
            <h3 className={"text-base font-semibold mb-1 " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
              Noch keine oeffentlichen Kollektionen
            </h3>
            <p className={"text-[12px] max-w-sm mx-auto " + (isLightUi ? "text-stone-600" : "text-stone-300/90")}>
              Markiere deine Kollektionen als oeffentlich, damit andere sie hier entdecken koennen.
            </p>
          </div>
        ) : (
          <div className="space-y-3" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
            {followedPublicCollections.length > 0 && (
              <div className="space-y-2">
                <div className="px-1">
                  <h3 className={"text-xs font-semibold uppercase tracking-wide " + (isLightUi ? "text-emerald-800" : "text-emerald-300")}>
                    Deine Abos
                  </h3>
                </div>
                <div className="space-y-2">
                  {followedPublicCollections.map((collectionEntry) => renderCollectionCard(collectionEntry))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="px-1">
                <h3 className={"text-xs font-semibold uppercase tracking-wide " + (isLightUi ? "text-stone-700" : "text-stone-300")}>
                  Oeffentliche Kollektionen
                </h3>
              </div>
              <div className="space-y-2">
                {discoverablePublicCollections.length > 0 ? (
                  discoverablePublicCollections.map((collectionEntry) => renderCollectionCard(collectionEntry))
                ) : (
                  <div className={"text-center py-6 rounded-xl border border-dashed text-[12px] " + (isLightUi ? "bg-white/60 border-[#c8ac62]/35 text-stone-600" : "bg-black/28 border-[#f0e5a5]/30 text-stone-300") }>
                    Aktuell keine weiteren oeffentlichen Kollektionen.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

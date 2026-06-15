import { useMemo, useState } from "react";
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
  onCreateCollection,
}) {
  const [scopeFilter, setScopeFilter] = useState("all");

  const scopedCollections = useMemo(() => {
    if (scopeFilter === "followed") {
      return followedPublicCollections;
    }
    if (scopeFilter === "discover") {
      return discoverablePublicCollections;
    }
    return [...followedPublicCollections, ...discoverablePublicCollections];
  }, [scopeFilter, followedPublicCollections, discoverablePublicCollections]);

  const heroTotal = allPublicCollections.length;
  const heroFollowed = followedPublicCollections.length;
  const heroPercent = heroTotal > 0 ? Math.round((heroFollowed / heroTotal) * 100) : 0;

  const renderCollectionCard = (collectionEntry) => {
    const cardIsLightUi = collectionEntry.ownerUiTheme === "light";
    const accent = collectionEntry.ownerBackgroundColor || collectionEntry.background_color || "rgb(34,197,94)";
    const accentSoftBg =
      toRgba(accent, cardIsLightUi ? 0.13 : 0.2) ||
      (cardIsLightUi ? "rgba(34,197,94,0.13)" : "rgba(34,197,94,0.2)");
    const accentLine =
      toRgba(accent, cardIsLightUi ? 0.55 : 0.62) ||
      (cardIsLightUi ? "rgba(34,197,94,0.55)" : "rgba(34,197,94,0.62)");

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
            (cardIsLightUi
              ? "bg-white/78 border-[#c8ac62]/35 hover:bg-white/86"
              : "bg-black/36 border-[#f0e5a5]/30 hover:bg-black/48")
          }
        >
          <div className="absolute left-0 top-0 h-full w-1" style={{ background: accentLine }} />
          <div className="absolute left-0 top-0 h-full w-16" style={{ background: `linear-gradient(90deg, ${accentSoftBg} 0%, transparent 100%)` }} />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className={"text-[11px] mb-0.5 truncate flex items-center gap-1.5 " + (cardIsLightUi ? "text-stone-700" : "text-stone-300")}>
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
                        ? (cardIsLightUi
                          ? "bg-emerald-50/95 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                          : "bg-emerald-950/60 border-emerald-300/60 text-emerald-200 hover:bg-emerald-900/70")
                        : (cardIsLightUi
                          ? "bg-white/85 border-[#c8ac62]/45 text-[#8f6b22] hover:bg-white"
                          : "bg-black/45 border-[#f0e5a5]/35 text-[#f0e5a5] hover:bg-black/60"))
                    }
                  >
                    {collectionEntry.isFollowing ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                  </button>
                )}
                <span className="truncate">{collectionEntry.ownerNameForCard}</span>
              </div>

              <div className={"text-sm font-semibold truncate mb-0.5 " + (cardIsLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
                {collectionEntry.title}
              </div>

              <div className={"text-[11px] font-medium mb-0.5 " + (cardIsLightUi ? "text-emerald-700" : "text-emerald-300")}>
                Fortschritt: {collectionEntry.progress.discovered}/{collectionEntry.progress.total}
              </div>

              {collectionEntry.description && (
                <div className={"text-[11px] line-clamp-2 " + (cardIsLightUi ? "text-stone-600" : "text-stone-300/90")}>
                  {collectionEntry.description}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 text-[11px] flex-shrink-0">
              <div className={"rounded-full px-2 py-0.5 border " + (cardIsLightUi ? "bg-white/75 border-[#c8ac62]/35 text-stone-700" : "bg-black/45 border-[#f0e5a5]/30 text-stone-100")}>
                {collectionEntry.itemsCount} Pflanzen
              </div>
              <div className={"rounded-full px-2 py-0.5 border " + (cardIsLightUi ? "bg-white/75 border-[#c8ac62]/35 text-stone-700" : "bg-black/45 border-[#f0e5a5]/30 text-stone-100")}>
                {collectionEntry.followersCount} Follower
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col gap-3">
      <div className="shrink-0 space-y-3">
        <div className="-mx-4 px-4 pb-0">
          <div
            className={"rounded-2xl border shadow-sm backdrop-blur-sm px-2 py-2 " + (isLightUi ? "bg-white/58" : "bg-black/30")}
            style={{
              borderColor: isLightUi ? "rgba(200,172,98,0.32)" : "rgba(240,229,165,0.28)",
            }}
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[
                { key: "all", label: "Alle", count: heroTotal },
                { key: "followed", label: "Abos", count: heroFollowed },
                { key: "discover", label: "Entdecken", count: discoverablePublicCollections.length },
              ].map((chip) => {
                const isActive = scopeFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setScopeFilter(chip.key)}
                    className={
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors " +
                      (isActive
                        ? (isLightUi
                          ? "bg-white/90 text-[#8f6b22] shadow-sm"
                          : "bg-black/55 text-[#f7f0c1] shadow-sm")
                        : (isLightUi
                          ? "bg-white/55 text-stone-700 hover:bg-white/75"
                          : "bg-black/35 text-stone-200 hover:bg-black/50"))
                    }
                    style={{
                      borderColor: isActive
                        ? (isLightUi ? "rgba(200,172,98,0.70)" : "rgba(240,229,165,0.75)")
                        : (isLightUi ? "rgba(200,172,98,0.35)" : "rgba(255,255,255,0.3)"),
                    }}
                  >
                    <span className="font-medium">{chip.label}</span>
                    <span className={"text-[10px] " + (isLightUi ? "text-stone-600" : "text-stone-300")}>{chip.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className={"rounded-2xl border shadow-sm p-3 flex flex-col gap-3 backdrop-blur-sm " + (isLightUi ? "bg-white/55" : "bg-black/35")}
          style={{
            borderColor: isLightUi ? "rgba(200,172,98,0.38)" : "rgba(240,229,165,0.35)",
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className={"text-lg font-bold leading-tight flex-1 min-w-0 truncate " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>Stoebern</h1>
              <button
                type="button"
                onClick={onCreateCollection}
                className={"shrink-0 w-8 h-8 rounded-full border flex items-center justify-center shadow-sm transition-colors " + (isLightUi
                  ? "bg-white/75 border-[#c8ac62]/45 text-[#8f6b22] hover:bg-white"
                  : "bg-black/45 border-[#f0e5a5]/40 text-[#f0e5a5] hover:bg-black/60")}
                aria-label="Neue Kollektion anlegen"
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
            <p className={"text-[11px] leading-snug " + (isLightUi ? "text-stone-700" : "text-stone-200/90")}>
              Oeffentliche Nutzerkollektionen entdecken und abonnieren.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 space-y-1">
              <div className={"flex items-center justify-between text-[10px] " + (isLightUi ? "text-stone-700" : "text-stone-200/90")}>
                <span>Abonnierte oeffentliche Kollektionen</span>
                <span>{heroFollowed}/{heroTotal || 0}</span>
              </div>
              <div className={"w-full h-2 rounded-full overflow-hidden border " + (isLightUi ? "bg-stone-200/80 border-[#c8ac62]/30" : "bg-black/40 border-white/10")}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${heroPercent}%`,
                    background: "linear-gradient(90deg, rgb(96, 165, 250) 0%, rgb(59, 130, 246) 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

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
        className="relative flex-1 min-h-0 overflow-y-auto pb-20"
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
          <div className="space-y-2" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
            {scopedCollections.length > 0 ? (
              scopedCollections.map((collectionEntry) => renderCollectionCard(collectionEntry))
            ) : (
              <div className={"text-center py-6 rounded-xl border border-dashed text-[12px] " + (isLightUi ? "bg-white/60 border-[#c8ac62]/35 text-stone-600" : "bg-black/28 border-[#f0e5a5]/30 text-stone-300") }>
                Keine passenden oeffentlichen Kollektionen in diesem Bereich.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

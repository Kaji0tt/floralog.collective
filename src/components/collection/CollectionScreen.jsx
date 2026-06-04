import { Leaf, Minus, Plus, PencilLine, SlidersHorizontal } from "lucide-react";
import GenusCard from "./GenusCard";
import SearchSortBar from "./SearchSortBar";

const CATEGORY_CHIPS = [
  { value: "Bäume", emoji: "🌳" },
  { value: "Sträucher", emoji: "🌿" },
  { value: "Blumen", emoji: "🌸" },
];

export default function CollectionScreen({
  readOnly = false,
  friendEmail = null,
  showFriendHighlights = false,
  friendDiscoveryMetaByGenusId = {},
  isQuestCollectionView,
  ownedCollections,
  followedCollections,
  getCollectionStats,
  selectedCollectionId,
  onCollectionChipSelect,
  isLightUi,
  onCreateCollection,
  isHeroSegmentOpen,
  heroTitle,
  selectedCollection,
  isOwnerOfSelected,
  isFollowingSelected,
  userCollectionLinkForSelected,
  onUnfollow,
  onFollow,
  isFollowLoading,
  onEditCollection,
  heroStats,
  heroProgressPercent,
  activeCategory,
  onSetActiveCategory,
  sortChipsOpen,
  onSetSortChipsOpen,
  activeBackgroundColor,
  getLighterColor,
  searchQuery,
  onSearchQueryChange,
  collectionSort,
  onCollectionSortChange,
  discoveredFilter,
  onDiscoveredFilterChange,
  listScrollContainerRef,
  onCollectionListScroll,
  listTopFadePx,
  listBottomFadePx,
  filteredGenera,
  sortedGenera,
  onShowHint,
  userDiscoveries,
  plants,
  currentUser,
  uiTheme,
}) {
  return (
    <>
      <div className="shrink-0 space-y-3">
        {!isQuestCollectionView && (ownedCollections.length + followedCollections.length > 0) && (
          <div className="-mx-4 px-4 pb-0">
            <div
              className={"rounded-2xl border shadow-sm backdrop-blur-sm px-2 py-2 " + (isLightUi ? "bg-white/58" : "bg-black/30")}
              style={{
                borderColor: isLightUi ? "rgba(200,172,98,0.32)" : "rgba(240,229,165,0.28)",
              }}
            >
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {(() => {
                const followedCollectionsChips = followedCollections.map((collectionEntry) => ({
                  id: collectionEntry.id,
                  title: collectionEntry.title,
                  isGlobal: false,
                  isFollowed: true,
                }));

                const allChips = [
                  { id: "global", title: "Global", isGlobal: true },
                  ...ownedCollections.map((collectionEntry) => ({ id: collectionEntry.id, title: collectionEntry.title, isGlobal: false })),
                  ...followedCollectionsChips,
                ];

                return allChips.map((chip) => {
                  const stats = getCollectionStats(chip.id === "global" ? "global" : chip.id);
                  const isActive = selectedCollectionId === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => onCollectionChipSelect(chip.id)}
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
                      <span className="font-medium">{chip.title}</span>
                      <span className={"text-[10px] " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
                        {stats.discovered}/{stats.total || "–"}
                      </span>
                    </button>
                  );
                });
              })()}
              </div>
            </div>
          </div>
        )}

        {isHeroSegmentOpen && (
          <div
            className={"rounded-2xl border shadow-sm p-3 flex flex-col gap-3 backdrop-blur-sm " + (isLightUi ? "bg-white/55" : "bg-black/35")}
            style={{
              borderColor: isLightUi ? "rgba(200,172,98,0.38)" : "rgba(240,229,165,0.35)",
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h1 className={"text-lg font-bold leading-tight flex-1 min-w-0 truncate " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
                  {heroTitle}
                </h1>
                {!readOnly && !isQuestCollectionView && (ownedCollections.length + followedCollections.length === 0) && (
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
                )}
                {selectedCollection && !isQuestCollectionView && !readOnly && (
                  <div className="shrink-0 flex items-center gap-1.5">
                    {(selectedCollection.followers_count ?? 0) > 0 && (
                      <div
                        className={"p-1 rounded-full border flex items-center justify-center text-[10px] font-bold " + (isLightUi
                          ? "bg-white/80 text-sky-800 border-sky-600/55"
                          : "bg-black/45 text-stone-100 border-sky-300/70")}
                        title={`${selectedCollection.followers_count} Follower`}
                      >
                        {selectedCollection.followers_count}
                      </div>
                    )}

                    {selectedCollection.is_public && !isOwnerOfSelected && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isFollowingSelected && userCollectionLinkForSelected) {
                            onUnfollow(userCollectionLinkForSelected.id);
                          } else if (!isFollowingSelected) {
                            onFollow(selectedCollection.id);
                          }
                        }}
                        disabled={isFollowLoading}
                        className={
                          isFollowingSelected
                            ? (isLightUi
                              ? "shrink-0 p-1 rounded-full border bg-white/85 text-red-700 hover:bg-white border-red-500/70 transition-colors disabled:opacity-60"
                              : "shrink-0 p-1 rounded-full border bg-black/45 text-stone-100 hover:bg-black/60 border-red-300/80 transition-colors disabled:opacity-60")
                            : (isLightUi
                              ? "shrink-0 p-1 rounded-full border bg-white/85 text-emerald-700 hover:bg-white border-emerald-500/70 transition-colors disabled:opacity-60"
                              : "shrink-0 p-1 rounded-full border bg-black/45 text-stone-100 hover:bg-black/60 border-emerald-300/80 transition-colors disabled:opacity-60")
                        }
                        aria-label={isFollowingSelected ? "Abo beenden" : "Abonnieren"}
                      >
                        {isFollowingSelected ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </button>
                    )}

                    {isOwnerOfSelected && (
                      <button
                        type="button"
                        onClick={() => onEditCollection(selectedCollection.id)}
                        className={"shrink-0 p-1.5 rounded-full border transition-colors " + (isLightUi
                          ? "bg-white/85 text-[#8f6b22] hover:bg-white border-[#c8ac62]/45"
                          : "bg-black/45 text-[#f0e5a5] hover:bg-black/60 border-[#f0e5a5]/35")}
                        aria-label="Kollektion bearbeiten"
                      >
                        <PencilLine className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {selectedCollection?.description && (
                <p className={"text-[11px] max-h-[4.5em] overflow-y-auto leading-snug rounded focus:outline-none focus:ring-1 " + (isLightUi ? "text-stone-700 focus:ring-[#c8ac62]/45" : "text-stone-200/90 focus:ring-[#f0e5a5]/40")} tabIndex={0}>
                  {selectedCollection.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 space-y-1">
                <div className={"flex items-center justify-between text-[10px] " + (isLightUi ? "text-stone-700" : "text-stone-200/90")}>
                  <div className="flex items-center gap-1">
                    <span>Fortschritt</span>
                    {heroStats.total > 0 && (
                      <span className={"text-[10px] " + (isLightUi ? "text-stone-600" : "text-stone-300/90")}>
                        ({heroStats.discovered}/{heroStats.total})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span>{heroProgressPercent}%</span>
                    {CATEGORY_CHIPS.map((categoryChip) => {
                      const isActive = activeCategory === categoryChip.value;
                      return (
                        <button
                          key={categoryChip.value}
                          type="button"
                          onClick={() => onSetActiveCategory(isActive ? null : categoryChip.value)}
                          className={
                            "p-1 rounded-full border transition-colors " +
                            (isActive
                              ? (isLightUi
                                ? "bg-white/95 text-[#8f6b22] border-[#c8ac62]/70"
                                : "bg-black/55 text-[#f0e5a5] border-[#f0e5a5]/70")
                              : (isLightUi
                                ? "bg-white/60 text-stone-700 border-[#c8ac62]/35 hover:bg-white"
                                : "bg-black/35 text-stone-100 border-white/30 hover:bg-black/55"))
                          }
                          aria-label={categoryChip.value + (isActive ? " deaktivieren" : " filtern")}
                          aria-pressed={isActive}
                        >
                          <span className="text-[11px] leading-none">{categoryChip.emoji}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onSetSortChipsOpen(!sortChipsOpen)}
                      className={
                        "p-1 rounded-full transition-colors " +
                        (sortChipsOpen
                          ? (isLightUi ? "bg-white/95 text-[#8f6b22] border border-[#c8ac62]/65" : "bg-black/60 text-[#f0e5a5]")
                          : (isLightUi ? "bg-white/70 text-stone-700 border border-[#c8ac62]/35 hover:bg-white" : "bg-black/40 text-stone-100 hover:bg-black/60"))
                      }
                      aria-label={sortChipsOpen ? "Suche und Sortierung ausblenden" : "Suche und Sortierung einblenden"}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className={"w-full h-2 rounded-full overflow-hidden border " + (isLightUi ? "bg-stone-200/80 border-[#c8ac62]/30" : "bg-black/40 border-white/10")}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: heroProgressPercent + "%",
                      background: activeBackgroundColor
                        ? `linear-gradient(90deg, ${getLighterColor(activeBackgroundColor)} 0%, ${activeBackgroundColor} 100%)`
                        : "linear-gradient(90deg, rgb(74, 222, 128) 0%, rgb(34, 197, 94) 100%)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {sortChipsOpen && (
          <div className="space-y-2">
            <SearchSortBar
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              sortOptions={[
                { value: "index", label: "Index" },
                { value: "newest", label: "Neu" },
                { value: "title", label: "Titel" },
                { value: "rarity", label: "Rarität" },
              ]}
              sortValue={collectionSort}
              onSortChange={onCollectionSortChange}
              showSortControls={sortChipsOpen}
              showDiscoveredToggle
              discoveredFilter={discoveredFilter}
              onDiscoveredFilterChange={onDiscoveredFilterChange}
              uiTheme={uiTheme}
            />
          </div>
        )}
      </div>

      <div
        ref={listScrollContainerRef}
        onScroll={onCollectionListScroll}
        className="relative flex-1 min-h-0 overflow-y-auto pb-20"
        style={{
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
          maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
        }}
      >
        {filteredGenera.length === 0 ? (
          <div className="text-center py-20">
            <div className={"w-24 h-24 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border " + (isLightUi ? "bg-white/65 border-[#c8ac62]/35" : "bg-black/45 border-[#f0e5a5]/30")}>
              <Leaf className={"w-12 h-12 " + (isLightUi ? "text-[#9a7728]" : "text-[#f0e5a5]")} />
            </div>
            <h3 className={"text-2xl font-bold mb-2 " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
              Keine Pflanzen gefunden
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
            {sortedGenera.map((genus) => (
              <GenusCard
                key={genus.id}
                genus={genus}
                onShowHint={onShowHint}
                userDiscoveries={userDiscoveries}
                plants={plants}
                selectedCollectionId={selectedCollectionId}
                friendEmail={friendEmail}
                friendDiscoveries={showFriendHighlights ? (friendDiscoveryMetaByGenusId?.[genus.id]?.friends || []) : []}
                friendDiscoveryCount={showFriendHighlights ? (friendDiscoveryMetaByGenusId?.[genus.id]?.count || 0) : 0}
                collectionNote={genus.collectionNote}
                isAdmin={currentUser?.role === "admin"}
                uiTheme={uiTheme}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

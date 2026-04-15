import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useFriendData } from "@/components/friends/hooks/useFriendData";
import FriendExperienceShell from "@/components/friends/FriendExperienceShell";
import GenusCard from "../components/collection/GenusCard";
import SearchSortBar from "../components/collection/SearchSortBar";
import { Leaf, SlidersHorizontal } from "lucide-react";

const CATEGORY_CHIPS = [
  { value: "Bäume", emoji: "🌳" },
  { value: "Sträucher", emoji: "🌿" },
  { value: "Blumen", emoji: "🌸" },
];

export default function FriendCollection() {
  const { isLightUi, uiTheme } = useUiTheme();

  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [discoveredFilter, setDiscoveredFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [friendCollectionSort, setFriendCollectionSort] = useState("index");

  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get("email");

  const { friendUser, isFriend, isLoading, averageColor } =
    useFriendData(friendEmail);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ["genera"],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: () => Query.Plant.list(),
  });

  const { data: friendDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ["friendDiscoveries", friendUser?.auth_id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: friendUser.auth_id }),
    enabled: !!friendUser?.auth_id,
  });

  const contentLoading = isLoading || generaLoading || plantsLoading || discoveriesLoading;

  // ── Derived data ─────────────────────────────────────────────────────────────
  const friendPlantIds = friendDiscoveries.map((d) => d.plant_id);
  const friendPlants = plants.filter((p) => friendPlantIds.includes(p.id));

  const generaWithNumbers = genera.map((genus, index) => {
    if (!genus.category_dex_number) {
      const categoryGenera = genera.filter(
        (g) =>
          g.category === genus.category &&
          g.category_dex_number &&
          g.id !== genus.id
      );
      const highestNumber = Math.max(0, ...categoryGenera.map((g) => g.category_dex_number));
      return { ...genus, category_dex_number: highestNumber + index + 1 };
    }
    return genus;
  });

  const generaWithDiscovery = generaWithNumbers
    .map((genus) => {
      const genusPlants = friendPlants.filter(
        (p) =>
          p.genus_category === genus.category &&
          p.genus_number === genus.category_dex_number
      );
      const allGenusPlants = plants.filter(
        (p) =>
          p.genus_category === genus.category &&
          p.genus_number === genus.category_dex_number
      );
      return {
        ...genus,
        discovered: genusPlants.length > 0,
        discoveredCount: genusPlants.length,
        totalSpecies: allGenusPlants.length,
      };
    })
    .sort((a, b) => {
      if (a.category !== b.category) {
        const order = { Bäume: 1, Sträucher: 2, Blumen: 3 };
        return (order[a.category] || 9) - (order[b.category] || 9);
      }
      return (a.category_dex_number || 0) - (b.category_dex_number || 0);
    });

  let filteredGenera = generaWithDiscovery;
  if (discoveredFilter === "undiscovered") filteredGenera = filteredGenera.filter((g) => !g.discovered);
  else if (discoveredFilter === "discovered") filteredGenera = filteredGenera.filter((g) => g.discovered);
  if (activeCategory) filteredGenera = filteredGenera.filter((g) => g.category === activeCategory);
  filteredGenera = filteredGenera.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (g.genus_name?.toLowerCase().includes(q) || g.scientific_genus?.toLowerCase().includes(q))
      return true;
    return plants.some(
      (p) =>
        p.genus_category === g.category &&
        p.genus_number === g.category_dex_number &&
        (p.species_name?.toLowerCase().includes(q) || p.scientific_name?.toLowerCase().includes(q))
    );
  });

  let sortedGenera = [...filteredGenera];
  if (friendCollectionSort === "title") {
    sortedGenera.sort((a, b) => (a.genus_name || "").localeCompare(b.genus_name || "", "de"));
  } else if (friendCollectionSort === "rarity") {
    sortedGenera.sort((a, b) => {
      const diff = (b.maxRarityScore || 0) - (a.maxRarityScore || 0);
      return diff !== 0 ? diff : (a.genus_name || "").localeCompare(b.genus_name || "", "de");
    });
  } else if (friendCollectionSort === "newest") {
    sortedGenera.sort((a, b) => (b.lastDiscoveryDate || 0) - (a.lastDiscoveryDate || 0));
  } else {
    const categoryOrder = { Bäume: 1, Sträucher: 2, Blumen: 3 };
    sortedGenera.sort((a, b) => {
      if (a.category !== b.category)
        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
      return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
    });
  }

  const totalDiscoveredGenera = generaWithDiscovery.filter((g) => g.discovered).length;
  const totalGeneraCount = generaWithDiscovery.length;
  const heroProgressPercent = totalGeneraCount
    ? Math.round((totalDiscoveredGenera / totalGeneraCount) * 100)
    : 0;
  const listTopFadePx = 12;

  // ── Style tokens ─────────────────────────────────────────────────────────────
  const cardSurface = isLightUi
    ? "bg-white/65 border border-[#c8ac62]/35 backdrop-blur-md"
    : "bg-black/30 border border-[#f0e5a5]/20 backdrop-blur-md";
  const textPrimary = isLightUi ? "text-stone-900" : "text-stone-100";
  const textSecondary = isLightUi ? "text-stone-600" : "text-stone-300";

  return (
    <FriendExperienceShell
      friendUser={friendUser}
      activeTab="collection"
      friendEmail={friendEmail}
      averageColor={averageColor}
      isLoading={contentLoading}
      accessDenied={!isFriend && !isLoading}
    >
      <div className="h-full overflow-hidden flex flex-col gap-2">
        {/* Hero progress card */}
        <div className={`shrink-0 rounded-2xl p-3 ${cardSurface}`}>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className={`flex items-center gap-1 ${textSecondary}`}>
                  <span>Sammlungsfortschritt</span>
                  {totalGeneraCount > 0 && (
                    <span>({totalDiscoveredGenera}/{totalGeneraCount})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={textSecondary}>{heroProgressPercent}%</span>
                  {CATEGORY_CHIPS.map((chip) => {
                    const isActive = activeCategory === chip.value;
                    return (
                      <button
                        key={chip.value}
                        onClick={() => setActiveCategory(isActive ? null : chip.value)}
                        className={`p-1 rounded-full border transition-colors ${
                          isActive
                            ? isLightUi
                              ? "bg-stone-100 border-emerald-500 text-stone-700"
                              : "bg-white/10 border-emerald-400 text-stone-100"
                            : isLightUi
                            ? "bg-stone-100 border-stone-300 text-stone-600 hover:bg-stone-200"
                            : "bg-white/5 border-white/20 text-stone-400 hover:bg-white/10"
                        }`}
                        aria-label={chip.value}
                        aria-pressed={isActive}
                      >
                        <span className="text-[11px] leading-none">{chip.emoji}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setFiltersOpen((v) => !v)}
                    className={`p-1 rounded-full transition-colors ${
                      filtersOpen
                        ? isLightUi ? "bg-stone-200 text-stone-800" : "bg-white/20 text-stone-100"
                        : isLightUi ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-white/5 text-stone-400 hover:bg-white/10"
                    }`}
                    aria-label={filtersOpen ? "Filter ausblenden" : "Filter einblenden"}
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden ${
                  isLightUi ? "bg-stone-200" : "bg-white/10"
                }`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${heroProgressPercent}%`,
                    backgroundColor: averageColor || (isLightUi ? "rgb(34, 197, 94)" : "rgb(134, 239, 172)"),
                  }}
                />
              </div>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-2">
              <SearchSortBar
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                sortOptions={[
                  { value: "index", label: "Index" },
                  { value: "newest", label: "Neu" },
                  { value: "title", label: "Titel" },
                  { value: "rarity", label: "Rarität" },
                ]}
                sortValue={friendCollectionSort}
                onSortChange={setFriendCollectionSort}
                showSortControls={true}
                showDiscoveredToggle
                discoveredFilter={discoveredFilter}
                onDiscoveredFilterChange={setDiscoveredFilter}
                uiTheme={uiTheme}
              />
            </div>
          )}
        </div>

        {/* Scrollable genus grid */}
        <div
          className="relative flex-1 min-h-0 overflow-y-auto pb-2"
          style={{
            WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
            maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
          }}
        >
          {sortedGenera.length === 0 ? (
            <div className="text-center py-16">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isLightUi ? "bg-white/70 border border-stone-200" : "bg-black/30 border border-white/10"
                }`}
              >
                <Leaf className={`w-10 h-10 ${isLightUi ? "text-stone-400" : "text-stone-500"}`} />
              </div>
              <p className={`text-lg font-bold mb-1 ${textPrimary}`}>
                Keine Pflanzen gefunden
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2"
              style={{ paddingTop: listTopFadePx }}
            >
              {sortedGenera.map((genus) => (
                <GenusCard
                  key={genus.id}
                  genus={genus}
                  userDiscoveries={friendDiscoveries}
                  plants={plants}
                  friendEmail={friendEmail}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </FriendExperienceShell>
  );
}

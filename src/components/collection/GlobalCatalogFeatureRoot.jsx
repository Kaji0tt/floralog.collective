import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useUiTheme } from "@/lib/UiThemeContext";
import { ChevronDown, ChevronUp } from "lucide-react";
import GenusCard from "./GenusCard";
import SearchSortBar from "./SearchSortBar";
import GoldGradientCard from "@/components/home/GoldGradientCard";
import { getRarityLevelFromLabel } from "@/lib/plantRarity";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";

const CATEGORY_ORDER = {
  "Bäume": 1,
  "Sträucher": 2,
  "Blumen": 3,
  "Blumen & Kräuter": 3,
};

const getCategoryOrder = (cat) => CATEGORY_ORDER[cat] || 99;

// Merkt sich Sortierung/Filter/Scrollposition, damit man beim Zurücknavigieren (z.B. von GenusDetail) die gleiche Ansicht vorfindet.
const VIEW_STATE_STORAGE_KEY = "floralog:globalCollectionViewState";

const loadStoredViewState = () => {
  try {
    const raw = sessionStorage.getItem(VIEW_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function GlobalCatalogFeatureRoot() {
  const { isLightUi, uiTheme } = useUiTheme();
  const storedViewState = useRef(loadStoredViewState()).current;
  const scrollContainerRef = useRef(null);
  const restoredScrollRef = useRef(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState(storedViewState?.searchQuery || "");
  const [sort, setSort] = useState(storedViewState?.sort || "index");
  const [discoveredFilter, setDiscoveredFilter] = useState(storedViewState?.discoveredFilter || "all");
  const [isHeroExpanded, setIsHeroExpanded] = useState(storedViewState?.heroExpanded !== false);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify({
        searchQuery,
        sort,
        discoveredFilter,
        heroExpanded: isHeroExpanded,
        scrollTop: scrollContainerRef.current?.scrollTop ?? storedViewState?.scrollTop ?? 0,
      }));
    } catch {
      // sessionStorage optional - view state simply resets if unavailable.
    }
  }, [searchQuery, sort, discoveredFilter, isHeroExpanded, storedViewState?.scrollTop]);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ["genera"],
    queryFn: () => Query.PlantGenus.list(),
  });
  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: () => Query.Plant.listAll(),
  });
  const { data: discoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ["userDiscoveries", currentUser?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: currentUser?.id }),
    enabled: Boolean(currentUser?.id),
  });
  const { data: communityTags = [] } = useQuery({
    queryKey: ["communityTags"],
    queryFn: () => Query.CommunityTag.listAll(),
  });
  const { data: allDiscoveries = [] } = useQuery({
    queryKey: ["globalCatalogCommunityDiscoveries"],
    queryFn: () => Query.UserPlantDiscovery.list("-discovered_date", 1500),
    enabled: Boolean(currentUser?.id),
  });
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["globalCatalogPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
    enabled: Boolean(currentUser?.id),
  });
  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    enabled: Boolean(currentUser?.id),
  });

  const friendDiscoveryMetaByGenusId = useMemo(() => {
    const profileByAuthId = new Map(
      publicProfiles
        .filter((profile) => profile?.auth_id && profile.auth_id !== currentUser?.id)
        .filter((profile) => profile.public_profile !== false && profile.global_explorer_visibility !== false)
        .map((profile) => [profile.auth_id, profile])
    );
    const genusIdByKey = new Map(
      genera.map((genus) => [`${genus.category}::${genus.category_dex_number}`, genus.id])
    );
    const actorsByGenusId = new Map();

    allDiscoveries.forEach((discovery) => {
      const profile = profileByAuthId.get(discovery?.auth_id);
      const plant = plants.find((entry) => entry.id === discovery?.plant_id);
      const genusId = plant && genusIdByKey.get(`${plant.genus_category}::${plant.genus_number}`);
      if (!profile || !genusId) return;

      if (!actorsByGenusId.has(genusId)) actorsByGenusId.set(genusId, new Map());
      actorsByGenusId.get(genusId).set(profile.auth_id, {
        authId: profile.auth_id,
        email: profile.user_email,
        name: profile.display_name || profile.full_name || profile.user_email || "Spieler",
        logoAssets: resolveEquippedLogoAssetsWithCatalog(profile, logoAssets),
      });
    });

    return Object.fromEntries(
      Array.from(actorsByGenusId, ([genusId, actors]) => [
        genusId,
        { friends: Array.from(actors.values()), count: actors.size },
      ])
    );
  }, [allDiscoveries, currentUser?.id, genera, logoAssets, plants, publicProfiles]);

  const displayedGenera = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const discoveredPlantIds = new Set(discoveries.map((discovery) => discovery.plant_id));
    const genusIdByPlantId = new Map(
      plants.map((plant) => {
        const genus = genera.find(
          (candidate) => candidate.category === plant.genus_category && candidate.category_dex_number === plant.genus_number
        );
        return [plant.id, genus?.id];
      })
    );
    const matchingTagGenusIds = new Set(
      communityTags
        .filter((tag) => tag.status === "active" && (!normalizedQuery || tag.normalized_value?.includes(normalizedQuery)))
        .map((tag) => tag.genus_id || genusIdByPlantId.get(tag.plant_id))
        .filter(Boolean)
    );

    return genera
      .map((genus) => {
        const genusPlants = plants.filter(
          (plant) => plant.genus_category === genus.category && plant.genus_number === genus.category_dex_number
        );
        const genusDiscoveries = discoveries.filter((discovery) => discoveredPlantIds.has(discovery.plant_id) && genusPlants.some((plant) => plant.id === discovery.plant_id));
        const discoveredCount = genusDiscoveries.length;
        const lastDiscoveryTimestamp = Math.max(
          0,
          ...genusDiscoveries.map((discovery) => new Date(discovery.discovered_date || discovery.created_date || 0).getTime() || 0)
        );
        const maxRarityLevel = Math.max(
          0,
          ...genusPlants.map((plant) => getRarityLevelFromLabel(plant.rarity ?? plant.aiData?.rarity ?? null))
        );
        return { ...genus, discovered: discoveredCount > 0, discoveredCount, totalSpecies: genusPlants.length, lastDiscoveryTimestamp, maxRarityLevel };
      })
      .filter((genus) => {
        if (discoveredFilter === "discovered" && !genus.discovered) return false;
        if (discoveredFilter === "undiscovered" && genus.discovered) return false;
        if (!normalizedQuery) return true;
        if (genus.genus_name?.toLowerCase().includes(normalizedQuery) || genus.scientific_genus?.toLowerCase().includes(normalizedQuery)) return true;
        if (matchingTagGenusIds.has(genus.id)) return true;
        return plants.some(
          (plant) => plant.genus_category === genus.category && plant.genus_number === genus.category_dex_number &&
            (plant.species_name?.toLowerCase().includes(normalizedQuery) || plant.scientific_name?.toLowerCase().includes(normalizedQuery))
        );
      })
      .sort((left, right) => {
        if (sort === "title") return (left.genus_name || "").localeCompare(right.genus_name || "", "de");
        if (sort === "newest") return right.lastDiscoveryTimestamp - left.lastDiscoveryTimestamp || (left.genus_name || "").localeCompare(right.genus_name || "", "de");
        if (sort === "rarity") return right.maxRarityLevel - left.maxRarityLevel || (left.genus_name || "").localeCompare(right.genus_name || "", "de");
        const catA = getCategoryOrder(left.category);
        const catB = getCategoryOrder(right.category);
        if (catA !== catB) {
          return catA - catB;
        }
        return (left.category_dex_number || 0) - (right.category_dex_number || 0);
      });
  }, [communityTags, discoveredFilter, discoveries, genera, plants, searchQuery, sort]);

  const discoveredSpeciesCount = new Set(discoveries.map((discovery) => discovery.plant_id)).size;
  const totalSpeciesCount = plants.length;
  const progressPercent = totalSpeciesCount > 0 ? Math.round((discoveredSpeciesCount / totalSpeciesCount) * 100) : 0;

  useEffect(() => {
    if (restoredScrollRef.current) return;
    if (generaLoading || plantsLoading || discoveriesLoading) return;
    if (!scrollContainerRef.current || !storedViewState?.scrollTop) {
      restoredScrollRef.current = true;
      return;
    }
    scrollContainerRef.current.scrollTop = storedViewState.scrollTop;
    restoredScrollRef.current = true;
  }, [generaLoading, plantsLoading, discoveriesLoading, storedViewState?.scrollTop]);

  if (generaLoading || plantsLoading || discoveriesLoading) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-stone-500">Lade globale Sammlung...</div>;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="min-h-0 w-full flex-1 overflow-y-auto scrollbar-hide"
        onScroll={(event) => {
          try {
            const stored = loadStoredViewState() || {};
            sessionStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify({
              ...stored,
              scrollTop: event.currentTarget.scrollTop,
            }));
          } catch {
            // sessionStorage optional - scroll position simply resets if unavailable.
          }
        }}
        style={{
          // Schmaler Fade kurz vor der Bottom-Nav für einen natürlichen Übergang statt eines harten Schnitts.
          WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)",
          maskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)",
        }}
      >
        {/* Hero schwebt (sticky) über dem Content, der dahinter nach oben weg gescrollt wird. */}
        <div className="sticky top-2 z-20 px-3 pb-3">
          {/* shadow={false}: eine sichtbare Card-Shadow würde in den direkt darunter liegenden Scroll-Content bluten
              und wie ein vorzeitiges Ausblenden der obersten Reihe wirken. */}
          <GoldGradientCard className="relative w-full" contentClassName="space-y-3 p-3" blur shadow={false}>
            <div className="flex items-center justify-between gap-2">
              <h1 className={isLightUi ? "text-lg font-bold text-stone-900" : "text-lg font-bold text-[#f8f4d6]"}>Globale Sammlung</h1>
              <button
                type="button"
                onClick={() => setIsHeroExpanded((prev) => !prev)}
                aria-label={isHeroExpanded ? "Sammlung-Kopfbereich einklappen" : "Sammlung-Kopfbereich ausklappen"}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${isLightUi ? "border-stone-300 bg-white/80 text-stone-600 hover:bg-white" : "border-[#f0e5a5]/35 bg-black/40 text-stone-200 hover:bg-black/60"}`}
              >
                {isHeroExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {isHeroExpanded && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className={isLightUi ? "text-stone-600" : "text-stone-300/85"}>
                      Fortschritt ({discoveredSpeciesCount}/{totalSpeciesCount})
                    </span>
                    <span className={isLightUi ? "font-semibold text-stone-800" : "font-semibold text-[#f7f0c1]"}>{progressPercent}%</span>
                  </div>
                  <div className={`h-2 w-full overflow-hidden rounded-full ${isLightUi ? "bg-stone-200" : "bg-black/50"}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <SearchSortBar
                  placeholder="Gattung, Art oder Tag suchen"
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  sortOptions={[
                    { value: "index", label: "Index" },
                    { value: "newest", label: "Neu" },
                    { value: "title", label: "Titel" },
                    { value: "rarity", label: "Rarität" },
                  ]}
                  sortValue={sort}
                  onSortChange={setSort}
                  showDiscoveredToggle
                  discoveredFilter={discoveredFilter}
                  onDiscoveredFilterChange={setDiscoveredFilter}
                  uiTheme={uiTheme}
                />
              </>
            )}
          </GoldGradientCard>
        </div>
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {displayedGenera.map((genus) => (
            <GenusCard
              key={genus.id}
              genus={genus}
              onShowHint={() => {}}
              userDiscoveries={discoveries}
              plants={plants}
              friendEmail={null}
              friendDiscoveries={friendDiscoveryMetaByGenusId[genus.id]?.friends || []}
              friendDiscoveryCount={friendDiscoveryMetaByGenusId[genus.id]?.count || 0}
              collectionNote={null}
              uiTheme={uiTheme}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Leaf, Search } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import MobileBackButton from "../components/navigation/MobileBackButton";
import HintDialog from "../components/collection/HintDialog";

const getAverageColor = (imageUrl) => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        resolve("rgb(" + r + ", " + g + ", " + b + ")");
      } catch (error) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

function SearchFilterPanel({
  visible,
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  filters,
  generaWithDiscovery,
  collectionQuests,
  userCollectionQuests,
}) {
  if (!visible) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400" />
          <Input
            type="text"
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-white h-9 text-sm rounded-full"
          />
        </div>

        <div>
          <Select value={activeCategory} onValueChange={setActiveCategory}>
            <SelectTrigger className="bg-white h-9 text-xs w-32 rounded-full">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {filters.map((filter) => {
                let matchingGenera = generaWithDiscovery;
                if (filter.value === "not_discovered") {
                  matchingGenera = generaWithDiscovery.filter((g) => !g.discovered);
                } else if (filter.value === "discovered") {
                  matchingGenera = generaWithDiscovery.filter((g) => g.discovered);
                } else if (filter.value === "rarity") {
                  matchingGenera = generaWithDiscovery.filter((g) => g.hasRareSpecies);
                }
                const discovered = matchingGenera.filter((g) => g.discovered).length;
                return (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label} ({discovered}/{matchingGenera.length})
                  </SelectItem>
                );
              })}

              <div className="px-2 py-1.5">
                <div className="border-t border-stone-200" />
              </div>

              {collectionQuests.filter((q) => q.is_active).length > 0 ? (
                collectionQuests
                  .filter((q) => q.is_active)
                  .map((quest) => {
                    const userQuest = userCollectionQuests.find(
                      (ucq) => ucq.collection_quest_id === quest.id
                    );
                    const progress = userQuest?.discovered_plants?.length || 0;
                    const total = quest.target_plants?.length || 0;
                    return (
                      <SelectItem
                        key={quest.id}
                        value={"collection_" + quest.id}
                      >
                        {quest.icon_emoji} {quest.title} ({progress}/{total})
                      </SelectItem>
                    );
                  })
              ) : (
                <SelectItem value="no_collections" disabled>
                  ❓
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function Collection() {
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState("global");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user || !user.id) {
        return [];
      }
      return Query.UserPlantDiscovery.filter({ auth_id: user.id });
    },
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list(),
  });

  const { data: userCollectionQuests = [] } = useQuery({
    queryKey: ['userCollectionQuests'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user || !user.id) return [];
      return Query.UserCollectionQuest.filter({ auth_id: user.id });
    },
  });

  const { data: ownedCollections = [] } = useQuery({
    queryKey: ['ownedCollections', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return Query.Collection.filter({ auth_id: user.id });
    },
    enabled: !!user?.id,
  });

  const { data: allCollectionItems = [] } = useQuery({
    queryKey: ['collectionItems'],
    queryFn: () => Query.CollectionItem.list(),
  });

  const isLoading = generaLoading || plantsLoading || discoveriesLoading;

  const rarityOrder = { "Häufig": 1, "Gelegentlich": 2, "Selten": 3 };

  const generaWithDiscovery = genera.map(genus => {
    const genusPlants = plants.filter(p => 
      p.genus_category === genus.category && p.genus_number === genus.category_dex_number
    );
    const discoveredSpecies = genusPlants.filter(p =>
      userDiscoveries.some(d => d.plant_id === p.id)
    );

    const maxRarityScore = genusPlants.reduce((max, plant) => {
      const score = rarityOrder[plant.rarity] || 0;
      return score > max ? score : max;
    }, 0);

    return {
      ...genus,
      discovered: discoveredSpecies.length > 0,
      discoveredCount: discoveredSpecies.length,
      totalSpecies: genusPlants.length,
      hasRareSpecies: maxRarityScore >= 2,
      maxRarityScore
    };
  }).sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
      return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
    }
    return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
  });

  const filters = [
    { value: "Alle", label: "Alle" },
    { value: "not_discovered", label: "Noch nicht entdeckt" },
    { value: "discovered", label: "Entdeckt" },
    { value: "rarity", label: "Rarität" },
  ];

  // Check if activeCategory is a collection quest ID
  const isCollectionFilter = activeCategory.startsWith('collection_');
  const collectionId = isCollectionFilter ? activeCategory.replace('collection_', '') : null;
  
  const selectedCollection =
    selectedCollectionId !== 'global'
      ? ownedCollections.find((c) => c.id === selectedCollectionId)
      : null;

  const getCollectionStats = (collectionKey) => {
    if (!collectionKey || collectionKey === 'global') {
      const total = generaWithDiscovery.length;
      const discovered = generaWithDiscovery.filter((g) => g.discovered).length;
      return { discovered, total };
    }

    const itemsForCollection = allCollectionItems.filter(
      (item) => item.collection_id === collectionKey
    );
    if (!itemsForCollection.length) {
      return { discovered: 0, total: 0 };
    }

    const genusIds = new Set(
      itemsForCollection.map((item) => item.genus_id).filter(Boolean)
    );
    const plantIds = new Set(
      itemsForCollection.map((item) => item.plant_id).filter(Boolean)
    );

    if (plantIds.size > 0) {
      plants.forEach((plant) => {
        if (plantIds.has(plant.id)) {
          const genus = genera.find(
            (g) =>
              g.category === plant.genus_category &&
              g.category_dex_number === plant.genus_number
          );
          if (genus) {
            genusIds.add(genus.id);
          }
        }
      });
    }

    const relevantGenera = generaWithDiscovery.filter((g) => genusIds.has(g.id));
    const total = relevantGenera.length;
    const discovered = relevantGenera.filter((g) => g.discovered).length;
    return { discovered, total };
  };
  
  let filteredGenera = generaWithDiscovery;
  
  if (isCollectionFilter && collectionId) {
    const collection = collectionQuests.find(c => c.id === collectionId);
    if (collection?.target_plants) {
      const targetPlantIds = collection.target_plants;
      const targetGeneraIds = new Set();
      
      plants.forEach(plant => {
        if (targetPlantIds.includes(plant.id)) {
          const genus = genera.find(g => 
            g.category === plant.genus_category && 
            g.category_dex_number === plant.genus_number
          );
          if (genus) targetGeneraIds.add(genus.id);
        }
      });
      
      filteredGenera = filteredGenera.filter(g => targetGeneraIds.has(g.id));
    }
  } else {
    if (activeCategory === "not_discovered") {
      filteredGenera = filteredGenera.filter(g => !g.discovered);
    } else if (activeCategory === "discovered") {
      filteredGenera = filteredGenera.filter(g => g.discovered);
    } else if (activeCategory === "rarity") {
      filteredGenera = filteredGenera.filter(g => g.hasRareSpecies);
    }
    // "Alle" zeigt einfach alle Gattungen ohne zusätzlichen Filter
  }
  
  // Falls eine benutzerdefinierte Kollektion ausgewählt ist, auf deren Items einschränken
  if (selectedCollection) {
    const itemsForSelected = allCollectionItems.filter(
      (item) => item.collection_id === selectedCollection.id
    );

    if (itemsForSelected.length > 0) {
      const genusIds = new Set(
        itemsForSelected.map((item) => item.genus_id).filter(Boolean)
      );
      const plantIds = new Set(
        itemsForSelected.map((item) => item.plant_id).filter(Boolean)
      );

      if (plantIds.size > 0) {
        plants.forEach((plant) => {
          if (plantIds.has(plant.id)) {
            const genus = genera.find(
              (g) =>
                g.category === plant.genus_category &&
                g.category_dex_number === plant.genus_number
            );
            if (genus) {
              genusIds.add(genus.id);
            }
          }
        });
      }

      filteredGenera = filteredGenera.filter((g) => genusIds.has(g.id));
    }
  }

  filteredGenera = filteredGenera.filter(g => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return g.genus_name?.toLowerCase().includes(query) ||
           g.scientific_genus?.toLowerCase().includes(query);
  });

  const discoveredCount = filteredGenera.filter(g => g.discovered).length;
  const totalCount = filteredGenera.length;

  const discoveredSpecies = userDiscoveries.length;
  const totalSpecies = plants.length;

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  const handleShowHint = (genus) => {
    setSelectedGenus(genus);
    setShowHintDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const getLighterColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
    const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
    const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
    return "rgb(" + r + ", " + g + ", " + b + ")";
  };

  const getDarkerColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.floor(parseInt(match[1]) * 0.6);
    const g = Math.floor(parseInt(match[2]) * 0.6);
    const b = Math.floor(parseInt(match[3]) * 0.6);
    return "rgb(" + r + ", " + g + ", " + b + ")";
  };

  const activeBackgroundColor = selectedCollection?.background_color || averageColor;
  const heroStats = getCollectionStats(selectedCollection ? selectedCollection.id : 'global');
  const heroProgressPercent = heroStats.total
    ? Math.round((heroStats.discovered / heroStats.total) * 100)
    : 0;

  const ownerName = user?.display_name || user?.full_name || "Dein";
  const heroTitle = selectedCollection
    ? selectedCollection.title
    : ownerName + "'s Floralog";

  return (
    <div className="relative min-h-screen">
      {/* Fixer Hintergrund */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: activeBackgroundColor 
            ? "linear-gradient(135deg, "
              + getLighterColor(activeBackgroundColor)
              + " 0%, "
              + activeBackgroundColor
              + " 50%, "
              + getDarkerColor(activeBackgroundColor)
              + " 100%)"
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      />
      
      {/* Scrollbarer Content */}
      <div className="min-h-screen p-4 md:p-8">
        <MobileBackButton />

        <HintDialog
          genus={selectedGenus}
          isOpen={showHintDialog}
          onClose={() => setShowHintDialog(false)}
        />

        <div className="max-w-7xl mx-auto pt-0 space-y-3">
          {/* Horizontale Kollektionen-Chips */}
          <div className="-mx-4 px-4 pb-0 flex gap-2 overflow-x-auto no-scrollbar">
            {(() => {
              const all = [
                { id: 'global', title: 'Global', isGlobal: true },
                ...ownedCollections.map((c) => ({ id: c.id, title: c.title, isGlobal: false })),
              ];
              return all.map((col) => {
                const stats = getCollectionStats(col.id === 'global' ? 'global' : col.id);
                const isActive = selectedCollectionId === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors " +
                      (isActive
                        ? "bg-white text-stone-900 shadow-sm"
                        : "bg-white/70 text-stone-600 hover:bg-white")
                    }
                    style={{
                      borderColor: isActive
                        ? activeBackgroundColor || 'rgba(148,163,184,0.5)'
                        : 'rgba(226,232,240,1)',
                    }}
                  >
                    <span className="font-medium">{col.title}</span>
                    <span className="text-[10px] text-stone-500">
                      {stats.discovered}/{stats.total || '–'}
                    </span>
                  </button>
                );
              });
            })()}
          </div>

          {/* Hero-Kachel */}
          <div
            className="bg-white/80 rounded-2xl border shadow-sm p-3 flex flex-col gap-3"
            style={{
              borderColor: activeBackgroundColor || 'rgba(148, 163, 184, 0.35)',
            }}
          >
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-stone-900 leading-tight">
                {heroTitle}
              </h1>
              {selectedCollection?.description && (
                <p className="text-[11px] text-stone-600 line-clamp-2">
                  {selectedCollection.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-stone-600">
                  <div className="flex items-center gap-1">
                    <span>Sammlungsfortschritt</span>
                    {heroStats.total > 0 && (
                      <span className="text-[10px] text-stone-500">
                        ({heroStats.discovered}/{heroStats.total})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span>{heroProgressPercent}%</span>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen((prev) => !prev)}
                      className="p-1 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                      aria-label="Suche und Filter öffnen"
                    >
                      <Search className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: heroProgressPercent + '%',
                      backgroundColor: activeBackgroundColor || 'rgb(34, 197, 94)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Suche & Filter (per Icon ein- und ausblendbar) */}
          <SearchFilterPanel
            visible={filtersOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            filters={filters}
            generaWithDiscovery={generaWithDiscovery}
            collectionQuests={collectionQuests}
            userCollectionQuests={userCollectionQuests}
          />

          {/* Collection Grid */}
          <div className="pt-1">
            {filteredGenera.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-200">
                  <Leaf className="w-12 h-12 text-stone-400" />
                </div>
                <h3 className="text-2xl font-bold text-stone-900 mb-2">
                  Keine Pflanzen gefunden
                </h3>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredGenera.map((genus) => (
                  <GenusCard
                    key={genus.id}
                    genus={genus}
                    onShowHint={handleShowHint}
                    userDiscoveries={userDiscoveries}
                    plants={plants}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


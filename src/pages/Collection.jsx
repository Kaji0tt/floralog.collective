import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { createUserNotification, getUserDisplayName } from "@/api/notificationService";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Loader2, Leaf, Search, PencilLine } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import MobileBackButton from "../components/navigation/MobileBackButton";
import HintDialog from "../components/collection/HintDialog";
import SearchSortBar from "../components/collection/SearchSortBar";

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


export default function Collection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionSort, setCollectionSort] = useState("index");
  const [discoveredFilter, setDiscoveredFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState("global");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isQuestCollectionView = searchParams.get("from") === "quests" && !!searchParams.get("collectionId");

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const urlCollectionId = searchParams.get("collectionId");
    if (urlCollectionId && urlCollectionId !== selectedCollectionId) {
      setSelectedCollectionId(urlCollectionId);
      return;
    }
    if (!urlCollectionId && selectedCollectionId !== "global") {
      setSelectedCollectionId("global");
    }
  }, [searchParams, selectedCollectionId]);

  const handleCollectionChipSelect = (nextCollectionId) => {
    setSelectedCollectionId(nextCollectionId);

    const nextParams = new URLSearchParams(searchParams);
    if (nextCollectionId === "global") {
      nextParams.delete("collectionId");
      nextParams.delete("from");
    } else {
      nextParams.set("collectionId", nextCollectionId);
      nextParams.delete("from");
    }

    setSearchParams(nextParams, { replace: true });
  };

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

  const { data: userCollections = [] } = useQuery({
    queryKey: ["userCollections", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return Query.UserCollection.filter({ auth_id: user.id });
    },
    enabled: !!user?.id,
  });

  const { data: visibleCollections = [] } = useQuery({
    queryKey: ["visibleCollections"],
    queryFn: () => Query.Collection.list(),
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

  const followMutation = useMutation({
    mutationFn: async (collectionId) => {
      if (!user?.id) return null;
      return Query.UserCollection.create({
        auth_id: user.id,
        collection_id: collectionId,
      });
    },
    onSuccess: async (_data, collectionId) => {
      try {
        const collection = visibleCollections.find((c) => c.id === collectionId);
        if (collection && collection.auth_id && collection.auth_id !== user?.id) {
          const profiles = await Query.PublicProfile.list();
          const ownerProfile = profiles.find((p) => p.auth_id === collection.auth_id);
          const followerName = getUserDisplayName(user, user?.email);

          await createUserNotification({
            authId: collection.auth_id,
            userEmail: ownerProfile?.user_email,
            notificationType: "collection_followed",
            title: "👀 Neuer Kollektion-Follower",
            message: `${followerName} folgt jetzt deiner Kollektion!`,
            description: collection.title || "",
            actionUrl: `Collection?collectionId=${collection.id}`,
            displayLocation: "banner",
            createdBy: user?.email || "system",
          });
        }
      } catch (error) {
        console.error("[Collection] Could not create follow notification:", error);
      }

      queryClient.invalidateQueries({ queryKey: ["userCollections", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["visibleCollections"] });
      queryClient.invalidateQueries({ queryKey: ["allCollections"] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userCollectionId) => {
      return Query.UserCollection.delete(userCollectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCollections", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["visibleCollections"] });
      queryClient.invalidateQueries({ queryKey: ["allCollections"] });
    },
  });

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

    // Neueste Entdeckung pro Gattung
    const genusDiscoveries = userDiscoveries.filter(d =>
      genusPlants.some(p => p.id === d.plant_id)
    );
    const lastDiscoveryDate = genusDiscoveries.reduce((latest, d) => {
      const dateStr = d.created_date || d.discovered_date;
      if (!dateStr) return latest;
      const time = new Date(dateStr).getTime();
      return time > latest ? time : latest;
    }, 0);

    return {
      ...genus,
      discovered: discoveredSpecies.length > 0,
      discoveredCount: discoveredSpecies.length,
      totalSpecies: genusPlants.length,
      hasRareSpecies: maxRarityScore >= 2,
      maxRarityScore,
      lastDiscoveryDate,
    };
  }).sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
      return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
    }
    return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
  });

  const filters = [
    { value: "rarity", label: "Rarität (nur seltene)" },
  ];

  // Check if activeCategory is a collection quest ID
  const isCollectionFilter = activeCategory.startsWith('collection_');
  const collectionId = isCollectionFilter ? activeCategory.replace('collection_', '') : null;
  
  const followedCollections = visibleCollections.filter((c) =>
    c.is_public &&
    c.auth_id !== user?.id &&
    userCollections.some((uc) => uc.collection_id === c.id)
  );

  const collectionsById = new Map();
  [
    ...visibleCollections,
    ...ownedCollections,
    ...followedCollections,
  ].forEach((c) => {
    if (!collectionsById.has(c.id)) {
      collectionsById.set(c.id, c);
    }
  });

  const selectedCollection =
    selectedCollectionId !== 'global'
      ? collectionsById.get(selectedCollectionId) || null
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
    if (discoveredFilter === "undiscovered") {
      filteredGenera = filteredGenera.filter(g => !g.discovered);
    } else if (discoveredFilter === "discovered") {
      filteredGenera = filteredGenera.filter(g => g.discovered);
    }

    if (activeCategory === "rarity") {
      filteredGenera = filteredGenera.filter(g => g.hasRareSpecies);
    }
    // "Alle" zeigt einfach alle Gattungen ohne zusätzlichen Filter
  }
  
  // Falls eine benutzerdefinierte Kollektion ausgewählt ist, auf deren Items einschränken
  let collectionNotesByGenusId = {};
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

      // Mappe optionale Kollektions-Notizen pro Gattung
      const notesMap = {};
      itemsForSelected.forEach((item) => {
        let targetGenusId = item.genus_id;
        if (!targetGenusId && item.plant_id) {
          const plant = plants.find((p) => p.id === item.plant_id);
          if (plant) {
            const genus = genera.find(
              (g) =>
                g.category === plant.genus_category &&
                g.category_dex_number === plant.genus_number
            );
            if (genus) {
              targetGenusId = genus.id;
            }
          }
        }
        if (targetGenusId && item.note && !notesMap[targetGenusId]) {
          notesMap[targetGenusId] = item.note;
        }
      });

      collectionNotesByGenusId = notesMap;

      filteredGenera = filteredGenera.filter((g) => genusIds.has(g.id)).map((g) => ({
        ...g,
        collectionNote: collectionNotesByGenusId[g.id] || null,
      }));
    }
  } else {
    // Keine spezielle Kollektion: Notiz-Feld zurücksetzen
    filteredGenera = filteredGenera.map((g) => ({ ...g, collectionNote: null }));
  }

  filteredGenera = filteredGenera.filter(g => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return g.genus_name?.toLowerCase().includes(query) ||
           g.scientific_genus?.toLowerCase().includes(query);
  });

  // Sortierung innerhalb der aktuellen Auswahl
  let sortedGenera = [...filteredGenera];
  if (collectionSort === "newest") {
    sortedGenera.sort((a, b) => (b.lastDiscoveryDate || 0) - (a.lastDiscoveryDate || 0));
  } else if (collectionSort === "title") {
    sortedGenera.sort((a, b) => (a.genus_name || "").localeCompare(b.genus_name || "", "de"));
  } else if (collectionSort === "rarity") {
    sortedGenera.sort((a, b) => (b.maxRarityScore || 0) - (a.maxRarityScore || 0));
  } else if (collectionSort === "index") {
    const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
    sortedGenera.sort((a, b) => {
      if (a.category !== b.category) {
        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
      }
      return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
    });
  }

  const discoveredCount = sortedGenera.filter(g => g.discovered).length;
  const totalCount = sortedGenera.length;

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

  const activeBackgroundColor = selectedCollection?.background_color || (isQuestCollectionView ? null : averageColor);
  const heroStats = getCollectionStats(selectedCollection ? selectedCollection.id : 'global');
  const heroProgressPercent = heroStats.total
    ? Math.round((heroStats.discovered / heroStats.total) * 100)
    : 0;

  const ownerName = user?.display_name || user?.full_name || "Dein";
  const heroTitle = selectedCollection
    ? selectedCollection.title
    : ownerName + "'s Floralog";
  const listTopFadePx = 12;
  const chipRightFadePx = 24;
  const isOwnerOfSelected =
    !!selectedCollection && !!user?.id && selectedCollection.auth_id === user.id;
  const userCollectionLinkForSelected = selectedCollection
    ? userCollections.find((uc) => uc.collection_id === selectedCollection.id)
    : null;
  const isFollowingSelected = !!userCollectionLinkForSelected && !isOwnerOfSelected;

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
      <div className="h-screen p-4 md:p-8 overflow-hidden">
        <MobileBackButton />

        <HintDialog
          genus={selectedGenus}
          isOpen={showHintDialog}
          onClose={() => setShowHintDialog(false)}
        />

        <div className="max-w-7xl mx-auto h-full pt-0 flex flex-col gap-3">
          <div className="shrink-0 space-y-3">
            {/* Horizontale Kollektionen-Chips + Neuerstellen-Button */}
            {!isQuestCollectionView && (
            <div className="relative flex items-center gap-2">
              <div
                className="-mx-4 px-4 pb-0 flex-1 flex gap-2 overflow-x-auto scrollbar-hide pr-6"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to right, black 0px, black calc(100% - " +
                    chipRightFadePx +
                    "px), transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, black 0px, black calc(100% - " +
                    chipRightFadePx +
                    "px), transparent 100%)",
                }}
              >
                {(() => {
                  const followedCollectionsChips = followedCollections.map((c) => ({
                    id: c.id,
                    title: c.title,
                    isGlobal: false,
                    isFollowed: true,
                  }));

                  const all = [
                    { id: 'global', title: 'Global', isGlobal: true },
                    ...ownedCollections.map((c) => ({ id: c.id, title: c.title, isGlobal: false })),
                    ...followedCollectionsChips,
                  ];

                  return all.map((col) => {
                    const stats = getCollectionStats(col.id === 'global' ? 'global' : col.id);
                    const isActive = selectedCollectionId === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => handleCollectionChipSelect(col.id)}
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

              <button
                type="button"
                onClick={() => navigate("/CollectionEditor")}
                className="shrink-0 w-8 h-8 rounded-full bg-white/80 border border-stone-300 text-stone-700 flex items-center justify-center shadow-sm hover:bg-white hover:border-stone-400 transition-colors"
                aria-label="Neue Kollektion anlegen"
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
            )}

            {/* Hero-Kachel */}
            <div
              className="bg-white/80 rounded-2xl border shadow-sm p-3 flex flex-col gap-3"
              style={{
                borderColor: activeBackgroundColor || 'rgba(148, 163, 184, 0.35)',
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-lg font-bold text-stone-900 leading-tight flex-1 min-w-0 truncate">
                    {heroTitle}
                  </h1>
                  {selectedCollection && !isQuestCollectionView && (
                    <div className="shrink-0 flex items-center gap-1.5">
                      {selectedCollection.is_public && !isOwnerOfSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isFollowingSelected && userCollectionLinkForSelected) {
                              unfollowMutation.mutate(userCollectionLinkForSelected.id);
                            } else if (!isFollowingSelected) {
                              followMutation.mutate(selectedCollection.id);
                            }
                          }}
                          disabled={followMutation.isPending || unfollowMutation.isPending}
                          className="px-2 py-1 rounded-full text-[11px] border border-emerald-500/60 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          {isFollowingSelected ? "Abo beenden" : "Abonnieren"}
                        </button>
                      )}

                      {isOwnerOfSelected && (
                        <button
                          type="button"
                          onClick={() => navigate("/CollectionEditor?id=" + selectedCollection.id)}
                          className="shrink-0 p-1.5 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800 border border-stone-200 transition-colors"
                          aria-label="Kollektion bearbeiten"
                        >
                          <PencilLine className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
            {filtersOpen && (
              <div className="space-y-2">
                <SearchSortBar
                  placeholder="Gattungen durchsuchen..."
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  sortOptions={[
                    { value: "index", label: "Index" },
                    { value: "newest", label: "Neu" },
                    { value: "title", label: "Titel" },
                    { value: "rarity", label: "Rarität" },
                  ]}
                  sortValue={collectionSort}
                  onSortChange={setCollectionSort}
                  initialOpen
                  showDiscoveredToggle
                  discoveredFilter={discoveredFilter}
                  onDiscoveredFilterChange={setDiscoveredFilter}
                />
              </div>
            )}
          </div>

          {/* Collection Grid */}
          <div
            className="relative flex-1 min-h-0 overflow-y-auto pb-20"
            style={{
              WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
              maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
            }}
          >
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" style={{ paddingTop: listTopFadePx }}>
                {sortedGenera.map((genus) => (
                  <GenusCard
                    key={genus.id}
                    genus={genus}
                    onShowHint={handleShowHint}
                    userDiscoveries={userDiscoveries}
                    plants={plants}
                    friendEmail={null}
                    collectionNote={genus.collectionNote}
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


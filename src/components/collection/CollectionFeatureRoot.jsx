import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { createUserNotification, getUserDisplayName } from "@/api/notificationService";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Home, List, Leaf } from "lucide-react";
import HintDialog from "./HintDialog";
import CollectionScreen from "./CollectionScreen";
import PublicCollectionScreen from "./PublicCollectionScreen";
import HomeShellLoader from "../navigation/HomeShellLoader";
import useCollectionViewState, { DEFAULT_COLLECTION_FILTERS } from "./hooks/useCollectionViewState";

const CATEGORY_CHIPS = [
  { value: "Bäume", emoji: "🌳" },
  { value: "Sträucher", emoji: "🌿" },
  { value: "Blumen", emoji: "🌸" },
];

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
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

export default function CollectionFeatureRoot({
  embedded = false,
  onRequestClose = null,
  uiTheme,
  initialCollectionId = "global",
  onSelectedCollectionIdChange = null,
  showPublicCollectionsPanel: externalShowPublicCollectionsPanel,
  onShowPublicCollectionsPanelChange = null,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [showPublicCollectionsPanelState, setShowPublicCollectionsPanelState] = useState(false);
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [communitySort, setCommunitySort] = useState("newest");
  const isRouteMode = !embedded;
  const isQuestCollectionView =
    isRouteMode && searchParams.get("from") === "quests" && !!searchParams.get("collectionId");
  const [resolvedUiTheme, setResolvedUiTheme] = useState(() => {
    if (uiTheme === "light" || uiTheme === "dark") return uiTheme;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("home-ui-theme");
      if (stored === "light" || stored === "dark") return stored;
    }
    return "dark";
  });
  const isLightUi = resolvedUiTheme === "light";
  const showPublicCollectionsPanel =
    typeof externalShowPublicCollectionsPanel === "boolean"
      ? externalShowPublicCollectionsPanel
      : showPublicCollectionsPanelState;

  const setPublicCollectionsPanelOpen = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(showPublicCollectionsPanel)
        : nextOrUpdater;

    if (typeof externalShowPublicCollectionsPanel !== "boolean") {
      setShowPublicCollectionsPanelState(Boolean(nextValue));
    }

    if (typeof onShowPublicCollectionsPanelChange === "function") {
      onShowPublicCollectionsPanelChange(Boolean(nextValue));
    }
  };

  useEffect(() => {
    if (uiTheme === "light" || uiTheme === "dark") {
      setResolvedUiTheme(uiTheme);
    }
  }, [uiTheme]);

  const {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    collectionSort,
    setCollectionSort,
    discoveredFilter,
    setDiscoveredFilter,
    selectedCollectionId,
    setSelectedCollectionId,
    sortChipsOpen,
    setSortChipsOpen,
    filterSettingsByCollection,
    saveFiltersForCollection,
    handleCollectionChipSelect,
    listScrollContainerRef,
    handleCollectionListScroll,
    restoreScrollForCollection,
  } = useCollectionViewState({
    initialCollectionId,
    onSelectedCollectionIdChange,
    isRouteMode,
    searchParams,
    setSearchParams,
  });

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

  const { data: currentUser = null } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
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

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["collectionPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
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
          console.info('[Collection] Follow detected, creating notification', {
            collectionId,
            ownerAuthId: collection.auth_id,
            followerAuthId: user?.id,
            followerEmail: user?.email,
          });

          const profiles = await Query.PublicProfile.list();
          const ownerProfile = profiles.find((p) => p.auth_id === collection.auth_id);
          const followerName = getUserDisplayName(user, user?.email);

          const createdNotification = await createUserNotification({
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

          console.info('[Collection] Notification created for follow event', {
            notificationId: createdNotification?.id,
            targetEmail: ownerProfile?.user_email,
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

  const rarityOrder = { "Häufig": 1, "Gelegentlich": 2, "Selten": 3, "Sehr Selten": 4, "Extrem Selten": 5 };

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

  // Check if activeCategory is a collection quest ID
  const isCollectionFilter = typeof activeCategory === "string" && activeCategory.startsWith('collection_');
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

    if (CATEGORY_CHIPS.some((chip) => chip.value === activeCategory)) {
      const matchingGenusKeys = new Set(
        plants
          .filter((plant) => plant.genus_category === activeCategory)
          .map((plant) => `${plant.genus_category}::${plant.genus_number}`)
      );
      filteredGenera = filteredGenera.filter((g) =>
        matchingGenusKeys.has(`${g.category}::${g.category_dex_number}`)
      );
    }
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
    if (g.genus_name?.toLowerCase().includes(query) ||
        g.scientific_genus?.toLowerCase().includes(query)) {
      return true;
    }
    return plants.some(p =>
      p.genus_category === g.category &&
      p.genus_number === g.category_dex_number &&
      (p.species_name?.toLowerCase().includes(query) ||
       p.scientific_name?.toLowerCase().includes(query))
    );
  });

  // Sortierung innerhalb der aktuellen Auswahl
  let sortedGenera = [...filteredGenera];
  if (collectionSort === "newest") {
    sortedGenera.sort((a, b) => (b.lastDiscoveryDate || 0) - (a.lastDiscoveryDate || 0));
  } else if (collectionSort === "title") {
    sortedGenera.sort((a, b) => (a.genus_name || "").localeCompare(b.genus_name || "", "de"));
  } else if (collectionSort === "rarity") {
    sortedGenera.sort((a, b) => {
      const rarityDiff = (b.maxRarityScore || 0) - (a.maxRarityScore || 0);
      if (rarityDiff !== 0) return rarityDiff;
      return (a.genus_name || "").localeCompare(b.genus_name || "", "de");
    });
  } else if (collectionSort === "index") {
    const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
    sortedGenera.sort((a, b) => {
      if (a.category !== b.category) {
        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
      }
      return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
    });
  }

  useEffect(() => {
    restoreScrollForCollection(selectedCollectionId);
  }, [selectedCollectionId, sortedGenera.length, restoreScrollForCollection]);

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
      embedded ? (
        <div className="flex h-full min-h-0 items-center justify-center bg-transparent">
          <Leaf className="w-12 h-12 animate-spin text-[#f0e5a5]" />
        </div>
      ) : (
        <HomeShellLoader
          backgroundImageUrl={user?.background_image_url || null}
          backgroundColor={user?.background_color || null}
          showProfileCard
        />
      )
    );
  }

  const getRgbaFromRgb = (rgbString, opacity) => {
    if (!rgbString) return null;
    const safeOpacity = (typeof opacity === "number" && opacity >= 0 && opacity <= 1) ? opacity : 1;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${safeOpacity})`;
  };

  const getLighterColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
    const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
    const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
    return "rgb(" + r + ", " + g + ", " + b + ")";
  };

  const activeBackgroundColor = isQuestCollectionView ? null : averageColor;
  const pageShellBackgroundStyle = user?.background_image_url
    ? {
      backgroundImage: `url(${user.background_image_url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
    : user?.background_color
      ? {
        background: `linear-gradient(160deg, ${getRgbaFromRgb(user.background_color, 1)} 0%, ${getRgbaFromRgb(user.background_color, 0.55)} 100%)`,
      }
      : {
        background: "radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)",
      };

  const heroStats = getCollectionStats(selectedCollection ? selectedCollection.id : 'global');
  const heroProgressPercent = heroStats.total
    ? Math.round((heroStats.discovered / heroStats.total) * 100)
    : 0;

  const ownerName = user?.display_name || user?.full_name || "Dein";
  const heroTitle = selectedCollection
    ? selectedCollection.title
    : ownerName + "'s Floralog";
  const listTopFadePx = 12;
  const listBottomFadePx = 18;
  const isOwnerOfSelected =
    !!selectedCollection && !!user?.id && selectedCollection.auth_id === user.id;
  const userCollectionLinkForSelected = selectedCollection
    ? userCollections.find((uc) => uc.collection_id === selectedCollection.id)
    : null;
  const isFollowingSelected = !!userCollectionLinkForSelected && !isOwnerOfSelected;
  const selectedCollectionKey = selectedCollectionId || "global";
  const selectedCollectionFilters = {
    ...DEFAULT_COLLECTION_FILTERS,
    ...(filterSettingsByCollection[selectedCollectionKey] || {}),
  };
  const allPublicCollections = (visibleCollections || []).filter((c) => c.is_public);
  const collectionItemsByCollectionId = (allCollectionItems || []).reduce((acc, item) => {
    if (!item?.collection_id) return acc;
    if (!acc[item.collection_id]) acc[item.collection_id] = [];
    acc[item.collection_id].push(item);
    return acc;
  }, {});
  const discoveredPlantIds = new Set(
    (userDiscoveries || []).map((d) => d.plant_id).filter(Boolean)
  );
  const publicCollectionsWithMeta = allPublicCollections.map((c) => {
    const ownerProfile = (publicProfiles || []).find((p) => p.auth_id === c.auth_id);
    const ownerNameForCard =
      ownerProfile?.display_name ||
      ownerProfile?.full_name ||
      ownerProfile?.user_email ||
      "Unbekannt";

    const itemsForCollection = collectionItemsByCollectionId[c.id] || [];
    const totalRequired = itemsForCollection.length;
    let discoveredRequired = 0;

    itemsForCollection.forEach((item) => {
      let isDiscovered = false;

      if (item.plant_id) {
        isDiscovered = discoveredPlantIds.has(item.plant_id);
      } else if (item.genus_id) {
        const targetGenus = (genera || []).find((g) => g.id === item.genus_id);
        if (targetGenus) {
          isDiscovered = (plants || []).some(
            (p) =>
              p.genus_category === targetGenus.category &&
              p.genus_number === targetGenus.category_dex_number &&
              discoveredPlantIds.has(p.id)
          );
        }
      }

      if (isDiscovered) discoveredRequired += 1;
    });

    const isOwnCollection = !!user?.id && c.auth_id === user.id;
    const userCollectionLink = userCollections.find((uc) => uc.collection_id === c.id) || null;
    const isFollowing = !!userCollectionLink && !isOwnCollection;

    return {
      ...c,
      ownerNameForCard,
      itemsCount: totalRequired,
      followersCount: c.followers_count ?? 0,
      progress: {
        discovered: discoveredRequired,
        total: totalRequired,
      },
      isOwnCollection,
      userCollectionLink,
      isFollowing,
    };
  });

  const normalizedCommunitySearch = communitySearchQuery.trim().toLowerCase();
  let filteredPublicCollections = [...publicCollectionsWithMeta];
  if (normalizedCommunitySearch) {
    filteredPublicCollections = filteredPublicCollections.filter((c) => {
      const inTitle = (c.title || "").toLowerCase().includes(normalizedCommunitySearch);
      const inDesc = (c.description || "").toLowerCase().includes(normalizedCommunitySearch);
      const inOwner = (c.ownerNameForCard || "").toLowerCase().includes(normalizedCommunitySearch);
      return inTitle || inDesc || inOwner;
    });
  }
  if (communitySort === "title") {
    filteredPublicCollections.sort((a, b) => (a.title || "").localeCompare(b.title || "", "de"));
  } else if (communitySort === "followers") {
    filteredPublicCollections.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));
  } else if (communitySort === "items") {
    filteredPublicCollections.sort((a, b) => (b.itemsCount || 0) - (a.itemsCount || 0));
  } else {
    filteredPublicCollections.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }
  const followedPublicCollections = filteredPublicCollections.filter((c) => c.isFollowing);
  const discoverablePublicCollections = filteredPublicCollections.filter((c) => !c.isFollowing);
  const isHeroSegmentOpen = selectedCollectionFilters.heroSegmentOpen !== false;
  const isCollectionTogglePending = followMutation.isPending || unfollowMutation.isPending;
  const handleOpenPublicCollection = (collectionId) => {
    setPublicCollectionsPanelOpen(false);
    setSelectedCollectionId(collectionId);
    if (typeof onSelectedCollectionIdChange === "function") {
      onSelectedCollectionIdChange(collectionId);
    }
    if (!isRouteMode) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("collectionId", collectionId);
    nextParams.delete("from");
    setSearchParams(nextParams, { replace: true });
  };

  const handlePublicCollectionFollowToggle = (collectionEntry) => {
    if (collectionEntry.isFollowing && collectionEntry.userCollectionLink) {
      unfollowMutation.mutate(collectionEntry.userCollectionLink.id);
      return;
    }
    if (!collectionEntry.isFollowing) {
      followMutation.mutate(collectionEntry.id);
    }
  };

  const handleBack = () => {
    if (embedded && typeof onRequestClose === "function") {
      onRequestClose();
      return;
    }
    navigate(createPageUrl("Home"));
  };

  return (
    <div className={embedded ? "h-full min-h-0" : "fixed inset-0 overflow-hidden"} data-ui={embedded ? "collection-embedded-root" : "home-page-shell"}>
      {!embedded && <div className="absolute inset-0" style={pageShellBackgroundStyle} />}
      {!embedded && <div className="absolute inset-0 backdrop-blur-3xl" />}
      {!embedded && <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/55" />}

      <div className={embedded ? "h-full w-full" : "relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center"}>
        <div className={embedded ? "h-full w-full" : "relative h-[calc(100%-1.50rem)] md:h-[calc(100%-1.50rem)] w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"}>
          {!embedded && (
            <div
              className="absolute inset-0"
              style={user?.background_image_url ? {
                backgroundImage: `linear-gradient(180deg, rgba(19,37,24,0.42) 0%, rgba(12,20,15,0.66) 100%), url(${user.background_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              } : user?.background_color ? {
                background: `linear-gradient(180deg, ${getRgbaFromRgb(user.background_color, 0.28)} 0%, rgba(14, 22, 16, 0.74) 100%)`,
              } : {
                background: "linear-gradient(180deg, rgba(126, 171, 98, 0.45) 0%, rgba(10, 22, 15, 0.78) 100%)",
              }}
            />
          )}
          {!embedded && <div className="absolute inset-0 border border-[#f0e5a5]/30 pointer-events-none rounded-[2rem]" />}

          <div className={embedded ? "h-full flex flex-col text-stone-100" : "relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 text-stone-100"}>
            {!embedded && (
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#f0e5a5]/20" data-ui="home-header-bar">
                <div className="min-w-0">
                  <h1 className="font-bold leading-tight text-2xl md:text-3xl">Kollektionen</h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPublicCollectionsPanelOpen((prev) => !prev)}
                    className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors shrink-0"
                    aria-label={showPublicCollectionsPanel ? "Öffentliche Kollektionen schließen" : "Öffentliche Kollektionen anzeigen"}
                    aria-pressed={showPublicCollectionsPanel}
                  >
                    <List className="w-5 h-5 text-[#f0e5a5]" />
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors shrink-0"
                    aria-label="Zur Home Seite"
                  >
                    <Home className="w-5 h-5 text-[#f0e5a5]" />
                  </button>
                </div>
              </div>
            )}

            <HintDialog
              genus={selectedGenus}
              isOpen={showHintDialog}
              onClose={() => setShowHintDialog(false)}
              isLightUi={isLightUi}
            />

            <div className="flex-1 min-h-0 py-[clamp(0.5rem,1.5vh,1rem)] flex flex-col gap-3" data-ui={embedded ? "collection-content-stack" : "home-content-stack"}>
          {showPublicCollectionsPanel ? (
            <PublicCollectionScreen
              isLightUi={isLightUi}
              uiTheme={resolvedUiTheme}
              listTopFadePx={listTopFadePx}
              listBottomFadePx={listBottomFadePx}
              allPublicCollections={allPublicCollections}
              followedPublicCollections={followedPublicCollections}
              discoverablePublicCollections={discoverablePublicCollections}
              searchQuery={communitySearchQuery}
              onSearchQueryChange={setCommunitySearchQuery}
              sortValue={communitySort}
              onSortChange={setCommunitySort}
              onOpenCollection={handleOpenPublicCollection}
              onToggleFollow={handlePublicCollectionFollowToggle}
              isCollectionTogglePending={isCollectionTogglePending}
              onCreateCollection={() => navigate("/CollectionEditor")}
            />
          ) : (
            <CollectionScreen
              isQuestCollectionView={isQuestCollectionView}
              ownedCollections={ownedCollections}
              followedCollections={followedCollections}
              getCollectionStats={getCollectionStats}
              selectedCollectionId={selectedCollectionId}
              onCollectionChipSelect={handleCollectionChipSelect}
              isLightUi={isLightUi}
              onCreateCollection={() => navigate("/CollectionEditor")}
              isHeroSegmentOpen={isHeroSegmentOpen}
              heroTitle={heroTitle}
              selectedCollection={selectedCollection}
              isOwnerOfSelected={isOwnerOfSelected}
              isFollowingSelected={isFollowingSelected}
              userCollectionLinkForSelected={userCollectionLinkForSelected}
              onUnfollow={(userCollectionId) => unfollowMutation.mutate(userCollectionId)}
              onFollow={(collectionId) => followMutation.mutate(collectionId)}
              isFollowLoading={followMutation.isPending || unfollowMutation.isPending}
              onEditCollection={(collectionId) => navigate("/CollectionEditor?id=" + collectionId)}
              heroStats={heroStats}
              heroProgressPercent={heroProgressPercent}
              activeCategory={activeCategory}
              onSetActiveCategory={(nextCategory) => {
                setActiveCategory(nextCategory);
                saveFiltersForCollection(selectedCollectionId, { activeCategory: nextCategory });
              }}
              sortChipsOpen={sortChipsOpen}
              onSetSortChipsOpen={(next) => {
                setSortChipsOpen(next);
                saveFiltersForCollection(selectedCollectionId, { sortChipsOpen: next });
              }}
              activeBackgroundColor={activeBackgroundColor}
              getLighterColor={getLighterColor}
              searchQuery={searchQuery}
              onSearchQueryChange={(nextQuery) => {
                setSearchQuery(nextQuery);
                saveFiltersForCollection(selectedCollectionId, { searchQuery: nextQuery });
              }}
              collectionSort={collectionSort}
              onCollectionSortChange={(nextSort) => {
                setCollectionSort(nextSort);
                saveFiltersForCollection(selectedCollectionId, { collectionSort: nextSort });
              }}
              discoveredFilter={discoveredFilter}
              onDiscoveredFilterChange={(nextFilter) => {
                setDiscoveredFilter(nextFilter);
                saveFiltersForCollection(selectedCollectionId, { discoveredFilter: nextFilter });
              }}
              listScrollContainerRef={listScrollContainerRef}
              onCollectionListScroll={handleCollectionListScroll}
              listTopFadePx={listTopFadePx}
              listBottomFadePx={listBottomFadePx}
              filteredGenera={filteredGenera}
              sortedGenera={sortedGenera}
              onShowHint={handleShowHint}
              userDiscoveries={userDiscoveries}
              plants={plants}
              currentUser={currentUser}
              uiTheme={resolvedUiTheme}
            />
          )}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}


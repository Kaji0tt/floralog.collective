import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { createUserNotification, getUserDisplayName } from "@/api/notificationService";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Home, List, Leaf, Compass, Plus, Users, Sun } from "lucide-react";
import HintDialog from "./HintDialog";
import CollectionScreen from "./CollectionScreen";
import CollectionCategoryEntryCard from "./CollectionCategoryEntryCard";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";
import HomeShellLoader from "../navigation/HomeShellLoader";
import useCollectionViewState, { DEFAULT_COLLECTION_FILTERS } from "./hooks/useCollectionViewState";
import { useUiTheme } from "@/lib/UiThemeContext";
import { getActiveSeason } from "@/lib/seasonConfig";

const CATEGORY_CHIPS = [
  { value: "Bäume", emoji: "🌳" },
  { value: "Sträucher", emoji: "🌿" },
  { value: "Blumen", emoji: "🌸" },
];

const isMissingFavoriteColumnError = (error) => {
  if (!error) return false;
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  return (
    message.includes("is_favorite") ||
    details.includes("is_favorite") ||
    hint.includes("is_favorite")
  );
};

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
  initialCollectionId = "global",
  onSelectedCollectionIdChange = null,
  entryCategory: externalEntryCategory,
  onEntryCategoryChange = null,
  showPublicCollectionsPanel: externalShowPublicCollectionsPanel,
  onShowPublicCollectionsPanelChange = null,
  profileUser = null,
  friendEmail = "",
  readOnly = false,
}) {
  const { isLightUi, uiTheme, pushThemeOverride, popThemeOverride } = useUiTheme();
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
  const [globalSubPickerDismissed, setGlobalSubPickerDismissed] = useState(false);
  const [favoriteColumnUnavailable, setFavoriteColumnUnavailable] = useState(false);
  const isRouteMode = !embedded;
  const isQuestCollectionView =
    isRouteMode && searchParams.get("from") === "quests" && !!searchParams.get("collectionId");
  const routeCollectionId = isRouteMode ? searchParams.get("collectionId") : null;
  const initialEntryCategory = isQuestCollectionView
    ? "global"
    : routeCollectionId
      ? (routeCollectionId === "global" ? "global" : "themes")
      : (embedded ? null : "global");
  const [selectedEntryCategoryState, setSelectedEntryCategoryState] = useState(initialEntryCategory);
  const selectedEntryCategory =
    typeof externalEntryCategory === "undefined"
      ? selectedEntryCategoryState
      : externalEntryCategory;
  const showPublicCollectionsPanel =
    typeof externalShowPublicCollectionsPanel === "boolean"
      ? externalShowPublicCollectionsPanel
      : showPublicCollectionsPanelState;

  useEffect(() => {
    if (!showPublicCollectionsPanel) return;
    setEntryCategory("browse");
  }, [showPublicCollectionsPanel]);

  const setEntryCategory = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(selectedEntryCategory)
        : nextOrUpdater;

    if (typeof externalEntryCategory === "undefined") {
      setSelectedEntryCategoryState(nextValue);
    }

    if (typeof onEntryCategoryChange === "function") {
      onEntryCategoryChange(nextValue);
    }
  };

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

  const targetUser = profileUser || user;
  const targetUserId = targetUser?.auth_id || targetUser?.id || null;
  const resolvedFriendEmail =
    (friendEmail || targetUser?.user_email || "").toString().trim();

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  const { data: visibleCollections = [] } = useQuery({
    queryKey: ["visibleCollections"],
    queryFn: () => Query.Collection.list(),
  });

  const selectedDiscoveryAuthId = targetUserId;

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries', selectedDiscoveryAuthId],
    queryFn: async () => {
      if (!selectedDiscoveryAuthId) {
        return [];
      }
      return Query.UserPlantDiscovery.filter({ auth_id: selectedDiscoveryAuthId });
    },
    enabled: !!selectedDiscoveryAuthId,
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list(),
  });

  const { data: userCollections = [] } = useQuery({
    queryKey: ["userCollections", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      return Query.UserCollection.filter({ auth_id: targetUserId });
    },
    enabled: !!targetUserId,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["collectionPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
  });

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
  });

  const { data: ownedCollections = [] } = useQuery({
    queryKey: ['ownedCollections', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      return Query.Collection.filter({ auth_id: targetUserId });
    },
    enabled: !!targetUserId,
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
            title: "🤖 Florabot meldet: Neue Verbindung!",
            message: `${followerName} folgt jetzt deiner Kollektion. Deine Daten sind wertvoll für das Netzwerk!`,
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

      queryClient.invalidateQueries({ queryKey: ["userCollections", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["visibleCollections"] });
      queryClient.invalidateQueries({ queryKey: ["allCollections"] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userCollectionId) => {
      return Query.UserCollection.delete(userCollectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCollections", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["visibleCollections"] });
      queryClient.invalidateQueries({ queryKey: ["allCollections"] });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ userCollectionId, isFavorite }) => {
      if (!userCollectionId) return null;
      return Query.UserCollection.update(userCollectionId, { is_favorite: Boolean(isFavorite) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCollections", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["visibleCollections"] });
      queryClient.invalidateQueries({ queryKey: ["allCollections"] });
    },
    onError: (error) => {
      // NOTE(backport): If the official server runs an older schema without
      // public."UserCollection".is_favorite, this mutation fails. Apply the
      // matching Supabase migration first, then re-enable this toggle.
      if (isMissingFavoriteColumnError(error)) {
        setFavoriteColumnUnavailable(true);
        console.warn(
          '[Collection] Favorite toggle disabled because column public."UserCollection".is_favorite is missing. Please apply the favorite migration on the target backend.'
        );
        return;
      }
      console.error("[Collection] Could not toggle collection favorite:", error);
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
    const normalizeCategory = (cat) => cat === "Blumen & Kräuter" ? "Blumen" : cat;
    const normA = normalizeCategory(a.category);
    const normB = normalizeCategory(b.category);
    if (normA !== normB) {
      const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
      return (categoryOrder[normA] || 999) - (categoryOrder[normB] || 999);
    }
    return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
  });

  // Check if activeCategory is a collection quest ID
  const isCollectionFilter = typeof activeCategory === "string" && activeCategory.startsWith('collection_');
  const collectionId = isCollectionFilter ? activeCategory.replace('collection_', '') : null;
  
  const followedCollections = visibleCollections
    .filter(
      (c) =>
        c.is_public &&
        c.auth_id !== targetUserId &&
        userCollections.some((uc) => uc.collection_id === c.id)
    )
    .map((collectionEntry) => {
      const userCollectionLink = userCollections.find((uc) => uc.collection_id === collectionEntry.id) || null;
      return {
        ...collectionEntry,
        userCollectionLink,
        // Backward-compatible: older backends may not return is_favorite yet.
        isFavorite: Boolean(userCollectionLink?.is_favorite),
      };
    });

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

  const uniqueThemeCollections = useMemo(() => {
    const map = new Map();
    [...ownedCollections, ...followedCollections].forEach((entry) => {
      if (entry?.id && !map.has(entry.id)) {
        map.set(entry.id, entry);
      }
    });
    return Array.from(map.values());
  }, [ownedCollections, followedCollections]);

  const collectionChips = useMemo(() => {
    if (selectedEntryCategory === "global") {
      if (selectedCollectionId === "season") {
        return [{ id: "season", title: "☀️ Sommer 2026", isGlobal: false, isFollowed: false, isSeason: true }];
      }
      return [{ id: "global", title: "Global", isGlobal: true, isFollowed: false }];
    }

    if (selectedEntryCategory === "themes") {
      return uniqueThemeCollections.map((entry) => ({
        id: entry.id,
        title: entry.title,
        isGlobal: false,
        isFollowed: followedCollections.some((followed) => followed.id === entry.id),
        isFavorite: Boolean(entry?.isFavorite),
      }));
    }

    return [];
  }, [selectedEntryCategory, selectedCollectionId, uniqueThemeCollections, followedCollections]);

  const selectedEntryCategoryLabel =
    selectedEntryCategory === "global"
      ? (selectedCollectionId === "season" ? (getActiveSeason()?.title || "Saison") : "Globale")
      : selectedEntryCategory === "themes"
        ? "Themen"
        : selectedEntryCategory === "shared"
          ? "Gemeinsame"
          : null;

  const isCategoryLandingVisible =
    !isQuestCollectionView &&
    selectedEntryCategory !== "browse" &&
    !selectedEntryCategory;

  useEffect(() => {
    if (selectedEntryCategory !== "themes") return;
    if (!collectionChips.length) return;
    if (!collectionChips.some((chip) => chip.id === selectedCollectionId)) {
      handleCollectionChipSelect(collectionChips[0].id);
    }
  }, [selectedEntryCategory, collectionChips, selectedCollectionId, handleCollectionChipSelect]);

  const selectedCollectionOwnerProfile = selectedCollection
    ? (publicProfiles || []).find((p) => p.auth_id === selectedCollection.auth_id) || null
    : null;
  const selectedCollectionOwnerTheme =
    selectedCollectionOwnerProfile?.ui_theme === "light" ? "light" : "dark";
  const shouldUseSelectedOwnerTheme =
    !!selectedCollection &&
    !!selectedCollection.is_public &&
    !!selectedCollection.auth_id &&
    !!targetUserId &&
    selectedCollection.auth_id !== targetUserId;

  useEffect(() => {
    if (!shouldUseSelectedOwnerTheme) return;
    pushThemeOverride(selectedCollectionOwnerTheme);
    return () => {
      popThemeOverride();
    };
  }, [
    shouldUseSelectedOwnerTheme,
    selectedCollectionOwnerTheme,
    selectedCollection?.id,
    pushThemeOverride,
    popThemeOverride,
  ]);

  const seasonCategoryStats = useMemo(() => {
    const season = getActiveSeason();
    if (!season) return { discovered: 0, total: 0, percent: 0 };
    const seasonDiscoveries = userDiscoveries.filter(
      (d) => d.discovered_date >= season.startDate
    );
    const seasonPlantIds = new Set(seasonDiscoveries.map((d) => d.plant_id));
    const seasonGenusKeys = new Set();
    plants.forEach((p) => {
      if (seasonPlantIds.has(p.id)) {
        seasonGenusKeys.add(`${p.genus_category}::${p.genus_number}`);
      }
    });
    const discovered = seasonGenusKeys.size;
    const total = generaWithDiscovery.length;
    const percent = total > 0 ? Math.round((discovered / total) * 100) : 0;
    return { discovered, total, percent };
  }, [userDiscoveries, plants, generaWithDiscovery]);

  const getCollectionStats = (collectionKey) => {
    if (!collectionKey || collectionKey === 'global') {
      const total = generaWithDiscovery.length;
      const discovered = generaWithDiscovery.filter((g) => g.discovered).length;
      return { discovered, total };
    }

    if (collectionKey === 'season') {
      return { discovered: seasonCategoryStats.discovered, total: seasonCategoryStats.total };
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

  if (selectedEntryCategory === "shared") {
    filteredGenera = [];
  }

  // Season filter: nur Gattungen mit Entdeckungen seit Season-Start zeigen
  if (selectedCollectionId === "season") {
    const season = getActiveSeason();
    if (season) {
      const seasonDiscoveries = userDiscoveries.filter(
        (d) => d.discovered_date >= season.startDate
      );
      const seasonPlantIds = new Set(seasonDiscoveries.map((d) => d.plant_id));
      const seasonGenusKeys = new Set();
      plants.forEach((p) => {
        if (seasonPlantIds.has(p.id)) {
          seasonGenusKeys.add(`${p.genus_category}::${p.genus_number}`);
        }
      });
      filteredGenera = filteredGenera.filter((g) =>
        seasonGenusKeys.has(`${g.category}::${g.category_dex_number}`)
      );
    } else {
      filteredGenera = [];
    }
  }

  if (selectedEntryCategory === "themes" && !selectedCollection) {
    filteredGenera = [];
  }
  
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
      const blumenEquivalents = activeCategory === "Blumen" ? ["Blumen", "Blumen & Kräuter"] : [activeCategory];
      const matchingGenusKeys = new Set(
        plants
          .filter((plant) => blumenEquivalents.includes(plant.genus_category))
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
    const backgroundSourceProfile = shouldUseSelectedOwnerTheme
      ? selectedCollectionOwnerProfile
      : targetUser;

    if (backgroundSourceProfile?.background_color) {
      setAverageColor(backgroundSourceProfile.background_color);
    } else if (backgroundSourceProfile?.background_image_url) {
      getAverageColor(backgroundSourceProfile.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [
    shouldUseSelectedOwnerTheme,
    selectedCollectionOwnerProfile?.background_color,
    selectedCollectionOwnerProfile?.background_image_url,
    targetUser?.background_image_url,
    targetUser?.background_color,
  ]);

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
      backgroundImage: `url(${targetUser.background_image_url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
    : targetUser?.background_color
      ? {
        background: `linear-gradient(160deg, ${getRgbaFromRgb(targetUser.background_color, 1)} 0%, ${getRgbaFromRgb(targetUser.background_color, 0.55)} 100%)`,
      }
      : {
        background: "radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)",
      };

  const heroStats = selectedEntryCategory === "shared"
    ? { discovered: 0, total: 0 }
    : getCollectionStats(selectedCollectionId === "season" ? "season" : (selectedCollection ? selectedCollection.id : 'global'));
  const heroProgressPercent = heroStats.total
    ? Math.round((heroStats.discovered / heroStats.total) * 100)
    : 0;

  const ownerName = targetUser?.display_name || targetUser?.full_name || "Dein";
  const heroTitle = selectedCollection
    ? selectedCollection.title
    : selectedCollectionId === "season"
      ? (getActiveSeason()?.title || "Saison")
      : selectedEntryCategory === "global"
        ? "Globale Kollektionen"
        : selectedEntryCategory === "themes"
          ? "Themen-Kollektionen"
          : selectedEntryCategory === "shared"
            ? "Gemeinsame Kollektionen"
            : ownerName + "'s Floralog";
  const listTopFadePx = 14;
  const listBottomFadePx = 14;
  const isOwnerOfSelected =
    !!selectedCollection && !!targetUserId && selectedCollection.auth_id === targetUserId;
  const userCollectionLinkForSelected = selectedCollection
    ? userCollections.find((uc) => uc.collection_id === selectedCollection.id)
    : null;
  const isFollowingSelected = !!userCollectionLinkForSelected && !isOwnerOfSelected;
  const isFavoriteSelected = Boolean(userCollectionLinkForSelected?.is_favorite);
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

    const isOwnCollection = !!targetUserId && c.auth_id === targetUserId;
    const userCollectionLink = userCollections.find((uc) => uc.collection_id === c.id) || null;
    const isFollowing = !!userCollectionLink && !isOwnCollection;

    return {
      ...c,
      ownerProfile,
      ownerNameForCard,
      ownerUiTheme: ownerProfile?.ui_theme || null,
      ownerBackgroundColor: ownerProfile?.background_color || c.background_color || null,
      ownerBackgroundImageUrl: ownerProfile?.background_image_url || null,
      itemsCount: totalRequired,
      followersCount: c.followers_count ?? 0,
      progress: {
        discovered: discoveredRequired,
        total: totalRequired,
      },
      isOwnCollection,
      userCollectionLink,
      isFollowing,
      isFavorite: Boolean(userCollectionLink?.is_favorite),
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

  const globalCategoryStats = useMemo(() => {
    const discovered = generaWithDiscovery.filter((entry) => entry.discovered).length;
    const total = generaWithDiscovery.length;
    const percent = total > 0 ? Math.round((discovered / total) * 100) : 0;
    return { discovered, total, percent };
  }, [generaWithDiscovery]);

  const followedThemeCollectionChips = useMemo(() => {
    const ranked = followedCollections
      .map((collectionEntry) => {
        const stats = getCollectionStats(collectionEntry.id);
        const total = stats.total || 0;
        const discovered = stats.discovered || 0;
        const remainingCount = Math.max(0, total - discovered);
        const remainingRatio = total > 0 ? remainingCount / total : Number.POSITIVE_INFINITY;

        return {
          title: collectionEntry.title || "Kollektion",
          discovered,
          total,
          remainingCount,
          remainingRatio,
          isFavorite: Boolean(collectionEntry?.isFavorite),
        };
      })
      .filter((entry) => entry.total > 0)
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) {
          return Number(b.isFavorite) - Number(a.isFavorite);
        }
        if (a.remainingRatio !== b.remainingRatio) {
          return a.remainingRatio - b.remainingRatio;
        }
        if (a.remainingCount !== b.remainingCount) {
          return a.remainingCount - b.remainingCount;
        }
        return (b.discovered || 0) - (a.discovered || 0);
      })
      .slice(0, 2);

    return ranked.map((entry) => `${entry.isFavorite ? "★ " : ""}${entry.title}: ${entry.discovered}/${entry.total}`);
  }, [followedCollections, getCollectionStats]);

  const browseCollectionCounts = useMemo(() => {
    const totalPublicCollections = allPublicCollections.length;
    const followedPublicCollections = publicCollectionsWithMeta.filter((entry) => entry.isFollowing).length;
    return { totalPublicCollections, followedPublicCollections };
  }, [allPublicCollections.length, publicCollectionsWithMeta]);

  const hasAdditionalCollections = (ownedCollections.length + followedCollections.length) > 0;
  const isHeroSegmentOpen = hasAdditionalCollections
    ? selectedCollectionFilters.heroSegmentOpen !== false
    : true;
  const handleOpenPublicCollection = (collectionId) => {
    setPublicCollectionsPanelOpen(false);
    setEntryCategory(collectionId === "global" ? "global" : "themes");
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
              style={targetUser?.background_image_url ? {
                backgroundImage: `linear-gradient(180deg, rgba(19,37,24,0.42) 0%, rgba(12,20,15,0.66) 100%), url(${targetUser.background_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              } : targetUser?.background_color ? {
                background: `linear-gradient(180deg, ${getRgbaFromRgb(targetUser.background_color, 0.28)} 0%, rgba(14, 22, 16, 0.74) 100%)`,
              } : {
                background: "linear-gradient(180deg, rgba(126, 171, 98, 0.45) 0%, rgba(10, 22, 15, 0.78) 100%)",
              }}
            />
          )}
          {!embedded && <div className="absolute inset-0 border border-[#f0e5a5]/30 pointer-events-none rounded-[2rem]" />}

          <div className={embedded ? "h-full flex flex-col text-stone-100" : "relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 text-stone-100"}>
            {!embedded && (
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#f0e5a5]/20" data-ui="home-header-bar">
                <div className="min-w-0 flex items-center gap-2">
                  {!isQuestCollectionView && selectedEntryCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEntryCategory(null);
                        setPublicCollectionsPanelOpen(false);
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.delete("collectionId");
                        nextParams.delete("from");
                        setSearchParams(nextParams, { replace: true });
                      }}
                      className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors shrink-0"
                      aria-label="Zur Kategorieauswahl"
                    >
                      <span className="text-[#f0e5a5] text-xl leading-none">‹</span>
                    </button>
                  )}
                  <h1 className="font-bold leading-tight text-2xl md:text-3xl">Kollektionen</h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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

            <div className="flex-1 min-h-0 pt-[clamp(0.5rem,1.5vh,1rem)] pb-[clamp(0.85rem,2.2vh,1.4rem)] flex flex-col gap-3" data-ui={embedded ? "collection-content-stack" : "home-content-stack"}>
          {selectedEntryCategory === "browse" ? (
            <div className="flex-1 min-h-0 max-h-full overflow-y-auto" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
              <div className="space-y-3">
                {filteredPublicCollections.length > 0 ? (
                  filteredPublicCollections.map((collectionEntry) => (
                    <CollectionCategoryEntryCard
                      key={collectionEntry.id}
                      title={collectionEntry.title || "Unbenannte Kollektion"}
                      description={null}
                      info={collectionEntry.description || "Öffentliche Nutzerkollektion"}
                      icon={Compass}
                      accent="browse"
                      showChevron={false}
                      customBackgroundColor={collectionEntry.background_color || collectionEntry.ownerBackgroundColor || null}
                      descriptionMaxHeightClass="max-h-14"
                      className="max-h-[9.75rem]"
                      metaChips={[
                        `${collectionEntry.progress?.discovered ?? 0}/${collectionEntry.progress?.total ?? 0} entdeckt · ${collectionEntry.itemsCount || 0} Einträge`,
                      ]}
                      secondaryActionIcon={Plus}
                      secondaryActionLabel="Kollektion folgen"
                      secondaryActionVisible={!readOnly && !!user?.id && !collectionEntry.isOwnCollection && !collectionEntry.isFollowing}
                      secondaryActionDisabled={followMutation.isPending}
                      onSecondaryAction={() => followMutation.mutate(collectionEntry.id)}
                      leadingVisual={(
                        <div className={"h-12 w-12 md:h-14 md:w-14 rounded-2xl border overflow-hidden " + (isLightUi ? "border-white/70 bg-white/45" : "border-white/30 bg-black/30")}>
                          <FlorabotLogo
                            profile={collectionEntry.ownerProfile || null}
                            logoAssets={logoAssets}
                            sizeClass="w-full h-full"
                            padding="p-[10%]"
                          />
                        </div>
                      )}
                      leadingBadges={(
                        <span className={"inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none border whitespace-nowrap " + (isLightUi ? "border-stone-500/30 bg-white/60 text-stone-700" : "border-white/30 bg-black/30 text-white/90")}>
                          {collectionEntry.followersCount || 0} Follower
                        </span>
                      )}
                      onClick={() => handleOpenPublicCollection(collectionEntry.id)}
                    />
                  ))
                ) : (
                  <div className={"rounded-2xl border border-dashed px-4 py-6 text-center text-sm " + (isLightUi ? "bg-white/50 border-[#c8ac62]/35 text-stone-700" : "bg-black/30 border-[#f0e5a5]/30 text-stone-300") }>
                    Keine öffentlichen Nutzerkollektionen verfügbar.
                  </div>
                )}
              </div>
            </div>
          ) : isCategoryLandingVisible ? (
            <div className="flex-1 min-h-0 max-h-full">
              <div className="h-full max-h-full grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
                <CollectionCategoryEntryCard
                  title="Globale"
                  icon={Leaf}
                  accent="global"
                  className="h-full max-h-[10.5rem]"
                  detailContent={(
                    <div className="space-y-1.5">
                      <div className={"flex items-center justify-between text-[11px] " + (isLightUi ? "text-white/75" : "text-white/75")}>
                        <span>Fortschritt</span>
                        <span>{globalCategoryStats.percent}%</span>
                      </div>
                      <div className={"h-2 rounded-full overflow-hidden border " + (isLightUi ? "bg-black/30 border-white/15" : "bg-black/35 border-white/15")}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${globalCategoryStats.percent}%`,
                            background: "linear-gradient(90deg, rgba(182, 220, 126, 0.92) 0%, rgba(132, 176, 86, 0.92) 100%)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                  descriptionMaxHeightClass="max-h-14"
                  onClick={() => {
                    setGlobalSubPickerDismissed(false);
                    setEntryCategory("global");
                    setPublicCollectionsPanelOpen(false);
                  }}
                />
                <CollectionCategoryEntryCard
                  title="Themen"
                  icon={List}
                  accent="themes"
                  className="h-full max-h-[10.5rem]"
                  metaChips={
                    followedThemeCollectionChips.length > 0
                      ? followedThemeCollectionChips
                      : ["Noch keine Abos vorhanden"]
                  }
                  descriptionMaxHeightClass="max-h-14"
                  onClick={() => {
                    setEntryCategory("themes");
                    const firstThemeCollectionId = uniqueThemeCollections[0]?.id;
                    if (firstThemeCollectionId) {
                      handleCollectionChipSelect(firstThemeCollectionId);
                    }
                  }}
                />
                <CollectionCategoryEntryCard
                  title="Gemeinsame"
                  icon={Users}
                  accent="shared"
                  className="h-full max-h-[10.5rem]"
                  metaChips={["Feature folgt in einem späteren Release"]}
                  descriptionMaxHeightClass="max-h-14"
                  onClick={() => {
                    setEntryCategory("shared");
                    setPublicCollectionsPanelOpen(false);
                  }}
                />
                <CollectionCategoryEntryCard
                  title="Stöbern"
                  icon={Compass}
                  accent="browse"
                  className="h-full max-h-[10.5rem]"
                  metaChips={[
                    `${browseCollectionCounts.totalPublicCollections} User-Kollektionen`,
                    `${browseCollectionCounts.followedPublicCollections} abonniert`,
                  ]}
                  descriptionMaxHeightClass="max-h-14"
                  onClick={() => {
                    setEntryCategory("browse");
                    setPublicCollectionsPanelOpen(false);
                  }}
                />
              </div>
            </div>
          ) : selectedEntryCategory === "global" && !globalSubPickerDismissed && selectedCollectionId !== "season" ? (
            <div className="flex-1 min-h-0 max-h-full">
              <div className="h-full max-h-full grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3" style={{ paddingTop: listTopFadePx, paddingBottom: listBottomFadePx }}>
                <CollectionCategoryEntryCard
                  title="Global"
                  icon={Leaf}
                  accent="global"
                  className="h-full max-h-[12rem]"
                  detailContent={(
                    <div className="space-y-1.5">
                      <div className={"flex items-center justify-between text-[11px] " + (isLightUi ? "text-white/75" : "text-white/75")}>
                        <span>Fortschritt</span>
                        <span>{globalCategoryStats.discovered}/{globalCategoryStats.total} ({globalCategoryStats.percent}%)</span>
                      </div>
                      <div className={"h-2 rounded-full overflow-hidden border " + (isLightUi ? "bg-black/30 border-white/15" : "bg-black/35 border-white/15")}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${globalCategoryStats.percent}%`,
                            background: "linear-gradient(90deg, rgba(182, 220, 126, 0.92) 0%, rgba(132, 176, 86, 0.92) 100%)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                  descriptionMaxHeightClass="max-h-14"
                  onClick={() => {
                    setGlobalSubPickerDismissed(true);
                    handleCollectionChipSelect("global");
                  }}
                />
                <CollectionCategoryEntryCard
                  title="☀️ Sommer 2026"
                  icon={Sun}
                  accent="season"
                  className="h-full max-h-[12rem]"
                  detailContent={(
                    <div className="space-y-1.5">
                      <div className={"flex items-center justify-between text-[11px] " + (isLightUi ? "text-white/75" : "text-white/75")}>
                        <span>Entdeckt diese Saison</span>
                        <span>{seasonCategoryStats.discovered}</span>
                      </div>
                      <div className={"h-2 rounded-full overflow-hidden border " + (isLightUi ? "bg-black/30 border-white/15" : "bg-black/35 border-white/15")}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${seasonCategoryStats.percent}%`,
                            background: "linear-gradient(90deg, rgba(251, 191, 36, 0.92) 0%, rgba(245, 158, 11, 0.92) 100%)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                  descriptionMaxHeightClass="max-h-14"
                  onClick={() => {
                    handleCollectionChipSelect("season");
                  }}
                />
              </div>
            </div>
          ) : (
            <CollectionScreen
              readOnly={readOnly}
              friendEmail={resolvedFriendEmail || null}
              selectedEntryCategory={selectedEntryCategory}
              selectedEntryCategoryLabel={selectedEntryCategoryLabel}
              onBackToCategoryLanding={embedded
                ? () => {
                  setEntryCategory(null);
                  setPublicCollectionsPanelOpen(false);
                }
                : undefined}
              isQuestCollectionView={isQuestCollectionView}
              ownedCollections={ownedCollections}
              followedCollections={followedCollections}
              collectionChips={collectionChips}
              getCollectionStats={getCollectionStats}
              selectedCollectionId={selectedCollectionId}
              onCollectionChipSelect={handleCollectionChipSelect}
              isLightUi={isLightUi}
              onCreateCollection={() => {
                if (!readOnly) navigate("/CollectionEditor");
              }}
              isHeroSegmentOpen={isHeroSegmentOpen}
              heroTitle={heroTitle}
              selectedCollection={selectedCollection}
              isOwnerOfSelected={isOwnerOfSelected}
              isFollowingSelected={isFollowingSelected}
              isFavoriteSelected={isFavoriteSelected}
              isFavoriteFeatureAvailable={!favoriteColumnUnavailable}
              userCollectionLinkForSelected={userCollectionLinkForSelected}
              onUnfollow={(userCollectionId) => unfollowMutation.mutate(userCollectionId)}
              onFollow={(collectionId) => followMutation.mutate(collectionId)}
              onToggleFavorite={(payload) => toggleFavoriteMutation.mutate(payload)}
              isFollowLoading={!readOnly && (followMutation.isPending || unfollowMutation.isPending)}
              isFavoriteLoading={!readOnly && toggleFavoriteMutation.isPending}
              onEditCollection={(collectionId) => {
                if (!readOnly) navigate("/CollectionEditor?id=" + collectionId);
              }}
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
              currentUser={user}
              uiTheme={uiTheme}
            />
          )}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

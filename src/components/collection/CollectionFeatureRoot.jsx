import { useState, useEffect, useMemo } from "react";
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
import { useUiTheme } from "@/lib/UiThemeContext";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { getPopulationScore } from "@/lib/conservationStatus";
import { submitCollectionItemProposal } from "@/api/collectionCollaborationService";

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

const fetchFriendDiscoveriesByAuthId = async (authIds, batchSize = 4) => {
  const result = {};

  for (let index = 0; index < authIds.length; index += batchSize) {
    const batch = authIds.slice(index, index + batchSize);
    const batchRows = await Promise.all(
      batch.map(async (authId) => {
        const discoveries = await Query.UserPlantDiscovery.filter({ auth_id: authId });
        return [authId, discoveries || []];
      })
    );

    batchRows.forEach(([authId, discoveries]) => {
      result[authId] = discoveries;
    });
  }

  return result;
};

export default function CollectionFeatureRoot({
  embedded = false,
  onRequestClose = null,
  initialCollectionId = "global",
  onSelectedCollectionIdChange = null,
  showPublicCollectionsPanel: externalShowPublicCollectionsPanel,
  onShowPublicCollectionsPanelChange = null,
  profileUser = null,
  currentUser = null,
  friendEmail = "",
  readOnly = false,
}) {
  const { isLightUi, uiTheme, pushThemeOverride, popThemeOverride } = useUiTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [user, setUser] = useState(currentUser || null);
  const [averageColor, setAverageColor] = useState(null);
  const [showPublicCollectionsPanelState, setShowPublicCollectionsPanelState] = useState(false);
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [communitySort, setCommunitySort] = useState("newest");
  const [proposalSearchQuery, setProposalSearchQuery] = useState("");
  const [proposalPlantId, setProposalPlantId] = useState("");
  const [proposalFeedback, setProposalFeedback] = useState(null);
  const isRouteMode = !embedded;
  const isQuestCollectionView =
    isRouteMode && searchParams.get("from") === "quests" && !!searchParams.get("collectionId");
  const showPublicCollectionsPanel =
    typeof externalShowPublicCollectionsPanel === "boolean"
      ? externalShowPublicCollectionsPanel
      : showPublicCollectionsPanelState;

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
      return;
    }

    let isMounted = true;
    const loadUser = async () => {
      const current = await getCurrentUser();
      if (isMounted) {
        setUser(current || null);
      }
    };
    loadUser();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

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

  const targetUser = profileUser || user;
  const targetUserId = targetUser?.auth_id || targetUser?.id || null;
  const isOwnCollectionContext =
    !readOnly &&
    !!user?.id &&
    !!targetUserId &&
    targetUserId === user.id;
  // Nur die explizit übergebene friendEmail weitergeben.
  // targetUser?.user_email darf NICHT als Fallback dienen, weil es sonst die eigene
  // E-Mail als friendEmail setzt und GenusDetail in den Fremd-Ansichts-Modus versetzt.
  const resolvedFriendEmail = friendEmail
    ? friendEmail.toString().trim()
    : (isOwnCollectionContext ? "" : (targetUser?.user_email || "").toString().trim());

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries', targetUserId],
    queryFn: async () => {
      if (!targetUserId) {
        return [];
      }
      return Query.UserPlantDiscovery.filter({ auth_id: targetUserId });
    },
    enabled: !!targetUserId,
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => Query.CollectionQuest.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userCollections = [] } = useQuery({
    queryKey: ["userCollections", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      return Query.UserCollection.filter({ auth_id: targetUserId });
    },
    enabled: !!targetUserId,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: visibleCollections = [] } = useQuery({
    queryKey: ["visibleCollections"],
    queryFn: () => Query.Collection.list(),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["collectionPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: allFriendRecords = [] } = useQuery({
    queryKey: ["collectionAllFriendRecords", user?.email],
    queryFn: () => Query.Friend.list(),
    enabled: !!user?.email && isOwnCollectionContext,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  const { data: ownedCollections = [] } = useQuery({
    queryKey: ['ownedCollections', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      return Query.Collection.filter({ auth_id: targetUserId });
    },
    enabled: !!targetUserId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: allCollectionItems = [] } = useQuery({
    queryKey: ['collectionItems'],
    queryFn: () => Query.CollectionItem.list(),
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: myCollectionMaintainers = [] } = useQuery({
    queryKey: ["myCollectionMaintainers", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      return Query.CollectionMaintainer.filter({ auth_id: user.id });
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: myPendingCollectionProposals = [] } = useQuery({
    queryKey: ["collectionMyPendingProposals", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      return Query.CollectionItemProposal.filter({ proposed_by_auth_id: user.id });
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const acceptedFriendProfiles = useMemo(() => {
    if (!isOwnCollectionContext || !user?.email) return [];

    const ownEmailLower = user.email.toLowerCase();
    const profileByEmail = new Map(
      (publicProfiles || [])
        .filter((profile) => !!profile?.user_email)
        .map((profile) => [profile.user_email.toLowerCase(), profile])
    );

    const acceptedEmails = new Set();
    (allFriendRecords || []).forEach((friendEntry) => {
      if (friendEntry?.status !== "accepted") return;

      const sender = String(friendEntry.request_sent_by || "").toLowerCase();
      const receiver = String(friendEntry.request_sent_to || "").toLowerCase();

      if (sender === ownEmailLower && receiver) {
        acceptedEmails.add(receiver);
      } else if (receiver === ownEmailLower && sender) {
        acceptedEmails.add(sender);
      }
    });

    return Array.from(acceptedEmails)
      .map((emailLower) => {
        const profile = profileByEmail.get(emailLower);
        if (!profile?.auth_id) return null;
        return {
          authId: profile.auth_id,
          email: profile.user_email,
          name: profile.display_name || profile.full_name || profile.user_email,
          logoAssets: resolveEquippedLogoAssetsWithCatalog(profile, logoAssets),
        };
      })
      .filter(Boolean);
  }, [allFriendRecords, isOwnCollectionContext, logoAssets, publicProfiles, user?.email]);

  const acceptedFriendAuthIds = useMemo(
    () => acceptedFriendProfiles.map((entry) => entry.authId).filter(Boolean),
    [acceptedFriendProfiles]
  );
  const acceptedFriendAuthIdsKey = useMemo(
    () => acceptedFriendAuthIds.join(","),
    [acceptedFriendAuthIds]
  );

  const acceptedFriendProfilesByAuthId = useMemo(
    () => new Map(acceptedFriendProfiles.map((entry) => [entry.authId, entry])),
    [acceptedFriendProfiles]
  );

  const { data: friendDiscoveriesByAuthId = {} } = useQuery({
    queryKey: ["collectionFriendDiscoveries", acceptedFriendAuthIds],
    queryFn: () => fetchFriendDiscoveriesByAuthId(acceptedFriendAuthIds),
    enabled: isOwnCollectionContext && acceptedFriendAuthIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isLoading = generaLoading || plantsLoading || discoveriesLoading;

  const plantById = useMemo(
    () => new Map((plants || []).map((plant) => [plant.id, plant])),
    [plants]
  );

  const genusByCategoryAndNumber = useMemo(
    () => new Map((genera || []).map((genus) => [`${genus.category}::${genus.category_dex_number}`, genus])),
    [genera]
  );

  const friendDiscoveryMetaByGenusId = useMemo(() => {
    if (!isOwnCollectionContext) return {};

    const friendMapByGenus = new Map();

    Object.entries(friendDiscoveriesByAuthId || {}).forEach(([authId, discoveries]) => {
      const friendProfile = acceptedFriendProfilesByAuthId.get(authId);
      if (!friendProfile || !Array.isArray(discoveries)) return;

      discoveries.forEach((discovery) => {
        const plant = plantById.get(discovery?.plant_id);
        if (!plant) return;

        const genus = genusByCategoryAndNumber.get(`${plant.genus_category}::${plant.genus_number}`);
        if (!genus?.id) return;

        if (!friendMapByGenus.has(genus.id)) {
          friendMapByGenus.set(genus.id, new Map());
        }

        friendMapByGenus.get(genus.id).set(authId, friendProfile);
      });
    });

    const meta = {};
    friendMapByGenus.forEach((friendsByAuthId, genusId) => {
      const friends = Array.from(friendsByAuthId.values()).sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "de")
      );

      meta[genusId] = {
        count: friends.length,
        friends,
      };
    });

    return meta;
  }, [
    acceptedFriendProfilesByAuthId,
    friendDiscoveriesByAuthId,
    genusByCategoryAndNumber,
    isOwnCollectionContext,
    plantById,
  ]);

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

  const generaWithDiscovery = genera.map(genus => {
    const genusPlants = plants.filter(p => 
      p.genus_category === genus.category && p.genus_number === genus.category_dex_number
    );
    const discoveredSpecies = genusPlants.filter(p =>
      userDiscoveries.some(d => d.plant_id === p.id)
    );

    const maxRarityScore = genusPlants.reduce((max, plant) => {
      const score = getPopulationScore(plant?.red_list_population ?? plant?.aiData?.red_list_population ?? null);
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
      hasRareSpecies: maxRarityScore >= 3,
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
  
  const followedCollections = visibleCollections.filter((c) =>
    c.is_public &&
    c.auth_id !== targetUserId &&
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
    if (!targetUserId) return;

    const refreshThrottleMs = 2 * 60 * 1000;
    const refreshKey = `collection:bg-refresh:${targetUserId}`;
    const now = Date.now();

    try {
      const lastRun = Number(window.sessionStorage.getItem(refreshKey) || 0);
      if (Number.isFinite(lastRun) && now - lastRun < refreshThrottleMs) {
        return;
      }
      window.sessionStorage.setItem(refreshKey, String(now));
    } catch {
      // sessionStorage may be unavailable in private contexts.
    }

    const baseQueryKeys = [
      ["genera"],
      ["plants"],
      ["userDiscoveries", targetUserId],
      ["userCollections", targetUserId],
      ["collectionItems"],
      ["visibleCollections"],
      ["collectionPublicProfiles"],
    ];

    baseQueryKeys.forEach((queryKey) => {
      if (typeof queryClient.getQueryData(queryKey) !== "undefined") {
        queryClient.refetchQueries({ queryKey, exact: true, type: "active" });
      }
    });

    if (isOwnCollectionContext && acceptedFriendAuthIds.length > 0) {
      const friendQueryKey = ["collectionFriendDiscoveries", acceptedFriendAuthIds];
      if (typeof queryClient.getQueryData(friendQueryKey) !== "undefined") {
        queryClient.refetchQueries({ queryKey: friendQueryKey, exact: true, type: "active" });
      }
    }
  }, [
    acceptedFriendAuthIds,
    acceptedFriendAuthIdsKey,
    isOwnCollectionContext,
    queryClient,
    targetUserId,
  ]);

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

  const heroStats = getCollectionStats(selectedCollection ? selectedCollection.id : 'global');
  const heroProgressPercent = heroStats.total
    ? Math.round((heroStats.discovered / heroStats.total) * 100)
    : 0;

  const ownerName = targetUser?.display_name || targetUser?.full_name || "Dein";
  const heroTitle = selectedCollection
    ? selectedCollection.title
    : ownerName + "'s Floralog";
  const listTopFadePx = 12;
  const listBottomFadePx = 18;
  const isOwnerOfSelected =
    !!selectedCollection && !!targetUserId && selectedCollection.auth_id === targetUserId;
  const isMaintainerOfSelected = !!selectedCollection && (
    selectedCollection.auth_id === user?.id ||
    (myCollectionMaintainers || []).some((entry) => entry.collection_id === selectedCollection.id)
  );
  const selectedCollectionItems = useMemo(
    () => selectedCollection ? allCollectionItems.filter((item) => item.collection_id === selectedCollection.id) : [],
    [allCollectionItems, selectedCollection]
  );
  const genusById = useMemo(
    () => new Map((genera || []).map((genus) => [genus.id, genus])),
    [genera]
  );
  const includedPlantIdsForSelectedCollection = useMemo(() => {
    const ids = new Set();
    if (!selectedCollection) return ids;

    selectedCollectionItems.forEach((item) => {
      if (item.plant_id) {
        ids.add(item.plant_id);
      }

      if (item.genus_id) {
        const genus = genusById.get(item.genus_id);
        if (!genus) return;
        (plants || []).forEach((plant) => {
          if (
            plant.genus_category === genus.category &&
            plant.genus_number === genus.category_dex_number
          ) {
            ids.add(plant.id);
          }
        });
      }
    });

    return ids;
  }, [genusById, plants, selectedCollection, selectedCollectionItems]);
  const pendingPlantIdsForSelectedCollection = useMemo(() => {
    const ids = new Set();
    if (!selectedCollection) return ids;

    (myPendingCollectionProposals || [])
      .filter((proposal) => proposal.status === "pending" && proposal.collection_id === selectedCollection.id)
      .forEach((proposal) => {
        if (proposal.plant_id) {
          ids.add(proposal.plant_id);
        }

        if (proposal.genus_id) {
          const genus = genusById.get(proposal.genus_id);
          if (!genus) return;
          (plants || []).forEach((plant) => {
            if (
              plant.genus_category === genus.category &&
              plant.genus_number === genus.category_dex_number
            ) {
              ids.add(plant.id);
            }
          });
        }
      });

    return ids;
  }, [genusById, myPendingCollectionProposals, plants, selectedCollection]);
  const canShowCollectionProposalControls =
    !readOnly &&
    !!user?.id &&
    !!selectedCollection &&
    selectedCollectionId !== "global" &&
    !!selectedCollection.is_public;
  const isProposalBlockedByPrivateMaintained =
    !!selectedCollection?.private_maintained && !isMaintainerOfSelected;
  const canSubmitToSelectedCollection =
    canShowCollectionProposalControls && !isProposalBlockedByPrivateMaintained;
  const proposalPlantOptions = useMemo(() => {
    if (!canShowCollectionProposalControls) return [];

    const normalized = proposalSearchQuery.trim().toLowerCase();
    return (plants || [])
      .filter((plant) => !includedPlantIdsForSelectedCollection.has(plant.id))
      .filter((plant) => !pendingPlantIdsForSelectedCollection.has(plant.id))
      .filter((plant) => {
        if (!normalized) return true;
        return (
          String(plant.species_name || "").toLowerCase().includes(normalized) ||
          String(plant.scientific_name || "").toLowerCase().includes(normalized)
        );
      })
      .sort((a, b) => String(a.species_name || "").localeCompare(String(b.species_name || ""), "de"))
      .slice(0, 120)
      .map((plant) => {
        const genus = genera.find(
          (entry) =>
            entry.category === plant.genus_category &&
            entry.category_dex_number === plant.genus_number
        );

        return {
          id: plant.id,
          label: `${plant.species_name || "Unbekannt"} (${plant.scientific_name || "ohne Namen"})`,
          genusLabel: genus?.genus_name || "Unbekannte Gattung",
        };
      });
  }, [
    canShowCollectionProposalControls,
    genera,
    includedPlantIdsForSelectedCollection,
    pendingPlantIdsForSelectedCollection,
    plants,
    proposalSearchQuery,
  ]);

  const submitCollectionProposalMutation = useMutation({
    mutationFn: async ({ plantId }) => {
      if (!selectedCollection?.id) throw new Error("Keine Kollektion ausgewaehlt.");
      const targetPlant = (plants || []).find((plant) => plant.id === plantId);
      if (!targetPlant) throw new Error("Pflanze nicht gefunden.");

      const targetGenus = (genera || []).find(
        (genus) =>
          genus.category === targetPlant.genus_category &&
          genus.category_dex_number === targetPlant.genus_number
      );

      return submitCollectionItemProposal({
        collectionId: selectedCollection.id,
        plant: targetPlant,
        genusId: targetGenus?.id || null,
        actorUser: user,
      });
    },
    onSuccess: () => {
      setProposalPlantId("");
      setProposalFeedback({ type: "success", message: "Vorschlag gesendet." });
      queryClient.invalidateQueries({ queryKey: ["collectionMyPendingProposals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["collectionItems"] });
    },
    onError: (error) => {
      setProposalFeedback({
        type: "error",
        message: error?.message || "Vorschlag fehlgeschlagen.",
      });
    },
  });

  useEffect(() => {
    setProposalPlantId("");
    setProposalFeedback(null);
  }, [selectedCollection?.id]);
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

    const isOwnCollection = !!targetUserId && c.auth_id === targetUserId;
    const userCollectionLink = userCollections.find((uc) => uc.collection_id === c.id) || null;
    const isFollowing = !!userCollectionLink && !isOwnCollection;

    return {
      ...c,
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
  const hasAdditionalCollections = (ownedCollections.length + followedCollections.length) > 0;
  const isHeroSegmentOpen = hasAdditionalCollections
    ? selectedCollectionFilters.heroSegmentOpen !== false
    : true;
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
    if (readOnly) return;
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
              uiTheme={uiTheme}
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
              onCreateCollection={() => {
                if (!readOnly) navigate("/CollectionEditor");
              }}
            />
          ) : (
            <CollectionScreen
              readOnly={readOnly}
              friendEmail={resolvedFriendEmail || null}
              showFriendHighlights={isOwnCollectionContext}
              friendDiscoveryMetaByGenusId={friendDiscoveryMetaByGenusId}
              isQuestCollectionView={isQuestCollectionView}
              ownedCollections={ownedCollections}
              followedCollections={followedCollections}
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
              canEditSelectedCollection={isMaintainerOfSelected && !readOnly}
              isFollowingSelected={isFollowingSelected}
              userCollectionLinkForSelected={userCollectionLinkForSelected}
              onUnfollow={(userCollectionId) => unfollowMutation.mutate(userCollectionId)}
              onFollow={(collectionId) => followMutation.mutate(collectionId)}
              isFollowLoading={!readOnly && (followMutation.isPending || unfollowMutation.isPending)}
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
              canShowCollectionProposalControls={canShowCollectionProposalControls}
              canSubmitToSelectedCollection={canSubmitToSelectedCollection}
              isProposalBlockedByPrivateMaintained={isProposalBlockedByPrivateMaintained}
              proposalSearchQuery={proposalSearchQuery}
              onProposalSearchQueryChange={(nextQuery) => setProposalSearchQuery(nextQuery)}
              proposalPlantId={proposalPlantId}
              onProposalPlantIdChange={(nextPlantId) => {
                setProposalFeedback(null);
                setProposalPlantId(nextPlantId);
              }}
              proposalPlantOptions={proposalPlantOptions}
              isProposalSubmitting={submitCollectionProposalMutation.isPending}
              onSubmitCollectionProposal={() => {
                if (!proposalPlantId) return;
                submitCollectionProposalMutation.mutate({ plantId: proposalPlantId });
              }}
              proposalFeedback={proposalFeedback}
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


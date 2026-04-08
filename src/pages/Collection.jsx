import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Query } from "@/api/entities";
import { createUserNotification, getUserDisplayName } from "@/api/notificationService";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Leaf, PencilLine, SlidersHorizontal, Minus, Plus, Home, ArrowLeft } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import HintDialog from "../components/collection/HintDialog";
import SearchSortBar from "../components/collection/SearchSortBar";
import HomeShellLoader from "../components/navigation/HomeShellLoader";

const COLLECTION_FILTERS_STORAGE_KEY = "collection_filters_by_collection_v1";
const COLLECTION_VIEW_STATE_STORAGE_KEY = "collection_view_state_v1";
const DEFAULT_COLLECTION_FILTERS = {
  activeCategory: null,
  searchQuery: "",
  collectionSort: "index",
  discoveredFilter: "all",
  sortChipsOpen: true,
};

const CATEGORY_CHIPS = [
  { value: "Bäume", emoji: "🌳" },
  { value: "Sträucher", emoji: "🌿" },
  { value: "Blumen", emoji: "🌸" },
];

const readCollectionViewState = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(COLLECTION_VIEW_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
      } catch (error) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};


export default function Collection({ embedded = false, onRequestClose = null }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionSort, setCollectionSort] = useState("index");
  const [discoveredFilter, setDiscoveredFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState("global");
  const [sortChipsOpen, setSortChipsOpen] = useState(true);
  const listScrollContainerRef = useRef(null);
  const restoredScrollForCollectionRef = useRef(null);
  const collectionViewStateRef = useRef(readCollectionViewState());
  const [filterSettingsByCollection, setFilterSettingsByCollection] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COLLECTION_FILTERS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const isQuestCollectionView = searchParams.get("from") === "quests" && !!searchParams.get("collectionId");

  const saveFiltersForCollection = (collectionId, partial) => {
    const key = collectionId || "global";
    setFilterSettingsByCollection((prev) => {
      const prevForKey = {
        ...DEFAULT_COLLECTION_FILTERS,
        ...(prev[key] || {}),
      };
      return {
        ...prev,
        [key]: {
          ...prevForKey,
          ...partial,
        },
      };
    });
  };

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        COLLECTION_FILTERS_STORAGE_KEY,
        JSON.stringify(filterSettingsByCollection)
      );
    } catch {
      // Ignore localStorage write errors silently
    }
  }, [filterSettingsByCollection]);

  useEffect(() => {
    const key = selectedCollectionId || "global";
    const saved = filterSettingsByCollection[key];
    const next = {
      ...DEFAULT_COLLECTION_FILTERS,
      ...(saved || {}),
    };
    setActiveCategory(next.activeCategory || null);
    setSearchQuery(next.searchQuery || "");
    setCollectionSort(next.collectionSort);
    setDiscoveredFilter(next.discoveredFilter);
    setSortChipsOpen(Boolean(next.sortChipsOpen));
  }, [selectedCollectionId, filterSettingsByCollection]);

  useEffect(() => {
    return () => {
      persistCurrentScrollPosition();
    };
  }, [selectedCollectionId]);

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

  const persistCollectionViewState = (updater) => {
    if (typeof window === "undefined") return;
    const previous = collectionViewStateRef.current || {};
    const next = typeof updater === "function" ? updater(previous) : { ...previous, ...updater };
    collectionViewStateRef.current = next;
    try {
      window.sessionStorage.setItem(COLLECTION_VIEW_STATE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore sessionStorage write errors silently
    }
  };

  const persistCurrentScrollPosition = () => {
    const key = selectedCollectionId || "global";
    const currentTop = listScrollContainerRef.current?.scrollTop || 0;
    persistCollectionViewState((prev) => ({
      ...prev,
      scrollByCollection: {
        ...(prev.scrollByCollection || {}),
        [key]: currentTop,
      },
    }));
  };

  const handleCollectionListScroll = () => {
    persistCurrentScrollPosition();
  };

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

  const discoveredCount = sortedGenera.filter(g => g.discovered).length;
  const totalCount = sortedGenera.length;

  const discoveredSpecies = userDiscoveries.length;
  const totalSpecies = plants.length;

  useEffect(() => {
    const key = selectedCollectionId || "global";
    if (restoredScrollForCollectionRef.current === key) return;
    if (!listScrollContainerRef.current) return;

    const savedTop = collectionViewStateRef.current?.scrollByCollection?.[key];
    const nextTop = Number.isFinite(savedTop) ? savedTop : 0;

    window.requestAnimationFrame(() => {
      if (!listScrollContainerRef.current) return;
      listScrollContainerRef.current.scrollTop = nextTop;
      restoredScrollForCollectionRef.current = key;
    });
  }, [selectedCollectionId, sortedGenera.length]);

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
      <HomeShellLoader
        backgroundImageUrl={user?.background_image_url || null}
        backgroundColor={user?.background_color || null}
        showProfileCard
      />
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
  const chipRightFadePx = 24;
  const isOwnerOfSelected =
    !!selectedCollection && !!user?.id && selectedCollection.auth_id === user.id;
  const userCollectionLinkForSelected = selectedCollection
    ? userCollections.find((uc) => uc.collection_id === selectedCollection.id)
    : null;
  const isFollowingSelected = !!userCollectionLinkForSelected && !isOwnerOfSelected;
  const handleBack = () => {
    if (embedded && typeof onRequestClose === "function") {
      onRequestClose();
      return;
    }
    navigate(createPageUrl("Home"));
  };

  return (
    <div className={embedded ? "h-full min-h-0" : "fixed inset-0 overflow-hidden"} data-ui="home-page-shell">
      {!embedded && <div className="absolute inset-0" style={pageShellBackgroundStyle} />}
      {!embedded && <div className="absolute inset-0 backdrop-blur-3xl" />}
      {!embedded && <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/55" />}

      <div className={embedded ? "relative z-10 h-full w-full" : "relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center"}>
        <div className={embedded ? "relative h-full w-full rounded-3xl overflow-hidden border border-[#d7cf9c]/45 shadow-[0_12px_40px_rgba(0,0,0,0.35)]" : "relative h-[calc(100%-1.50rem)] md:h-[calc(100%-1.50rem)] w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"}>
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
          <div className="absolute inset-0 border border-[#f0e5a5]/30 pointer-events-none rounded-[2rem]" />

          <div className="relative z-10 h-full flex flex-col px-4 md:px-8 py-4 md:py-6 text-stone-100">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#f0e5a5]/20" data-ui="home-header-bar">
              <div className="min-w-0">
                <h1 className="font-bold leading-tight text-2xl md:text-3xl">Kollektionen</h1>
              </div>

              <button
                type="button"
                onClick={handleBack}
                className="w-11 h-11 rounded-full border border-[#f0e5a5]/35 bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/45 transition-colors shrink-0"
                aria-label={embedded ? "Zurück zur Home-Ansicht" : "Zur Home Seite"}
              >
                {embedded ? <ArrowLeft className="w-5 h-5 text-[#f0e5a5]" /> : <Home className="w-5 h-5 text-[#f0e5a5]" />}
              </button>
            </div>

            <HintDialog
              genus={selectedGenus}
              isOpen={showHintDialog}
              onClose={() => setShowHintDialog(false)}
            />

            <div className="flex-1 min-h-0 py-[clamp(0.5rem,1.5vh,1rem)] flex flex-col gap-3" data-ui="home-content-stack">
          <div className="shrink-0 space-y-3">
            {/* Horizontale Kollektionen-Chips + Neuerstellen-Button */}
            {!isQuestCollectionView && (ownedCollections.length + followedCollections.length > 0) && (
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
                            ? "bg-black/55 text-[#f7f0c1] shadow-sm"
                            : "bg-black/35 text-stone-200 hover:bg-black/50")
                        }
                        style={{
                          borderColor: isActive
                            ? "rgba(240,229,165,0.75)"
                            : "rgba(255,255,255,0.3)",
                        }}
                      >
                        <span className="font-medium">{col.title}</span>
                        <span className="text-[10px] text-stone-300">
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
                className="shrink-0 w-8 h-8 rounded-full bg-black/45 border border-[#f0e5a5]/40 text-[#f0e5a5] flex items-center justify-center shadow-sm hover:bg-black/60 transition-colors"
                aria-label="Neue Kollektion anlegen"
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
            )}

            {/* Hero-Kachel */}
            <div
              className="rounded-2xl border shadow-sm p-3 flex flex-col gap-3 bg-black/35 backdrop-blur-sm"
              style={{
                borderColor: "rgba(240,229,165,0.35)",
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-lg font-bold text-[#f8f4d6] leading-tight flex-1 min-w-0 truncate">
                    {heroTitle}
                  </h1>
                  {!isQuestCollectionView && (ownedCollections.length + followedCollections.length === 0) && (
                    <button
                      type="button"
                      onClick={() => navigate("/CollectionEditor")}
                      className="shrink-0 w-8 h-8 rounded-full bg-black/45 border border-[#f0e5a5]/40 text-[#f0e5a5] flex items-center justify-center shadow-sm hover:bg-black/60 transition-colors"
                      aria-label="Neue Kollektion anlegen"
                    >
                      <span className="text-lg leading-none">+</span>
                    </button>
                  )}
                  {selectedCollection && !isQuestCollectionView && (
                    <div className="shrink-0 flex items-center gap-1.5">
                      {(selectedCollection.followers_count ?? 0) > 0 && (
                        <div
                          className="p-1 rounded-full border bg-black/45 text-stone-100 flex items-center justify-center text-[10px] font-bold border-sky-300/70"
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
                              unfollowMutation.mutate(userCollectionLinkForSelected.id);
                            } else if (!isFollowingSelected) {
                              followMutation.mutate(selectedCollection.id);
                            }
                          }}
                          disabled={followMutation.isPending || unfollowMutation.isPending}
                          className={
                            isFollowingSelected
                              ? "shrink-0 p-1 rounded-full border bg-black/45 text-stone-100 hover:bg-black/60 border-red-300/80 transition-colors disabled:opacity-60"
                              : "shrink-0 p-1 rounded-full border bg-black/45 text-stone-100 hover:bg-black/60 border-emerald-300/80 transition-colors disabled:opacity-60"
                          }
                          aria-label={isFollowingSelected ? "Abo beenden" : "Abonnieren"}
                        >
                          {isFollowingSelected ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        </button>
                      )}

                      {isOwnerOfSelected && (
                        <button
                          type="button"
                          onClick={() => navigate("/CollectionEditor?id=" + selectedCollection.id)}
                          className="shrink-0 p-1.5 rounded-full bg-black/45 text-[#f0e5a5] hover:bg-black/60 border border-[#f0e5a5]/35 transition-colors"
                          aria-label="Kollektion bearbeiten"
                        >
                          <PencilLine className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {selectedCollection?.description && (
                  <p className="text-[11px] text-stone-200/90 max-h-[4.5em] overflow-y-auto leading-snug rounded focus:outline-none focus:ring-1 focus:ring-[#f0e5a5]/40" tabIndex={0}>
                    {selectedCollection.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-stone-200/90">
                    <div className="flex items-center gap-1">
                      <span>Fortschritt</span>
                      {heroStats.total > 0 && (
                        <span className="text-[10px] text-stone-300/90">
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
                            onClick={() => {
                              const nextCategory = isActive ? null : categoryChip.value;
                              setActiveCategory(nextCategory);
                              saveFiltersForCollection(selectedCollectionId, { activeCategory: nextCategory });
                            }}
                            className={
                              "p-1 rounded-full border transition-colors " +
                              (isActive
                                ? "bg-black/55 text-[#f0e5a5] border-[#f0e5a5]/70"
                                : "bg-black/35 text-stone-100 border-white/30 hover:bg-black/55")
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
                        onClick={() => {
                          setSortChipsOpen((prev) => {
                            const next = !prev;
                            saveFiltersForCollection(selectedCollectionId, { sortChipsOpen: next });
                            return next;
                          });
                        }}
                        className={
                          "p-1 rounded-full transition-colors " +
                          (sortChipsOpen
                            ? "bg-black/60 text-[#f0e5a5]"
                            : "bg-black/40 text-stone-100 hover:bg-black/60")
                        }
                        aria-label={sortChipsOpen ? "Suche und Sortierung ausblenden" : "Suche und Sortierung einblenden"}
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
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

            {/* Suche und Sortierchips per Icon ein/ausblendbar */}
            {sortChipsOpen && (
              <div className="space-y-2">
                <SearchSortBar
                  searchQuery={searchQuery}
                  onSearchQueryChange={(nextQuery) => {
                    setSearchQuery(nextQuery);
                    saveFiltersForCollection(selectedCollectionId, { searchQuery: nextQuery });
                  }}
                  sortOptions={[
                    { value: "index", label: "Index" },
                    { value: "newest", label: "Neu" },
                    { value: "title", label: "Titel" },
                    { value: "rarity", label: "Rarität" },
                  ]}
                  sortValue={collectionSort}
                  onSortChange={(nextSort) => {
                    setCollectionSort(nextSort);
                    saveFiltersForCollection(selectedCollectionId, { collectionSort: nextSort });
                  }}
                  showSortControls={sortChipsOpen}
                  showDiscoveredToggle
                  discoveredFilter={discoveredFilter}
                  onDiscoveredFilterChange={(nextFilter) => {
                    setDiscoveredFilter(nextFilter);
                    saveFiltersForCollection(selectedCollectionId, { discoveredFilter: nextFilter });
                  }}
                />
              </div>
            )}
          </div>

          {/* Collection Grid */}
          <div
            ref={listScrollContainerRef}
            onScroll={handleCollectionListScroll}
            className="relative flex-1 min-h-0 overflow-y-auto pb-20"
            style={{
              WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
              maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
            }}
          >
            {filteredGenera.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-black/45 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#f0e5a5]/30">
                  <Leaf className="w-12 h-12 text-[#f0e5a5]" />
                </div>
                <h3 className="text-2xl font-bold text-[#f8f4d6] mb-2">
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
                    isAdmin={currentUser?.role === 'admin'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}


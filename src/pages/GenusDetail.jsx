import React, { useState, useEffect, useRef, useMemo } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Leaf, CheckCircle2, Volume2, VolumeX, ChevronLeft, ChevronRight, Star, HelpCircle, X, Trash2, Heart } from "lucide-react";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import MobileBackButton from "../components/navigation/MobileBackButton";
import EditPlantDialog from "../components/collection/EditPlantDialog";
import SpeciesInfoCard from "../components/collection/SpeciesInfoCard";
import ThreatLevelSparks from "@/components/effects/ThreatLevelSparks";
import { useUiTheme } from "@/lib/UiThemeContext";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import {
  buildCollectionMembershipIndex,
} from "@/api/collectionCollaborationService";
import {
  getConservationEffectLevel,
  getConservationFromPlant,
  getRarityBorderClass,
  getRarityGlowColor,
  getThreatAnimationClass,
} from "@/lib/conservationStatus";

export default function GenusDetail() {
  const LIST_SWIPE_THRESHOLD_PX = 60;
  const LIST_SWIPE_DOMINANCE_RATIO = 1.4;
  const LIST_DRAG_INTENT_THRESHOLD_PX = 16;
  const LIST_DRAG_SNAP_OFFSET_PX = 18;
  const EXPANDED_SWIPE_THRESHOLD_PX = 50;
  const EXPANDED_SWIPE_DOMINANCE_RATIO = 1.25;
  const VARIANT_RESET_TIMEOUT_MS = 5000;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLightUi: contextIsLightUi } = useUiTheme();
  const urlParams = new URLSearchParams(window.location.search);
  const genusId = urlParams.get('id');
  const friendEmail = urlParams.get('email'); // NEU: Prüfe ob wir im Freundes-Kontext sind
  const collectionId = urlParams.get('collectionId');
  const targetDiscoveryId = urlParams.get('discoveryId');
  const [speakingPlantId, setSpeakingPlantId] = useState(null);
  const [activeVariantIndexes, setActiveVariantIndexes] = useState({});
  const [activeScanIndexes, setActiveScanIndexes] = useState({});
  const [expandedActiveVariantIndex, setExpandedActiveVariantIndex] = useState(0);
  const [expandedOwnScanIndex, setExpandedOwnScanIndex] = useState(0);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [expandedPlant, setExpandedPlant] = useState(null);
  const [editingPlant, setEditingPlant] = useState(null);
  const [deleteConfirmDiscoveryId, setDeleteConfirmDiscoveryId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [plantDragOffsets, setPlantDragOffsets] = useState({});
  const [expandedDragOffset, setExpandedDragOffset] = useState(null);
  const [openFriendTooltipKey, setOpenFriendTooltipKey] = useState(null);
  const deepLinkAppliedRef = useRef(false);
  const plantLongPressTimerRef = useRef(null);
  const plantLongPressTriggeredRef = useRef(false);
  const plantLongPressStartPointRef = useRef(null);
  const plantLongPressMovementCancelledRef = useRef(false);
  const plantDragStartXRef = useRef({});
  const plantDragStartPointRef = useRef({});
  const plantDragActivatedRef = useRef({});
  const plantTouchStartXRef = useRef({});
  const plantSwipeTriggeredRef = useRef({});
  const variantResetTimersRef = useRef({});
  const expandedDragStartXRef = useRef(null);
  const expandedDragStartPointRef = useRef(null);
  const expandedDragActivatedRef = useRef(false);
  const expandedTouchStartXRef = useRef(null);
  const expandedSwipeTriggeredRef = useRef(false);

  const getDiscoveryTimestamp = (discovery) => {
    const raw = discovery?.discovered_date;
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setCurrentUser(user || null);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
    };
    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

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
          resolve(`rgb(${r}, ${g}, ${b})`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    if (currentUser?.background_color) {
      setAverageColor(currentUser.background_color);
    } else if (currentUser?.background_image_url) {
      getAverageColor(currentUser.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [currentUser?.background_image_url, currentUser?.background_color]);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  // Wenn friendEmail gesetzt ist, laden wir das PublicProfile des Freundes,
  // um dessen auth_id zu erhalten (für RLS-kompatible Queries auf UserPlantDiscovery).
  const { data: friendProfile } = useQuery({
    queryKey: ['friendProfileForGenus', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return null;
      const profiles = await Query.PublicProfile.list();
      return profiles.find(p => p.user_email?.toLowerCase() === friendEmail.toLowerCase()) || null;
    },
    enabled: !!friendEmail,
  });

  const isLightUi = friendEmail
    ? friendProfile?.ui_theme === "light"
    : contextIsLightUi;

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries', friendEmail || currentUser?.id],
    queryFn: async () => {
      // Freundes-Kontext: Discoveries des Freundes über auth_id laden
      if (friendEmail) {
        if (friendProfile?.auth_id) {
          return Query.UserPlantDiscovery.filter({ auth_id: friendProfile.auth_id });
        }

        // Fallback: alte Discoveries über Email filtern (falls kein auth_id vorhanden)
        const discoveries = await Query.UserPlantDiscovery.list();
        return discoveries.filter(d => d.user === friendEmail || d.created_by === friendEmail);
      }

      // Eigene Discoveries über auth_id laden (wie in Collection.jsx)
      if (!currentUser?.id) {
        return [];
      }
      return Query.UserPlantDiscovery.filter({ auth_id: currentUser.id });
    },
    enabled: friendEmail ? (friendProfile !== undefined) : !!currentUser?.id,
  });

  const { data: allScanLikes = [] } = useQuery({
    queryKey: ["scanLikesAll"],
    queryFn: () => Query.ScanLike.list("-created_date"),
  });

  const { data: allPublicProfiles = [] } = useQuery({
    queryKey: ["genusDetailPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
    enabled: !friendEmail && !!currentUser?.email,
    staleTime: 30000,
  });

  const { data: logoAssets = [] } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    enabled: !friendEmail && !!currentUser?.email,
    staleTime: 60000,
  });

  const { data: visibleCollections = [] } = useQuery({
    queryKey: ["genusDetailVisibleCollections"],
    queryFn: () => Query.Collection.list(),
    staleTime: 120000,
  });

  const { data: allCollectionItems = [] } = useQuery({
    queryKey: ["genusDetailCollectionItems"],
    queryFn: () => Query.CollectionItem.list(),
    staleTime: 120000,
  });

  // Alle Pflanzen dieser Gattung als IDs (für die plant_id-basierte Query)
  const genusForQuery = useMemo(() => genera.find((g) => g.id === genusId), [genera, genusId]);
  const genusSpecificPlantIds = useMemo(() => {
    if (!genusForQuery) return [];
    return (plants || [])
      .filter((p) => p.genus_category === genusForQuery.category && p.genus_number === genusForQuery.category_dex_number)
      .map((p) => p.id);
  }, [plants, genusForQuery]);

  // Alle Discoveries dieser Gattung von allen Spielern (eine Query pro Pflanze)
  const { data: allGenusDiscoveries = [] } = useQuery({
    queryKey: ["genusDetailAllPlayerDiscoveries", genusId],
    queryFn: async () => {
      if (!genusSpecificPlantIds.length) return [];
      const rows = await Promise.all(
        genusSpecificPlantIds.map((plantId) =>
          Query.UserPlantDiscovery.filter({ plant_id: plantId })
        )
      );
      return rows.flat();
    },
    enabled: !friendEmail && !!currentUser?.id && genusSpecificPlantIds.length > 0,
    staleTime: 60000,
  });

  // Discoveries strukturiert nach auth_id (nur Spieler mit öffentlichem Profil, nicht eigen)
  const otherPlayerDiscoveriesByAuthId = useMemo(() => {
    if (!currentUser?.id) return {};
    const publicAuthIds = new Set(
      (allPublicProfiles || [])
        .filter((p) => p?.auth_id && p.auth_id !== currentUser.id && p?.public_profile !== false)
        .map((p) => p.auth_id)
    );
    const byAuthId = {};
    (allGenusDiscoveries || []).forEach((disc) => {
      if (!disc?.auth_id || !publicAuthIds.has(disc.auth_id)) return;
      if (!byAuthId[disc.auth_id]) byAuthId[disc.auth_id] = [];
      byAuthId[disc.auth_id].push(disc);
    });
    return byAuthId;
  }, [allGenusDiscoveries, allPublicProfiles, currentUser?.id]);

  // Spieler-Profile die tatsächlich Discoveries in dieser Gattung haben
  const otherPlayerProfiles = useMemo(() => {
    const authIdsWithDiscoveries = new Set(Object.keys(otherPlayerDiscoveriesByAuthId));
    return (allPublicProfiles || [])
      .filter((p) => p?.auth_id && authIdsWithDiscoveries.has(p.auth_id))
      .map((p) => ({
        authId: p.auth_id,
        email: p.user_email,
        name: p.display_name || p.full_name || p.user_email,
        logoAssets: resolveEquippedLogoAssetsWithCatalog(p, logoAssets),
      }));
  }, [otherPlayerDiscoveriesByAuthId, allPublicProfiles, logoAssets]);

  const otherPlayerByAuthId = useMemo(
    () => new Map(otherPlayerProfiles.map((p) => [p.authId, p])),
    [otherPlayerProfiles]
  );

  const ownActor = useMemo(() => {
    const ownProfile = (allPublicProfiles || []).find((profile) => {
      if (!profile) return false;
      if (currentUser?.id && profile.auth_id === currentUser.id) return true;
      if (currentUser?.email && profile.user_email) {
        return profile.user_email.toLowerCase() === currentUser.email.toLowerCase();
      }
      return false;
    });

    return {
      authId: currentUser?.id || ownProfile?.auth_id || "self",
      email: currentUser?.email || ownProfile?.user_email || "",
      name:
        currentUser?.display_name ||
        currentUser?.full_name ||
        ownProfile?.display_name ||
        ownProfile?.full_name ||
        currentUser?.email ||
        "Du",
      logoAssets: resolveEquippedLogoAssetsWithCatalog(ownProfile || currentUser || {}, logoAssets),
      isOwn: true,
    };
  }, [allPublicProfiles, currentUser, logoAssets]);

  const setFrontImageMutation = useMutation({
    mutationFn: async ({ discoveryId }) => {
      const selectedDiscovery = userDiscoveries.find((d) => d.id === discoveryId);
      if (!selectedDiscovery) {
        throw new Error("Ausgewaehlter Scan nicht gefunden.");
      }

      // Alle Discoveries der gesamten Gattung auf false setzen
      const genusDiscoveries = userDiscoveries.filter(d => {
        const plant = plants.find(p => p.id === d.plant_id);
        return plant && selectedGenus && 
               plant.genus_category === selectedGenus.category && 
               plant.genus_number === selectedGenus.category_dex_number;
      });

      // Species-Frontbild nur innerhalb derselben Species zuruecksetzen.
      const speciesDiscoveries = genusDiscoveries.filter(
        (d) => d.plant_id === selectedDiscovery.plant_id
      );

      await Promise.allSettled(
        genusDiscoveries.map(d => 
          Query.UserPlantDiscovery.update(d.id, {
            is_front_image: false,
          })
        )
      );

      await Promise.allSettled(
        speciesDiscoveries.map((d) =>
          Query.UserPlantDiscovery.update(d.id, {
            is_species_front_image: false,
          })
        )
      );

      // Dann das ausgewählte auf true setzen
      await Query.UserPlantDiscovery.update(discoveryId, {
        is_front_image: true,
        is_species_front_image: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries', currentUser?.id] });
    },
    onError: (error) => {
      console.error("Fehler beim Setzen des Gattungsbilds:", error);
      const details = error?.message || error?.details || error?.hint || "Unbekannter Fehler";
      alert("Das Vorschaubild konnte nicht gesetzt werden: " + details);
    },
  });

  // Ehemalige Lieblingsscan-Funktion (Herz) wurde entfernt

  const deleteDiscoveryMutation = useMutation({
    mutationFn: async (discoveryId) => {
      await Query.UserPlantDiscovery.delete(discoveryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDiscoveries'] });
      setDeleteConfirmDiscoveryId(null);
      // Wenn das expandedPlant keine Discoveries mehr hat, schließe das Modal
      if (expandedPlant) {
        const remainingDiscoveries = (expandedPlantData?.discoveryVariants || [])
          .map((variant) => variant?.discovery)
          .filter((discovery) => !!discovery && discovery.id !== deleteConfirmDiscoveryId);
        if (remainingDiscoveries.length === 0) {
          setExpandedPlant(null);
        }
      }
    },
  });

  const toggleScanLikeMutation = useMutation({
    mutationFn: async ({ discoveryId, nextLiked }) => {
      if (!currentUser?.email || !discoveryId) return;

      const ownEmailLower = currentUser.email.toLowerCase();
      const existingLike = (allScanLikes || []).find(
        (like) => like?.discovery_id === discoveryId && like?.liked_by?.toLowerCase() === ownEmailLower
      );

      if (nextLiked) {
        if (existingLike) return;
        await Query.ScanLike.create({
          discovery_id: discoveryId,
          liked_by: currentUser.email,
          liked_date: new Date().toISOString(),
          auth_id: currentUser.id,
          created_by: currentUser.email,
        });
        return;
      }

      if (existingLike?.id) {
        await Query.ScanLike.delete(existingLike.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scanLikesAll"] });
    },
    onError: () => {
      alert("Like konnte nicht gespeichert werden. Bitte versuche es erneut.");
    },
  });



  // Removed updateGenusMutation as it's no longer needed for dynamically loaded icons
  // Removed handleUpdateIcon as it's tied to updateGenusMutation

  const speakPlantDescription = (plant) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }
    
    window.speechSynthesis.cancel();
    
    if (speakingPlantId === plant.id) {
      setSpeakingPlantId(null);
      return;
    }

    let text = `${plant.species_name}. ${plant.scientific_name}. `;
    
    if (plant.description) {
      text += plant.description + ". ";
    }
    
    if (plant.identification_features) {
      text += "Erkennungsmerkmale: " + plant.identification_features + ". ";
    }
    
    if (plant.fun_fact) {
      text += "Wusstest du? " + plant.fun_fact;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 1.2;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const germanMaleVoice = voices.find(voice => 
      voice.lang.includes('de') && 
      (voice.name.includes('Male') || voice.name.includes('männlich') || voice.name.includes('Martin') || voice.name.includes('Stefan'))
    );
    
    const germanVoice = voices.find(voice => voice.lang.includes('de'));
    
    if (germanMaleVoice) {
      utterance.voice = germanMaleVoice;
    } else if (germanVoice) {
      utterance.voice = germanVoice;
    }
    
    utterance.onstart = () => setSpeakingPlantId(plant.id);
    utterance.onend = () => setSpeakingPlantId(null);
    utterance.onerror = () => setSpeakingPlantId(null);
    
    window.speechSynthesis.speak(utterance);
  };

  const genus = genera.find(g => g.id === genusId);
  const selectedGenus = genus;
  const likeCountByDiscoveryId = useMemo(
    () => (allScanLikes || []).reduce((acc, like) => {
      if (!like?.discovery_id) return acc;
      acc.set(like.discovery_id, (acc.get(like.discovery_id) || 0) + 1);
      return acc;
    }, new Map()),
    [allScanLikes]
  );

  const likedDiscoveryIdSet = useMemo(() => {
    const ownEmailLower = currentUser?.email?.toLowerCase();
    if (!ownEmailLower) return new Set();
    return new Set(
      (allScanLikes || [])
        .filter((like) => like?.discovery_id && like?.liked_by?.toLowerCase() === ownEmailLower)
        .map((like) => like.discovery_id)
    );
  }, [allScanLikes, currentUser?.email]);

  const pickPreferredDiscovery = (discoveries = []) => {
    if (!Array.isArray(discoveries) || discoveries.length === 0) return null;
    return [...discoveries].sort((a, b) => {
      const aIsFront = Boolean(a?.is_front_image || a?.is_species_front_image);
      const bIsFront = Boolean(b?.is_front_image || b?.is_species_front_image);
      if (aIsFront && !bIsFront) return -1;
      if (!aIsFront && bIsFront) return 1;
      return getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a);
    })[0] || null;
  };

  const genusPlants = plants.filter(p => 
    selectedGenus && p.genus_category === selectedGenus.category && p.genus_number === selectedGenus.category_dex_number
  ).map(plant => {
    const plantDiscoveries = userDiscoveries.filter(d => d.plant_id === plant.id);
    // Sortiere: Front-Image zuerst, dann nach Datum
    const sortedDiscoveries = [...plantDiscoveries].sort((a, b) => {
      const aIsFront = Boolean(a.is_front_image || a.is_species_front_image);
      const bIsFront = Boolean(b.is_front_image || b.is_species_front_image);
      if (aIsFront && !bIsFront) return -1;
      if (!aIsFront && bIsFront) return 1;
      return getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a);
    });
    const userDiscovery = sortedDiscoveries[0];

    const otherActors = friendEmail
      ? []
      : Object.entries(otherPlayerDiscoveriesByAuthId || {}).flatMap(([authId, discoveries]) => {
          const actor = otherPlayerByAuthId.get(authId);
          if (!actor || !Array.isArray(discoveries)) return [];
          const hasSpeciesDiscovery = discoveries.some((discovery) => discovery?.plant_id === plant.id);
          return hasSpeciesDiscovery ? [actor] : [];
        });

    const uniqueOtherActors = Array.from(
      new Map(otherActors.map((actor) => [actor.authId, actor])).values()
    ).sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

    const discoveryVariants = [];

    if (friendEmail) {
      const preferredFriendDiscovery = pickPreferredDiscovery(sortedDiscoveries);
      const friendDefaultScanIndex = preferredFriendDiscovery
        ? Math.max(0, sortedDiscoveries.findIndex((entry) => entry?.id === preferredFriendDiscovery.id))
        : 0;

      discoveryVariants.push({
        key: `friend-${friendProfile?.auth_id || "unknown"}-${plant.id}`,
        actor: {
          authId: friendProfile?.auth_id || "friend",
          email: friendEmail,
          name: friendProfile?.display_name || friendProfile?.full_name || friendEmail,
          logoAssets: resolveEquippedLogoAssetsWithCatalog(friendProfile || {}, logoAssets),
          isOwn: false,
        },
        discoveries: sortedDiscoveries,
        defaultScanIndex: friendDefaultScanIndex,
        discovery: preferredFriendDiscovery,
        isOwn: false,
      });
    } else {
      const ownPreferred = pickPreferredDiscovery(sortedDiscoveries);
      const ownDefaultScanIndex = ownPreferred
        ? Math.max(0, sortedDiscoveries.findIndex((entry) => entry?.id === ownPreferred.id))
        : 0;

      discoveryVariants.push({
        key: `own-${ownActor.authId}-${plant.id}`,
        actor: ownActor,
        discoveries: sortedDiscoveries,
        defaultScanIndex: ownDefaultScanIndex,
        discovery: ownPreferred,
        isOwn: true,
      });

      uniqueOtherActors.forEach((actor) => {
        const actorDiscoveries = Array.isArray(otherPlayerDiscoveriesByAuthId?.[actor.authId])
          ? otherPlayerDiscoveriesByAuthId[actor.authId].filter((entry) => entry?.plant_id === plant.id)
          : [];
        const sortedActorDiscoveries = [...actorDiscoveries].sort((a, b) => {
          const aIsFront = Boolean(a?.is_front_image || a?.is_species_front_image);
          const bIsFront = Boolean(b?.is_front_image || b?.is_species_front_image);
          if (aIsFront && !bIsFront) return -1;
          if (!aIsFront && bIsFront) return 1;
          return getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a);
        });
        const actorDiscovery = pickPreferredDiscovery(sortedActorDiscoveries);
        if (!actorDiscovery) return;
        const actorDefaultScanIndex = Math.max(
          0,
          sortedActorDiscoveries.findIndex((entry) => entry?.id === actorDiscovery.id)
        );
        discoveryVariants.push({
          key: `player-${actor.authId}-${plant.id}`,
          actor: { ...actor, isOwn: false },
          discoveries: sortedActorDiscoveries,
          defaultScanIndex: actorDefaultScanIndex,
          discovery: actorDiscovery,
          isOwn: false,
        });
      });
    }

    const defaultVariantIndex = friendEmail
      ? 0
      : Math.max(0, discoveryVariants.findIndex((variant) => variant.isOwn));

    return {
      ...plant,
      discovered: !!userDiscovery,
      userDiscovery: userDiscovery,
      allDiscoveries: sortedDiscoveries,
      discovery_date: userDiscovery ? userDiscovery.created_at : null,
      friendActors: uniqueOtherActors,
      friendDiscoveryCount: uniqueOtherActors.length,
      discoveryVariants,
      defaultVariantIndex,
    };
  });

  const { membershipsByPlantId } = useMemo(
    () =>
      buildCollectionMembershipIndex({
        plants: genusPlants,
        collectionItems: allCollectionItems,
        collections: visibleCollections,
        genera,
      }),
    [allCollectionItems, genera, genusPlants, visibleCollections]
  );

  const discoveredSpecies = genusPlants.filter(p => p.discovered);

  useEffect(() => {
    setActiveVariantIndexes((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      genusPlants.forEach((plant) => {
        if (typeof next[plant.id] !== "number") {
          next[plant.id] = plant.defaultVariantIndex || 0;
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [genusPlants]);

  useEffect(() => {
    setActiveScanIndexes((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      genusPlants.forEach((plant) => {
        if (typeof next[plant.id] !== "number") {
          const variants = Array.isArray(plant.discoveryVariants) ? plant.discoveryVariants : [];
          const variantIndex = Math.min(
            Math.max(typeof activeVariantIndexes[plant.id] === "number" ? activeVariantIndexes[plant.id] : (plant.defaultVariantIndex || 0), 0),
            Math.max(variants.length - 1, 0)
          );
          const variant = variants[variantIndex] || null;
          next[plant.id] = variant?.defaultScanIndex || 0;
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [genusPlants, activeVariantIndexes]);

  useEffect(() => {
    if (!targetDiscoveryId || deepLinkAppliedRef.current) return;
    if (!Array.isArray(genusPlants) || genusPlants.length === 0) return;

    const matchingPlant = genusPlants.find((plant) => {
      const inVariants = Array.isArray(plant.discoveryVariants) &&
        plant.discoveryVariants.some((variant) => variant?.discovery?.id === targetDiscoveryId);
      const inOwnDiscoveries = Array.isArray(plant.allDiscoveries) &&
        plant.allDiscoveries.some((entry) => entry?.id === targetDiscoveryId);
      return inVariants || inOwnDiscoveries;
    });
    if (!matchingPlant) return;

    const targetIndex = matchingPlant.discoveryVariants.findIndex((variant) => variant?.discovery?.id === targetDiscoveryId);
    const resolvedVariantIndex = targetIndex >= 0
      ? targetIndex
      : Math.max(0, matchingPlant.defaultVariantIndex || 0);

    setExpandedPlant(matchingPlant);
    setExpandedActiveVariantIndex(resolvedVariantIndex);
    const ownDiscoveryIndex = Math.max(
      0,
      (matchingPlant.allDiscoveries || []).findIndex((entry) => entry?.id === targetDiscoveryId)
    );
    setExpandedOwnScanIndex(ownDiscoveryIndex);
    setActiveVariantIndexes((prev) => ({
      ...prev,
      [matchingPlant.id]: resolvedVariantIndex,
    }));
    setActiveScanIndexes((prev) => ({
      ...prev,
      [matchingPlant.id]: ownDiscoveryIndex,
    }));
    deepLinkAppliedRef.current = true;
  }, [genusPlants, targetDiscoveryId]);

  // Removed myGenusImages calculation as it was only for the icon selection dialog

  // Hole das Gattungsbild: Front-Image bevorzugt, sonst neuestes
  const genusDiscoveries = userDiscoveries.filter(d => {
    const plant = plants.find(p => p.id === d.plant_id);
    return plant && selectedGenus && 
           plant.genus_category === selectedGenus.category && 
           plant.genus_number === selectedGenus.category_dex_number && 
           d.image_url;
  });
  const genusIconUrl =
    genusDiscoveries.find((d) => d.is_front_image)?.image_url ||
    genusDiscoveries.find((d) => d.is_species_front_image)?.image_url ||
    [...genusDiscoveries].sort((a, b) => getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a))[0]?.image_url;

  useEffect(() => {
    return () => {
      clearPlantLongPress();
      Object.values(variantResetTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      variantResetTimersRef.current = {};
    };
  }, []);

  const getRarityBorderColor = (plant) =>
    getRarityBorderClass(
      plant?.red_list_population ?? plant?.aiData?.red_list_population ?? null,
      isLightUi
    );

  const friendProfileLogoAssets = resolveEquippedLogoAssetsWithCatalog(friendProfile || {}, logoAssets);

  const openFriendProfile = (actor) => {
    const email = String(actor?.email || "").trim();
    if (!email) return;
    setOpenFriendTooltipKey(null);
    navigate(createPageUrl(`FriendProfile?email=${encodeURIComponent(email)}`));
  };

  const expandedPlantData = expandedPlant
    ? (genusPlants.find((plant) => plant.id === expandedPlant.id) || expandedPlant)
    : null;

  const expandedVariants = Array.isArray(expandedPlantData?.discoveryVariants)
    ? expandedPlantData.discoveryVariants
    : [];
  const safeExpandedVariantIndex = Math.min(
    Math.max(expandedActiveVariantIndex || 0, 0),
    Math.max(expandedVariants.length - 1, 0)
  );
  const activeExpandedVariant = expandedVariants[safeExpandedVariantIndex] || null;
  const expandedVariantDiscoveries = Array.isArray(activeExpandedVariant?.discoveries)
    ? activeExpandedVariant.discoveries
    : Array.isArray(expandedPlantData?.allDiscoveries)
      ? expandedPlantData.allDiscoveries
      : [];
  const expandedOwnDiscoveries = expandedVariantDiscoveries;
  const activeExpandedFriendActor = activeExpandedVariant && !activeExpandedVariant.isOwn
    ? activeExpandedVariant.actor || null
    : null;
  const safeExpandedOwnScanIndex = Math.min(
    Math.max(expandedOwnScanIndex || 0, 0),
    Math.max(expandedOwnDiscoveries.length - 1, 0)
  );
  const activeExpandedDiscovery = expandedOwnDiscoveries[safeExpandedOwnScanIndex] || null;
  const activeExpandedLikeCount = activeExpandedDiscovery?.id
    ? (likeCountByDiscoveryId.get(activeExpandedDiscovery.id) || 0)
    : 0;
  const activeExpandedLikedByUser = activeExpandedDiscovery?.id
    ? likedDiscoveryIdSet.has(activeExpandedDiscovery.id)
    : false;
  const activeExpandedDiscoveryDate = (() => {
    const rawDate = activeExpandedDiscovery?.discovered_date;
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();
  const expandedConservation = expandedPlantData
    ? getConservationFromPlant(expandedPlantData)
    : null;
  const expandedConservationEffectLevel = expandedConservation
    ? getConservationEffectLevel(
      expandedConservation.threatRaw,
      expandedConservation.populationRaw
    )
    : 0;
  const expandedThreatAnimationClass = expandedConservation
    ? getThreatAnimationClass(
      expandedConservation.threatRaw,
      expandedConservation.populationRaw
    )
    : "";
  const expandedThreatGlowClass = expandedConservationEffectLevel >= 4 ? "threat-glow-border" : "";
  const expandedRarityGlowColor = expandedConservation
    ? getRarityGlowColor(expandedConservation.populationRaw)
    : null;

  const clearVariantResetTimer = (timerKey) => {
    if (!timerKey) return;
    if (variantResetTimersRef.current[timerKey]) {
      window.clearTimeout(variantResetTimersRef.current[timerKey]);
      delete variantResetTimersRef.current[timerKey];
    }
  };

  const isClearHorizontalSwipe = (deltaX, deltaY, thresholdPx, dominanceRatio) => {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    return absDeltaX >= thresholdPx && absDeltaX >= absDeltaY * dominanceRatio;
  };

  const scheduleVariantReset = ({ timerKey, plantId, defaultIndex, updateExpanded }) => {
    if (!timerKey || typeof plantId === "undefined") return;
    if (friendEmail) {
      clearVariantResetTimer(timerKey);
      return;
    }
    clearVariantResetTimer(timerKey);
    variantResetTimersRef.current[timerKey] = window.setTimeout(() => {
      setActiveVariantIndexes((prev) => ({
        ...prev,
        [plantId]: defaultIndex,
      }));

      if (updateExpanded && expandedPlantData?.id === plantId) {
        setExpandedActiveVariantIndex(defaultIndex);
      }
    }, VARIANT_RESET_TIMEOUT_MS);
  };

  const cyclePlantVariant = ({ plant, direction, updateExpanded = false }) => {
    const variants = Array.isArray(plant?.discoveryVariants) ? plant.discoveryVariants : [];
    if (variants.length <= 1) return;

    const currentIndex = updateExpanded
      ? safeExpandedVariantIndex
      : (typeof activeVariantIndexes[plant.id] === "number" ? activeVariantIndexes[plant.id] : (plant.defaultVariantIndex || 0));

    const nextIndex = direction === "left"
      ? (currentIndex + 1) % variants.length
      : (currentIndex - 1 + variants.length) % variants.length;

    setActiveVariantIndexes((prev) => ({
      ...prev,
      [plant.id]: nextIndex,
    }));

    const nextVariant = variants[nextIndex] || null;
    setActiveScanIndexes((prev) => ({
      ...prev,
      [plant.id]: nextVariant?.defaultScanIndex || 0,
    }));

    if (updateExpanded) {
      setExpandedActiveVariantIndex(nextIndex);
      return;
    }

    scheduleVariantReset({
      timerKey: `list:${plant.id}`,
      plantId: plant.id,
      defaultIndex: plant.defaultVariantIndex || 0,
      updateExpanded: false,
    });
  };

  const cyclePlantScan = ({ plantId, discoveries, direction, updateExpanded = false }) => {
    const list = Array.isArray(discoveries) ? discoveries : [];
    if (list.length <= 1) return;

    const currentIndex = updateExpanded
      ? safeExpandedOwnScanIndex
      : Math.max(typeof activeScanIndexes[plantId] === "number" ? activeScanIndexes[plantId] : 0, 0);

    const nextIndex = direction === "left"
      ? (currentIndex + 1) % list.length
      : (currentIndex - 1 + list.length) % list.length;

    if (updateExpanded) {
      setExpandedOwnScanIndex(nextIndex);
      return;
    }

    setActiveScanIndexes((prev) => ({
      ...prev,
      [plantId]: nextIndex,
    }));

    // Any manual swipe interaction should keep the current friend-view selection stable.
    clearVariantResetTimer(`list:${plantId}`);
  };

  useEffect(() => {
    if (!friendEmail) return;
    Object.keys(variantResetTimersRef.current).forEach((timerKey) => {
      clearVariantResetTimer(timerKey);
    });
  }, [friendEmail]);

  const clearPlantLongPress = () => {
    if (plantLongPressTimerRef.current) {
      window.clearTimeout(plantLongPressTimerRef.current);
      plantLongPressTimerRef.current = null;
    }
    plantLongPressStartPointRef.current = null;
    plantLongPressMovementCancelledRef.current = false;
  };

  const resetPlantDrag = (plantId) => {
    if (!plantId) return;
    plantDragStartXRef.current[plantId] = null;
    delete plantDragStartPointRef.current[plantId];
    delete plantDragActivatedRef.current[plantId];
    setPlantDragOffsets((prev) => {
      if (!(plantId in prev)) return prev;
      const next = { ...prev };
      delete next[plantId];
      return next;
    });
  };

  const resetExpandedDrag = () => {
    expandedDragStartXRef.current = null;
    expandedDragStartPointRef.current = null;
    expandedDragActivatedRef.current = false;
    setExpandedDragOffset(null);
  };

  const clampDragOffset = (deltaX) => Math.max(-88, Math.min(88, deltaX));

  const updatePlantDrag = (plant, clientX, clientY) => {
    if (!plant?.id || typeof clientX !== "number") return;
    const startPoint = plantDragStartPointRef.current[plant.id];
    const startX = typeof startPoint?.x === "number" ? startPoint.x : plantDragStartXRef.current[plant.id];
    const startY = typeof startPoint?.y === "number" ? startPoint.y : null;
    if (typeof startX !== "number") return;

    const deltaX = clientX - startX;
    const absDeltaX = Math.abs(deltaX);
    const deltaY = typeof startY === "number" && typeof clientY === "number" ? clientY - startY : 0;
    const absDeltaY = Math.abs(deltaY);

    const isActive = !!plantDragActivatedRef.current[plant.id];
    if (!isActive) {
      const hasEnoughHorizontalMovement = absDeltaX >= LIST_DRAG_INTENT_THRESHOLD_PX;
      const hasHorizontalDominance = absDeltaX >= absDeltaY * LIST_SWIPE_DOMINANCE_RATIO;
      if (!hasEnoughHorizontalMovement || !hasHorizontalDominance) {
        return;
      }
      plantDragActivatedRef.current[plant.id] = true;
    }

    const direction = deltaX < 0 ? -1 : 1;
    const dragBeyondIntent = Math.max(0, absDeltaX - LIST_DRAG_INTENT_THRESHOLD_PX);
    const visualOffset = direction * (LIST_DRAG_SNAP_OFFSET_PX + dragBeyondIntent * 0.65);

    setPlantDragOffsets((prev) => ({
      ...prev,
      [plant.id]: clampDragOffset(visualOffset),
    }));
  };

  const finishPlantDrag = (plant, clientX, clientY) => {
    if (!plant?.id) return;
    const startPoint = plantDragStartPointRef.current[plant.id];
    const startX = typeof startPoint?.x === "number" ? startPoint.x : plantDragStartXRef.current[plant.id];
    const startY = typeof startPoint?.y === "number" ? startPoint.y : null;
    const endX = typeof clientX === "number" ? clientX : null;
    const endY = typeof clientY === "number" ? clientY : null;
    const deltaX = typeof startX === "number" && endX !== null ? endX - startX : 0;
    const deltaY = typeof startY === "number" && endY !== null ? endY - startY : 0;
    const wasDragActivated = !!plantDragActivatedRef.current[plant.id];
    const shouldSwipe = isClearHorizontalSwipe(
      deltaX,
      deltaY,
      LIST_SWIPE_THRESHOLD_PX,
      LIST_SWIPE_DOMINANCE_RATIO
    ) && wasDragActivated;

    if (shouldSwipe) {
      plantSwipeTriggeredRef.current[plant.id] = true;
      cyclePlantVariant({
        plant,
        direction: deltaX < 0 ? "left" : "right",
        updateExpanded: false,
      });
    }

    resetPlantDrag(plant.id);
  };

  const updateExpandedDrag = (clientX, clientY) => {
    if (typeof clientX !== "number") return;
    const startPoint = expandedDragStartPointRef.current;
    const startX = typeof startPoint?.x === "number" ? startPoint.x : expandedDragStartXRef.current;
    const startY = typeof startPoint?.y === "number" ? startPoint.y : null;
    if (typeof startX !== "number") return;

    const deltaX = clientX - startX;
    const absDeltaX = Math.abs(deltaX);
    const deltaY = typeof startY === "number" && typeof clientY === "number" ? clientY - startY : 0;
    const absDeltaY = Math.abs(deltaY);

    if (!expandedDragActivatedRef.current) {
      if (absDeltaX < EXPANDED_SWIPE_THRESHOLD_PX * 0.4 || absDeltaX < absDeltaY * EXPANDED_SWIPE_DOMINANCE_RATIO) {
        return;
      }
      expandedDragActivatedRef.current = true;
    }

    const direction = deltaX < 0 ? -1 : 1;
    const dragBeyondIntent = Math.max(0, absDeltaX - EXPANDED_SWIPE_THRESHOLD_PX * 0.4);
    const visualOffset = direction * Math.min(88, EXPANDED_SWIPE_THRESHOLD_PX * 0.25 + dragBeyondIntent * 0.7);
    setExpandedDragOffset(visualOffset);
  };

  const finishExpandedDrag = (clientX, clientY) => {
    const startPoint = expandedDragStartPointRef.current;
    const startX = typeof startPoint?.x === "number" ? startPoint.x : expandedDragStartXRef.current;
    const startY = typeof startPoint?.y === "number" ? startPoint.y : null;
    const endX = typeof clientX === "number" ? clientX : null;
    const endY = typeof clientY === "number" ? clientY : null;
    const deltaX = typeof startX === "number" && endX !== null ? endX - startX : 0;
    const deltaY = typeof startY === "number" && endY !== null ? endY - startY : 0;
    const shouldSwipe = isClearHorizontalSwipe(
      deltaX,
      deltaY,
      EXPANDED_SWIPE_THRESHOLD_PX,
      EXPANDED_SWIPE_DOMINANCE_RATIO
    ) && expandedDragActivatedRef.current;

    if (shouldSwipe) {
      expandedSwipeTriggeredRef.current = true;
      cyclePlantScan({
        plantId: expandedPlantData?.id,
        discoveries: expandedOwnDiscoveries,
        direction: deltaX < 0 ? "left" : "right",
        updateExpanded: true,
      });
    }

    resetExpandedDrag();
  };

  const handlePlantLongPressStart = (plant, clientX = null, clientY = null) => {
    if (currentUser?.role !== "admin") return;

    clearPlantLongPress();
    plantLongPressTriggeredRef.current = false;
    plantLongPressMovementCancelledRef.current = false;
    if (typeof clientX === "number" && typeof clientY === "number") {
      plantLongPressStartPointRef.current = { x: clientX, y: clientY };
    }
    plantLongPressTimerRef.current = window.setTimeout(() => {
      if (plantLongPressMovementCancelledRef.current) return;
      plantLongPressTriggeredRef.current = true;
      setEditingPlant(plant);
    }, 3000);
  };

  const handlePlantLongPressMove = (clientX = null, clientY = null) => {
    if (currentUser?.role !== "admin") return;
    if (!plantLongPressTimerRef.current || !plantLongPressStartPointRef.current) return;
    if (typeof clientX !== "number" || typeof clientY !== "number") return;

    const deltaX = Math.abs(clientX - plantLongPressStartPointRef.current.x);
    const deltaY = Math.abs(clientY - plantLongPressStartPointRef.current.y);
    const movementThresholdPx = 8;

    if (deltaX > movementThresholdPx || deltaY > movementThresholdPx) {
      plantLongPressMovementCancelledRef.current = true;
      clearPlantLongPress();
    }
  };

  const getLighterColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
    const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
    const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getDarkerColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.floor(parseInt(match[1]) * 0.6);
    const g = Math.floor(parseInt(match[2]) * 0.6);
    const b = Math.floor(parseInt(match[3]) * 0.6);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Bestimme Zurück-URL basierend auf Kontext
  const backUrl = friendEmail 
    ? createPageUrl(`FriendCollection?email=${encodeURIComponent(friendEmail)}`)
    : createPageUrl("Home");
  const backLabel = friendEmail ? "Zurück zum Freundes-PlantDex" : "Zurück zur Sammlung";
  const backState = friendEmail
    ? null
    : {
        activePanel: "collection",
        collectionId: collectionId || "global",
      };
  const handleBackClick = () => {
    if (friendEmail) {
      navigate(backUrl);
      return;
    }

    navigate(backUrl, { state: backState });
  };

  if (generaLoading || plantsLoading || discoveriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!genus) {
    // Determine the correct back URL even if genus is not found
    const notFoundBackUrl = friendEmail
      ? createPageUrl(`FriendCollection?email=${encodeURIComponent(friendEmail)}`)
      : createPageUrl("Collection");
    const notFoundBackLabel = friendEmail ? "Zurück zum Freundes-Floralog" : "Zurück zur Sammlung";

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 mb-4">Gattung nicht gefunden</p>
        <Button onClick={() => navigate(notFoundBackUrl)}>
          {notFoundBackLabel}
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-4 md:p-8"
      style={{
        background: averageColor 
          ? (isLightUi
            ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
            : `linear-gradient(135deg, ${getDarkerColor(averageColor)} 0%, ${averageColor} 55%, ${getLighterColor(averageColor)} 100%)`)
          : (isLightUi
            ? 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
            : 'linear-gradient(to bottom right, rgb(17, 24, 21), rgb(24, 34, 29))')
      }}
    >
      <MobileBackButton backUrl={backUrl} backState={backState} />
      
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={handleBackClick}
          className={"mb-6 font-semibold shadow-sm border hidden md:inline-flex " + (isLightUi
            ? "bg-white hover:bg-stone-50 text-stone-900 border-stone-200"
            : "bg-black/45 hover:bg-black/60 text-stone-100 border-[#f0e5a5]/35")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        {/* Header Card */}
        <Card className={"mb-6 border-2 shadow-md overflow-hidden " + (isLightUi
          ? "border-amber-200 bg-white"
          : "border-[#f0e5a5]/35 bg-black/40 backdrop-blur-sm")}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Bild links - größer und klickbar */}
              <div className="flex-shrink-0">
                {genusIconUrl ? (
                  <img
                    src={genusIconUrl}
                    alt={genus.genus_name}
                    onClick={() => setEnlargedImage(genusIconUrl)}
                    className={"w-28 h-28 md:w-32 md:h-32 object-cover rounded-xl shadow-md border-2 cursor-pointer hover:opacity-90 transition-opacity " + (isLightUi ? "border-stone-200" : "border-stone-700/70")}
                  />
                ) : (
                  <div className={"w-28 h-28 md:w-32 md:h-32 rounded-xl flex items-center justify-center border-2 " + (isLightUi
                    ? "bg-gradient-to-br from-stone-100 to-stone-200 border-stone-200"
                    : "bg-gradient-to-br from-stone-800/90 to-stone-900 border-stone-700/70")}>
                    <Leaf className={"w-12 h-12 " + (isLightUi ? "text-stone-400" : "text-stone-500")} />
                  </div>
                )}
              </div>
              
              {/* Info rechts */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={"font-bold text-xs px-2 py-0.5 " + (isLightUi ? "bg-stone-800 text-white" : "bg-[#f0e5a5]/20 text-[#f8f1c8] border border-[#f0e5a5]/30")}>
                    {genus.category === "Bäume" && "🌳"}
                    {genus.category === "Sträucher" && "🌿"}
                    {genus.category === "Blumen & Kräuter" && "🌸"}
                    #{String(genus.category_dex_number).padStart(3, '0')}
                  </Badge>
                  <Badge className={"text-xs px-2 py-0.5 " + (isLightUi ? "bg-green-600 text-white" : "bg-emerald-600/30 text-emerald-200 border border-emerald-400/35")}>
                    {discoveredSpecies.length}/{genusPlants.length}
                  </Badge>
                </div>
                <h1 className={"text-xl md:text-2xl font-bold " + (isLightUi ? "text-stone-900" : "text-[#f8f4d6]")}>
                  {genus.genus_name}
                </h1>
                <p className={"text-sm italic mb-2 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
                  {genus.scientific_genus}
                </p>
                {genus.family && (
                  <Badge variant="outline" className={"text-xs " + (isLightUi ? "" : "border-stone-500 text-stone-200")}>{genus.family}</Badge>
                )}
              </div>
            </div>
            
            {genus.description && (
              <p className={"text-sm mt-3 " + (isLightUi ? "text-stone-600" : "text-stone-300")}>{genus.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Bild-Vollansicht Modal */}
        {enlargedImage && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setEnlargedImage(null)}
          >
            <img 
              src={enlargedImage} 
              alt="Vergrößerte Ansicht"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}

        {/* Icon Selection Dialog and related button are removed */}

        {/* Species Cards - Kompakt, klickbar für Vollansicht */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genusPlants.map((plant) => {
            const variants = Array.isArray(plant.discoveryVariants) ? plant.discoveryVariants : [];
            const defaultIndex = plant.defaultVariantIndex || 0;
            const activeIndex = Math.min(
              Math.max(typeof activeVariantIndexes[plant.id] === "number" ? activeVariantIndexes[plant.id] : defaultIndex, 0),
              Math.max(variants.length - 1, 0)
            );
            const activeVariant = variants[activeIndex] || null;
            const activeVariantDiscoveries = Array.isArray(activeVariant?.discoveries) ? activeVariant.discoveries : [];
            const defaultScanIndex = activeVariant?.defaultScanIndex || 0;
            const activeScanIndex = Math.min(
              Math.max(typeof activeScanIndexes[plant.id] === "number" ? activeScanIndexes[plant.id] : defaultScanIndex, 0),
              Math.max(activeVariantDiscoveries.length - 1, 0)
            );
            const activeDiscovery = activeVariantDiscoveries[activeScanIndex] || activeVariant?.discovery || null;
            const activeLikeCount = activeDiscovery?.id ? (likeCountByDiscoveryId.get(activeDiscovery.id) || 0) : 0;
            const activeLikedByUser = activeDiscovery?.id ? likedDiscoveryIdSet.has(activeDiscovery.id) : false;
            const showStack = variants.length > 1;
            const orderedPreviewImages = activeVariantDiscoveries.length > 0
              ? Array.from({ length: activeVariantDiscoveries.length }, (_, offset) => {
                  const cyclicIndex = (activeScanIndex + offset) % activeVariantDiscoveries.length;
                  return activeVariantDiscoveries[cyclicIndex]?.image_url || null;
                }).filter(Boolean)
              : (activeDiscovery?.image_url ? [activeDiscovery.image_url] : []);
            const conservation = getConservationFromPlant(plant);
            const conservationEffectLevel = getConservationEffectLevel(
              conservation.threatRaw,
              conservation.populationRaw
            );
            const threatAnimationClass = getThreatAnimationClass(
              conservation.threatRaw,
              conservation.populationRaw
            );
            const threatGlowClass = conservationEffectLevel >= 4 ? "threat-glow-border" : "";
            const rarityGlowColor = getRarityGlowColor(conservation.populationRaw);
            const dragStyle = plantDragOffsets[plant.id] != null
              ? {
                  transform: `translateX(${plantDragOffsets[plant.id]}px) rotate(${plantDragOffsets[plant.id] / 30}deg)`,
                  transition: "none",
                  willChange: "transform",
                }
              : {};

            return (
            <Card
              key={plant.id}
              onClick={() => {
                if (plantLongPressTriggeredRef.current || plantSwipeTriggeredRef.current[plant.id]) {
                  plantLongPressTriggeredRef.current = false;
                  plantSwipeTriggeredRef.current[plant.id] = false;
                  return;
                }
                setExpandedPlant(plant);
                setExpandedActiveVariantIndex(activeIndex);
                setExpandedOwnScanIndex(activeScanIndex);
              }}
              onMouseDown={(event) => {
                plantDragStartXRef.current[plant.id] = event.clientX;
                plantDragStartPointRef.current[plant.id] = { x: event.clientX, y: event.clientY };
                plantDragActivatedRef.current[plant.id] = false;
              }}
              onMouseMove={(event) => {
                if (event.buttons !== 1) return;
                updatePlantDrag(plant, event.clientX, event.clientY);
              }}
              onMouseUp={(event) => {
                clearPlantLongPress();
                finishPlantDrag(plant, event.clientX, event.clientY);
              }}
              onMouseLeave={() => {
                clearPlantLongPress();
                resetPlantDrag(plant.id);
              }}
              onTouchStart={(event) => {
                const touch = event.changedTouches?.[0] ?? null;
                const startX = touch?.clientX ?? null;
                plantTouchStartXRef.current[plant.id] = startX;
                plantDragStartXRef.current[plant.id] = startX;
                plantDragStartPointRef.current[plant.id] = {
                  x: touch?.clientX ?? 0,
                  y: touch?.clientY ?? 0,
                };
                plantDragActivatedRef.current[plant.id] = false;
                plantSwipeTriggeredRef.current[plant.id] = false;
              }}
              onTouchMove={(event) => {
                updatePlantDrag(
                  plant,
                  event.touches?.[0]?.clientX ?? null,
                  event.touches?.[0]?.clientY ?? null
                );
              }}
              onTouchEnd={(event) => {
                clearPlantLongPress();
                const endX = event.changedTouches?.[0]?.clientX ?? null;
                const endY = event.changedTouches?.[0]?.clientY ?? null;
                plantTouchStartXRef.current[plant.id] = null;
                finishPlantDrag(plant, endX, endY);
              }}
              onTouchCancel={() => {
                clearPlantLongPress();
                plantTouchStartXRef.current[plant.id] = null;
                resetPlantDrag(plant.id);
              }}
              style={{
                ...dragStyle,
                "--threat-glow-color": rarityGlowColor,
              }}
              className={`relative border shadow-sm transition-all duration-300 overflow-hidden cursor-pointer ${threatAnimationClass} ${threatGlowClass} ${
                plant.discovered
                  ? `${getRarityBorderColor(plant)} hover:shadow-md ${isLightUi ? 'bg-white' : 'bg-black/40'}`
                  : (isLightUi ? 'border-stone-200 bg-stone-50 hover:bg-white' : 'border-stone-700/60 bg-black/30 hover:bg-black/40')
              }`}
            >
              <ThreatLevelSparks active={conservationEffectLevel >= 3} count={20} className="z-40" />
              <CardContent className="p-3 relative z-20">
                <div className="space-y-2">
                  <SpeciesInfoCard
                    plant={{ ...plant, image_url: activeDiscovery?.image_url || null }}
                    imageUrl={activeDiscovery?.image_url || null}
                    isLightUi={isLightUi}
                    compact={true}
                    showNarrative={true}
                    disableThreatEffects={true}
                    previewStackImages={orderedPreviewImages}
                    onPreviewSwipeLeft={() => {
                      plantSwipeTriggeredRef.current[plant.id] = true;
                      cyclePlantScan({
                        plantId: plant.id,
                        discoveries: activeVariantDiscoveries,
                        direction: "left",
                        updateExpanded: false,
                      });
                    }}
                    onPreviewSwipeRight={() => {
                      plantSwipeTriggeredRef.current[plant.id] = true;
                      cyclePlantScan({
                        plantId: plant.id,
                        discoveries: activeVariantDiscoveries,
                        direction: "right",
                        updateExpanded: false,
                      });
                    }}
                    titlePrefix={
                      plant.discovered ? (
                        <CheckCircle2 className={"w-4 h-4 flex-shrink-0 " + (isLightUi ? "text-green-600" : "text-emerald-300")} />
                      ) : (
                        <HelpCircle className={"w-4 h-4 flex-shrink-0 " + (isLightUi ? "text-stone-500" : "text-stone-300")} />
                      )
                    }
                    topRight={
                      activeVariant && !activeVariant.isOwn ? (
                        <div
                          className="w-8 h-8 rounded-full overflow-hidden bg-black/35 ring-2 ring-white/20"
                          title={activeVariant.actor?.name || activeVariant.actor?.email || "Spieler"}
                        >
                          <CustomLogoAvatar
                            logoAssets={activeVariant.actor?.logoAssets}
                            className="w-full h-full"
                            tooltipText={activeVariant.actor?.name || activeVariant.actor?.email || "Spieler"}
                            fallbackText={(activeVariant.actor?.name || activeVariant.actor?.email || "?").charAt(0).toUpperCase()}
                            fallbackClassName="text-xs font-bold text-white"
                          />
                        </div>
                      ) : null
                    }
                  />
                  <div
                    className="space-y-1"
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                  >
                    <div className="flex flex-wrap gap-1">
                      {(membershipsByPlantId[plant.id] || []).slice(0, 4).map((entry) => (
                        <Badge
                          key={`${plant.id}-${entry.id}`}
                          className={"text-[10px] px-1.5 py-0 " + (isLightUi
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-emerald-900/45 text-emerald-100 border border-emerald-300/35")}
                        >
                          {entry.title}
                        </Badge>
                      ))}
                      {(membershipsByPlantId[plant.id] || []).length > 4 && (
                        <Badge className={"text-[10px] px-1.5 py-0 " + (isLightUi
                          ? "bg-stone-100 text-stone-700 border border-stone-200"
                          : "bg-black/45 text-stone-200 border border-stone-500/45")}
                        >
                          +{(membershipsByPlantId[plant.id] || []).length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {Array.isArray(plant.friendActors) && plant.friendActors.length > 0 && (
                        <div
                          className="flex items-center gap-1 min-w-0 overflow-x-auto pr-1 justify-start"
                          title="Spieler mit Scan dieser Pflanze"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onTouchEnd={(event) => event.stopPropagation()}
                        >
                          {plant.friendActors.map((actor, actorIndex) => {
                            const activeActorAuthId = activeVariant?.actor?.authId || null;
                            const activeActorEmail = String(activeVariant?.actor?.email || "").toLowerCase();
                            const actorEmail = String(actor.email || "").toLowerCase();
                            const isActiveVariantActor = Boolean(
                              (activeActorAuthId && actor.authId === activeActorAuthId) ||
                              (activeActorEmail && actorEmail && activeActorEmail === actorEmail)
                            );

                            return (
                            <TooltipProvider key={actor.authId || actor.email || actorIndex}>
                              <Tooltip
                                open={openFriendTooltipKey === `${plant.id}:${actor.authId || actor.email || actorIndex}`}
                                onOpenChange={(isOpen) => {
                                  if (isOpen) {
                                    setOpenFriendTooltipKey(`${plant.id}:${actor.authId || actor.email || actorIndex}`);
                                  } else if (openFriendTooltipKey === `${plant.id}:${actor.authId || actor.email || actorIndex}`) {
                                    setOpenFriendTooltipKey(null);
                                  }
                                }}
                              >
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className={`${isActiveVariantActor ? "w-7 h-7 ring-2 ring-emerald-400/70 border-white/60" : "w-5 h-5 border-white/20"} rounded-full overflow-hidden bg-black/35 border shrink-0 transition-all duration-200`}
                                    title={actor.name || actor.email || "Spieler"}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      const key = `${plant.id}:${actor.authId || actor.email || actorIndex}`;
                                      setOpenFriendTooltipKey((prev) => (prev === key ? null : key));
                                    }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onTouchStart={(event) => event.stopPropagation()}
                                    onTouchEnd={(event) => event.stopPropagation()}
                                  >
                                    <CustomLogoAvatar
                                      logoAssets={actor.logoAssets}
                                      className="w-full h-full"
                                      tooltipText={actor.name || actor.email || "Spieler"}
                                      fallbackText={(actor.name || actor.email || "?").charAt(0).toUpperCase()}
                                      fallbackClassName="text-[9px] font-bold text-white"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className={"p-0 border-0 bg-transparent shadow-none"}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className={"rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm " + (isLightUi
                                      ? "border-stone-300 bg-white text-stone-800"
                                      : "border-stone-500/70 bg-black/85 text-stone-100")}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openFriendProfile(actor);
                                    }}
                                  >
                                    {actor.name || actor.email || "Spieler"}
                                  </button>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            );
                          })}
                        </div>
                      )}
                    </div>
                      {activeDiscovery && (
                        <div
                          className={"inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[10px] shrink-0 " + (activeLikeCount > 0
                            ? (activeLikedByUser
                              ? (isLightUi ? "border-rose-300 bg-rose-50 text-rose-600" : "border-rose-400/60 bg-rose-400/15 text-rose-200")
                              : (isLightUi ? "border-rose-200 bg-white/90 text-rose-500" : "border-rose-300/45 bg-black/60 text-rose-200"))
                            : (isLightUi ? "border-stone-300 bg-white/90 text-stone-400" : "border-stone-500/70 bg-black/60 text-stone-300"))}
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onTouchEnd={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!activeDiscovery?.id || !currentUser?.email) return;
                              toggleScanLikeMutation.mutate({
                                discoveryId: activeDiscovery.id,
                                nextLiked: !activeLikedByUser,
                              });
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            onTouchEnd={(event) => event.stopPropagation()}
                            aria-label={activeLikedByUser ? "Like entfernen" : "Scan liken"}
                            disabled={toggleScanLikeMutation.isPending || !currentUser?.email}
                          >
                            <Heart className={"w-3 h-3 " + (activeLikedByUser ? "fill-current" : "")} />
                          </button>
                          <span>{activeLikeCount || 0}</span>
                        </div>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>

        {/* Erweiterte Pflanzen-Ansicht Modal */}
        {expandedPlantData && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 overflow-y-auto"
            onClick={() => setExpandedPlant(null)}
          >
            <div className="min-h-full flex items-start justify-center py-8 px-4">
            <div 
              className={`relative overflow-hidden rounded-2xl max-w-lg w-full border ${expandedThreatAnimationClass} ${expandedThreatGlowClass} ${expandedPlantData ? getRarityBorderColor(expandedPlantData) : (isLightUi ? "border-stone-200" : "border-[#f0e5a5]/25")} ${isLightUi ? "bg-white" : "bg-[#141916]"}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(event) => {
                expandedDragStartXRef.current = event.clientX;
                expandedDragStartPointRef.current = { x: event.clientX, y: event.clientY };
                expandedDragActivatedRef.current = false;
              }}
              onMouseMove={(event) => {
                if (event.buttons !== 1) return;
                updateExpandedDrag(event.clientX, event.clientY);
              }}
              onMouseUp={(event) => {
                finishExpandedDrag(event.clientX, event.clientY);
              }}
              onMouseLeave={() => {
                resetExpandedDrag();
              }}
              onTouchStart={(event) => {
                const touch = event.changedTouches?.[0] ?? null;
                const startX = touch?.clientX ?? null;
                expandedTouchStartXRef.current = startX;
                expandedDragStartXRef.current = startX;
                expandedDragStartPointRef.current = {
                  x: touch?.clientX ?? 0,
                  y: touch?.clientY ?? 0,
                };
                expandedDragActivatedRef.current = false;
                expandedSwipeTriggeredRef.current = false;
              }}
              onTouchMove={(event) => {
                updateExpandedDrag(
                  event.touches?.[0]?.clientX ?? null,
                  event.touches?.[0]?.clientY ?? null
                );
              }}
              onTouchEnd={(event) => {
                const endX = event.changedTouches?.[0]?.clientX ?? null;
                const endY = event.changedTouches?.[0]?.clientY ?? null;
                expandedTouchStartXRef.current = null;
                finishExpandedDrag(endX, endY);
              }}
              onTouchCancel={() => {
                expandedTouchStartXRef.current = null;
                resetExpandedDrag();
              }}
              style={expandedDragOffset != null ? {
                transform: `translateX(${expandedDragOffset}px) rotate(${expandedDragOffset / 34}deg)`,
                transition: "none",
                willChange: "transform",
                "--threat-glow-color": expandedRarityGlowColor || "rgba(239, 68, 68, 0.82)",
              } : {
                "--threat-glow-color": expandedRarityGlowColor || "rgba(239, 68, 68, 0.82)",
              }}
            >
              <ThreatLevelSparks active={expandedConservationEffectLevel >= 3} count={22} className="z-40" />
              {/* Großes Bild */}
              <div className="relative z-20">
                {activeExpandedDiscovery?.image_url ? (
                  <img
                    src={activeExpandedDiscovery.image_url}
                    alt={expandedPlantData.species_name}
                    className="w-full aspect-square object-cover rounded-t-2xl"
                  />
                ) : (
                  <div className={"w-full aspect-square rounded-t-2xl flex items-center justify-center " + (isLightUi
                    ? "bg-gradient-to-br from-stone-100 to-stone-200"
                    : "bg-gradient-to-br from-stone-800/90 to-stone-900/95")}>
                    <Leaf className={"w-20 h-20 " + (isLightUi ? "text-stone-400" : "text-stone-500")} />
                  </div>
                )}

                <button
                  onClick={() => setExpandedPlant(null)}
                  className="absolute top-3 right-3 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {(friendEmail ? !!friendProfile : !!activeExpandedFriendActor) && (
                  <div className="absolute top-3 left-3 w-14 h-14 rounded-full overflow-hidden shadow-lg bg-black/25">
                    <CustomLogoAvatar
                      logoAssets={friendEmail ? friendProfileLogoAssets : activeExpandedFriendActor?.logoAssets}
                      className="w-full h-full"
                      tooltipText={friendEmail
                        ? (friendProfile?.display_name || friendProfile?.user_email || "Spieler")
                        : (activeExpandedFriendActor?.name || activeExpandedFriendActor?.email || "Spieler")}
                      fallbackText={friendEmail
                        ? (friendProfile?.display_name || friendProfile?.user_email || "?").charAt(0).toUpperCase()
                        : (activeExpandedFriendActor?.name || activeExpandedFriendActor?.email || "?").charAt(0).toUpperCase()}
                      fallbackClassName="text-xl font-bold text-white"
                    />
                  </div>
                )}

                {/* Herz nur für Freundes-Scans (unten links), Stern+Löschen für eigene (unten links/rechts) */}

                {/* Bild-Navigation */}
                {expandedOwnDiscoveries.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cyclePlantScan({
                            plantId: expandedPlantData?.id,
                            discoveries: expandedOwnDiscoveries,
                            direction: "right",
                            updateExpanded: true,
                          });
                        }}
                        className={"absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg " + (isLightUi
                          ? "bg-white/90 hover:bg-white"
                          : "bg-black/65 hover:bg-black/80")}
                      >
                        <ChevronLeft className={"w-6 h-6 " + (isLightUi ? "text-stone-700" : "text-stone-100")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cyclePlantScan({
                            plantId: expandedPlantData?.id,
                            discoveries: expandedOwnDiscoveries,
                            direction: "left",
                            updateExpanded: true,
                          });
                        }}
                        className={"absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg " + (isLightUi
                          ? "bg-white/90 hover:bg-white"
                          : "bg-black/65 hover:bg-black/80")}
                      >
                        <ChevronRight className={"w-6 h-6 " + (isLightUi ? "text-stone-700" : "text-stone-100")} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                        {(safeExpandedOwnScanIndex || 0) + 1} / {expandedOwnDiscoveries.length}
                      </div>
                    </>
                  )}

                {/* Aktionen je nach Variante: eigener Scan → Stern + Löschen; Freundes-Scan → Herz */}
                {(activeExpandedVariant?.isOwn ?? !friendEmail) && activeExpandedDiscovery ? (
                  <>
                    {genusDiscoveries.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFrontImageMutation.mutate({ discoveryId: activeExpandedDiscovery.id });
                        }}
                        className={"absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs backdrop-blur-sm transition-colors " + (
                          (activeExpandedDiscovery?.is_front_image || activeExpandedDiscovery?.is_species_front_image)
                            ? "border-amber-400/70 bg-amber-500/80 text-white hover:bg-amber-600/80"
                            : (isLightUi ? "border-stone-300 bg-white/90 text-stone-500 hover:bg-white" : "border-stone-500/70 bg-black/65 text-stone-300 hover:bg-black/75")
                        )}
                        title="Als Gattungsbild festlegen"
                      >
                        <Star className={"w-3.5 h-3.5 " + ((activeExpandedDiscovery?.is_front_image || activeExpandedDiscovery?.is_species_front_image) ? "fill-current" : "")} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmDiscoveryId(activeExpandedDiscovery.id);
                      }}
                      className={"absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs backdrop-blur-sm transition-colors " + (isLightUi ? "border-red-300 bg-red-50/95 text-red-600 hover:bg-red-100" : "border-red-400/60 bg-red-500/25 text-red-200 hover:bg-red-500/40")}
                      title="Scan löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : activeExpandedDiscovery ? (
                  <div className={"absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs backdrop-blur-sm " + (activeExpandedLikeCount > 0
                    ? (activeExpandedLikedByUser
                      ? (isLightUi ? "border-rose-300 bg-rose-50/95 text-rose-600" : "border-rose-400/60 bg-rose-400/15 text-rose-200")
                      : (isLightUi ? "border-rose-200 bg-white/90 text-rose-500" : "border-rose-300/45 bg-black/65 text-rose-200"))
                    : (isLightUi ? "border-stone-300 bg-white/90 text-stone-400" : "border-stone-500/70 bg-black/65 text-stone-300"))}>
                    <Heart className={"w-3.5 h-3.5 " + (activeExpandedLikedByUser ? "fill-current" : "")} />
                    <span>{activeExpandedLikeCount}</span>
                  </div>
                ) : null}
              </div>
              
              {/* Info-Bereich */}
              <div className="p-4 space-y-3 relative z-20">
                <SpeciesInfoCard
                  plant={{ ...expandedPlantData, image_url: activeExpandedDiscovery?.image_url || null }}
                  imageUrl={activeExpandedDiscovery?.image_url || null}
                  isLightUi={isLightUi}
                  compact={false}
                  disableThreatEffects={true}
                  showNarrative={true}
                  topRight={
                    <Button
                      onClick={() => speakPlantDescription(expandedPlantData)}
                      variant="outline"
                      size="icon"
                      className={isLightUi ? "" : "border-stone-600 bg-black/40 hover:bg-black/60"}
                    >
                      {speakingPlantId === expandedPlantData.id
                        ? <VolumeX className={"w-5 h-5 " + (isLightUi ? "text-green-600" : "text-emerald-300")} />
                        : <Volume2 className={"w-5 h-5 " + (isLightUi ? "text-stone-600" : "text-stone-200")} />}
                    </Button>
                  }
                />
                
                {activeExpandedDiscoveryDate && (
                  <p className={"text-xs " + (isLightUi ? "text-stone-500" : "text-stone-300") }>
                    Entdeckt am: {format(activeExpandedDiscoveryDate, "d. MMMM yyyy", { locale: de })}
                  </p>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Lösch-Bestätigungs-Dialog */}
        {deleteConfirmDiscoveryId && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirmDiscoveryId(null)}
          >
            <div 
              className={"rounded-2xl max-w-md w-full p-6 " + (isLightUi ? "bg-white" : "bg-[#141916] border border-red-500/30")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className={"w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 " + (isLightUi ? "bg-red-100" : "bg-red-900/35 border border-red-500/35")}>
                  <Trash2 className={"w-8 h-8 " + (isLightUi ? "text-red-600" : "text-red-300")} />
                </div>
                <h3 className={"text-xl font-bold mb-2 " + (isLightUi ? "text-stone-900" : "text-stone-100")}>Scan löschen?</h3>
                <p className={"text-sm " + (isLightUi ? "text-stone-600" : "text-stone-300") }>
                  Möchtest du diesen Scan wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmDiscoveryId(null)}
                  className={"flex-1 " + (isLightUi ? "" : "border-stone-600 bg-black/35 text-stone-100 hover:bg-black/55")}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={() => deleteDiscoveryMutation.mutate(deleteConfirmDiscoveryId)}
                  disabled={deleteDiscoveryMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {deleteDiscoveryMutation.isPending ? 'Wird gelöscht...' : 'Löschen'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <EditPlantDialog
          plant={editingPlant}
          isOpen={!!editingPlant}
          onClose={() => setEditingPlant(null)}
          onSaved={(updatedPlant) => {
            setEditingPlant((prev) => (prev && prev.id === updatedPlant.id ? { ...prev, ...updatedPlant } : prev));
            setExpandedPlant((prev) => {
              if (!prev || prev.id !== updatedPlant.id) return prev;
              return { ...prev, ...updatedPlant };
            });
          }}
        />
      </div>
    </div>
  );
}


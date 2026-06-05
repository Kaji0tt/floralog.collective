import React, { useState, useEffect, useRef, useMemo } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Leaf, CheckCircle2, Volume2, VolumeX, ChevronLeft, ChevronRight, Star, HelpCircle, X, Trash2, Heart } from "lucide-react";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import MobileBackButton from "../components/navigation/MobileBackButton";
import EditPlantDialog from "../components/collection/EditPlantDialog";
import SpeciesInfoCard from "../components/collection/SpeciesInfoCard";
import { useUiTheme } from "@/lib/UiThemeContext";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";

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
  const [expandedActiveVariantIndex, setExpandedActiveVariantIndex] = useState(0);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [expandedPlant, setExpandedPlant] = useState(null);
  const [editingPlant, setEditingPlant] = useState(null);
  const [deleteConfirmDiscoveryId, setDeleteConfirmDiscoveryId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);
  const [plantDragOffsets, setPlantDragOffsets] = useState({});
  const [expandedDragOffset, setExpandedDragOffset] = useState(null);
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
    const raw = discovery?.discovered_date || discovery?.created_date || discovery?.created_at;
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

  const { data: allFriendRecords = [] } = useQuery({
    queryKey: ["genusDetailFriendRecords", currentUser?.email],
    queryFn: () => Query.Friend.list(),
    enabled: !friendEmail && !!currentUser?.email,
    staleTime: 10000,
  });

  const acceptedFriendProfiles = useMemo(() => {
    if (friendEmail || !currentUser?.email) return [];

    const ownEmailLower = currentUser.email.toLowerCase();
    const profileByEmail = new Map(
      (allPublicProfiles || [])
        .filter((profile) => !!profile?.user_email)
        .map((profile) => [profile.user_email.toLowerCase(), profile])
    );

    const friendEmails = new Set();
    (allFriendRecords || []).forEach((friendEntry) => {
      if (friendEntry?.status !== "accepted") return;

      const sender = String(friendEntry.request_sent_by || "").toLowerCase();
      const receiver = String(friendEntry.request_sent_to || "").toLowerCase();
      if (sender === ownEmailLower && receiver) {
        friendEmails.add(receiver);
      } else if (receiver === ownEmailLower && sender) {
        friendEmails.add(sender);
      }
    });

    return Array.from(friendEmails)
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
  }, [allFriendRecords, allPublicProfiles, currentUser?.email, friendEmail, logoAssets]);

  const acceptedFriendAuthIds = useMemo(
    () => acceptedFriendProfiles.map((entry) => entry.authId).filter(Boolean),
    [acceptedFriendProfiles]
  );

  const acceptedFriendByAuthId = useMemo(
    () => new Map(acceptedFriendProfiles.map((entry) => [entry.authId, entry])),
    [acceptedFriendProfiles]
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

  const { data: friendDiscoveriesByAuthId = {} } = useQuery({
    queryKey: ["genusDetailFriendDiscoveries", acceptedFriendAuthIds],
    queryFn: async () => {
      const rows = await Promise.all(
        acceptedFriendAuthIds.map(async (authId) => {
          const discoveries = await Query.UserPlantDiscovery.filter({ auth_id: authId });
          return [authId, discoveries || []];
        })
      );
      return Object.fromEntries(rows);
    },
    enabled: !friendEmail && acceptedFriendAuthIds.length > 0,
    staleTime: 30000,
  });

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

    const friendActors = friendEmail
      ? []
      : Object.entries(friendDiscoveriesByAuthId || []).flatMap(([authId, discoveries]) => {
          const actor = acceptedFriendByAuthId.get(authId);
          if (!actor || !Array.isArray(discoveries)) return [];
          const hasSpeciesDiscovery = discoveries.some((discovery) => discovery?.plant_id === plant.id);
          return hasSpeciesDiscovery ? [actor] : [];
        });

    const uniqueFriendActors = Array.from(
      new Map(friendActors.map((actor) => [actor.authId, actor])).values()
    ).sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

    const discoveryVariants = [];

    if (friendEmail) {
      if (sortedDiscoveries.length > 0) {
        sortedDiscoveries.forEach((discovery, index) => {
          discoveryVariants.push({
            key: `friend-${friendProfile?.auth_id || "unknown"}-${discovery.id || index}`,
            actor: {
              authId: friendProfile?.auth_id || "friend",
              email: friendEmail,
              name: friendProfile?.display_name || friendProfile?.full_name || friendEmail,
              logoAssets: resolveEquippedLogoAssetsWithCatalog(friendProfile || {}, logoAssets),
              isOwn: false,
            },
            discovery,
            isOwn: false,
          });
        });
      } else {
        discoveryVariants.push({
          key: `friend-${friendProfile?.auth_id || "unknown"}-empty`,
          actor: {
            authId: friendProfile?.auth_id || "friend",
            email: friendEmail,
            name: friendProfile?.display_name || friendProfile?.full_name || friendEmail,
            logoAssets: resolveEquippedLogoAssetsWithCatalog(friendProfile || {}, logoAssets),
            isOwn: false,
          },
          discovery: null,
          isOwn: false,
        });
      }
    } else {
      discoveryVariants.push({
        key: `own-${ownActor.authId}-${plant.id}`,
        actor: ownActor,
        discovery: pickPreferredDiscovery(sortedDiscoveries),
        isOwn: true,
      });

      uniqueFriendActors.forEach((actor) => {
        const actorDiscoveries = Array.isArray(friendDiscoveriesByAuthId?.[actor.authId])
          ? friendDiscoveriesByAuthId[actor.authId].filter((entry) => entry?.plant_id === plant.id)
          : [];
        const actorDiscovery = pickPreferredDiscovery(actorDiscoveries);
        if (!actorDiscovery) return;
        discoveryVariants.push({
          key: `friend-${actor.authId}-${plant.id}`,
          actor: { ...actor, isOwn: false },
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
      friendActors: uniqueFriendActors,
      friendDiscoveryCount: uniqueFriendActors.length,
      discoveryVariants,
      defaultVariantIndex,
    };
  });
  const discoveredSpecies = genusPlants.filter(p => p.discovered);

  useEffect(() => {
    setActiveVariantIndexes((prev) => {
      const next = { ...prev };
      genusPlants.forEach((plant) => {
        if (typeof next[plant.id] !== "number") {
          next[plant.id] = plant.defaultVariantIndex || 0;
        }
      });
      return next;
    });
  }, [genusPlants]);

  useEffect(() => {
    if (!targetDiscoveryId || deepLinkAppliedRef.current) return;
    if (!Array.isArray(genusPlants) || genusPlants.length === 0) return;

    const matchingPlant = genusPlants.find((plant) =>
      Array.isArray(plant.discoveryVariants) &&
      plant.discoveryVariants.some((variant) => variant?.discovery?.id === targetDiscoveryId)
    );
    if (!matchingPlant) return;

    const targetIndex = matchingPlant.discoveryVariants.findIndex((variant) => variant?.discovery?.id === targetDiscoveryId);
    if (targetIndex < 0) return;

    setExpandedPlant(matchingPlant);
    setExpandedActiveVariantIndex(targetIndex);
    setActiveVariantIndexes((prev) => ({
      ...prev,
      [matchingPlant.id]: targetIndex,
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

  if (generaLoading || plantsLoading || discoveriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!genus) {
    // Determine the correct back URL even if genus is not found
    const backUrl = friendEmail 
      ? createPageUrl(`FriendCollection?email=${friendEmail}`)
      : createPageUrl("Collection");
    const backLabel = friendEmail ? "Zurück zum Freundes-Floralog" : "Zurück zur Sammlung";

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 mb-4">Gattung nicht gefunden</p>
        <Button onClick={() => navigate(backUrl)}>
          {backLabel}
        </Button>
      </div>
    );
  }

  const getRarityBorderColor = (rarity) => {
    switch (rarity) {
      case "Extrem Selten":
        return isLightUi ? "border-red-300" : "border-red-300/70";
      case "Sehr Selten":
        return isLightUi ? "border-orange-300" : "border-orange-300/70";
      case "Selten":
        return isLightUi ? "border-fuchsia-300" : "border-fuchsia-300/70";
      case "Gelegentlich":
        return isLightUi ? "border-green-300" : "border-emerald-300/60";
      case "Häufig":
      default:
        return isLightUi ? "border-stone-300" : "border-stone-500/60";
    }
  };

  const friendProfileLogoAssets = resolveEquippedLogoAssetsWithCatalog(friendProfile || {}, logoAssets);

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

  const activeExpandedDiscovery = activeExpandedVariant?.discovery || null;
  const activeExpandedLikeCount = activeExpandedDiscovery?.id
    ? (likeCountByDiscoveryId.get(activeExpandedDiscovery.id) || 0)
    : 0;
  const activeExpandedLikedByUser = activeExpandedDiscovery?.id
    ? likedDiscoveryIdSet.has(activeExpandedDiscovery.id)
    : false;
  const activeExpandedFriendActor = activeExpandedVariant?.isOwn ? null : activeExpandedVariant?.actor || null;

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
      cyclePlantVariant({
        plant: expandedPlantData,
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
    ? createPageUrl(`FriendCollection?email=${friendEmail}`)
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
            const activeDiscovery = activeVariant?.discovery || null;
            const activeLikeCount = activeDiscovery?.id ? (likeCountByDiscoveryId.get(activeDiscovery.id) || 0) : 0;
            const activeLikedByUser = activeDiscovery?.id ? likedDiscoveryIdSet.has(activeDiscovery.id) : false;
            const showStack = variants.length > 1;

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
              style={plantDragOffsets[plant.id] != null ? {
                transform: `translateX(${plantDragOffsets[plant.id]}px) rotate(${plantDragOffsets[plant.id] / 30}deg)`,
                transition: "none",
                willChange: "transform",
              } : undefined}
              className={`relative border shadow-sm transition-all duration-300 overflow-hidden cursor-pointer ${
                plant.discovered
                  ? `${getRarityBorderColor(plant.rarity)} hover:shadow-md ${isLightUi ? 'bg-white' : 'bg-black/40'}`
                  : (isLightUi ? 'border-stone-200 bg-stone-50 hover:bg-white' : 'border-stone-700/60 bg-black/30 hover:bg-black/40')
              }`}
            >
              <CardContent className="p-3">
                <div className="space-y-2">
                  <SpeciesInfoCard
                    plant={{ ...plant, image_url: activeDiscovery?.image_url || null }}
                    imageUrl={activeDiscovery?.image_url || null}
                    isLightUi={isLightUi}
                    compact={true}
                    showNarrative={true}
                    topRight={
                      <div className="flex items-center gap-2">
                        {plant.discovered ? (
                          <CheckCircle2 className={"w-4 h-4 flex-shrink-0 " + (isLightUi ? "text-green-600" : "text-emerald-300")} />
                        ) : (
                          <HelpCircle className={"w-4 h-4 flex-shrink-0 " + (isLightUi ? "text-stone-500" : "text-stone-300")} />
                        )}
                        {activeVariant && !activeVariant.isOwn ? (
                          <div
                            className="w-9 h-9 rounded-full overflow-hidden bg-black/35 ring-2 ring-white/20"
                            title={activeVariant.actor?.name || activeVariant.actor?.email || "Freund"}
                          >
                            <CustomLogoAvatar
                              logoAssets={activeVariant.actor?.logoAssets}
                              className="w-full h-full"
                              fallbackText={(activeVariant.actor?.name || activeVariant.actor?.email || "?").charAt(0).toUpperCase()}
                              fallbackClassName="text-xs font-bold text-white"
                            />
                          </div>
                        ) : null}
                      </div>
                    }
                  />
                  <div className="flex items-center justify-between gap-2">
                    {showStack ? (
                      <div className="inline-flex h-5 items-center rounded-full bg-black/60 text-white text-xs px-2 py-0.5">
                        {(activeIndex + 1)}/{variants.length}
                      </div>
                    ) : <div />}
                    {activeDiscovery && (
                      <div className={"inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[10px] " + (activeLikeCount > 0
                        ? (activeLikedByUser
                          ? (isLightUi ? "border-rose-300 bg-rose-50 text-rose-600" : "border-rose-400/60 bg-rose-400/15 text-rose-200")
                          : (isLightUi ? "border-rose-200 bg-white/90 text-rose-500" : "border-rose-300/45 bg-black/60 text-rose-200"))
                        : (isLightUi ? "border-stone-300 bg-white/90 text-stone-400" : "border-stone-500/70 bg-black/60 text-stone-300"))}>
                        <Heart className={"w-3 h-3 " + (activeLikedByUser ? "fill-current" : "")} />
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
              className={"rounded-2xl max-w-lg w-full " + (isLightUi ? "bg-white" : "bg-[#141916] border border-[#f0e5a5]/25")}
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
              } : undefined}
            >
              {/* Großes Bild */}
              <div className="relative">
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
                      fallbackText={friendEmail
                        ? (friendProfile?.display_name || friendProfile?.user_email || "?").charAt(0).toUpperCase()
                        : (activeExpandedFriendActor?.name || activeExpandedFriendActor?.email || "?").charAt(0).toUpperCase()}
                      fallbackClassName="text-xl font-bold text-white"
                    />
                  </div>
                )}

                {/* Herz nur für Freundes-Scans (unten links), Stern+Löschen für eigene (unten links/rechts) */}

                {/* Bild-Navigation */}
                {expandedVariants.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cyclePlantVariant({
                            plant: expandedPlantData,
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
                          cyclePlantVariant({
                            plant: expandedPlantData,
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
                        {(safeExpandedVariantIndex || 0) + 1} / {expandedVariants.length}
                      </div>
                    </>
                  )}

                {/* Aktionen je nach Variante: eigener Scan → Stern + Löschen; Freundes-Scan → Herz */}
                {activeExpandedVariant?.isOwn && activeExpandedDiscovery ? (
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
              <div className="p-4 space-y-3">
                <SpeciesInfoCard
                  plant={{ ...expandedPlantData, image_url: activeExpandedDiscovery?.image_url || null }}
                  imageUrl={activeExpandedDiscovery?.image_url || null}
                  isLightUi={isLightUi}
                  compact={false}
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
                
                {activeExpandedDiscovery?.created_at && (
                  <p className={"text-xs " + (isLightUi ? "text-stone-500" : "text-stone-300") }>
                    Entdeckt am: {format(new Date(activeExpandedDiscovery.created_at), "d. MMMM yyyy", { locale: de })}
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


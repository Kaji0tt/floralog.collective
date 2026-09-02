import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import {
  addCollectionMaintainerByEmail,
  removeCollectionMaintainer,
  reviewCollectionItemProposal,
} from "@/api/collectionCollaborationService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Trash2 } from "lucide-react";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import { createPageUrl } from "@/utils";

export default function CollectionEditor() {
  const MIN_COLLECTION_ITEMS = 3;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionId = searchParams.get("id");

  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [averageColor, setAverageColor] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    background_color: "",
    is_public: false,
    private_maintained: false,
    is_classroom: false,
    show_participant_codes: false,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const current = await getCurrentUser();
        setUser(current);
      } finally {
        setIsBootstrapping(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
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
          const data = ctx.getImageData(0, 0, size, size).data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
          if (count > 0) setAverageColor(`rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`);
        } catch (err) {
          console.warn("Could not compute average color from background image:", err);
        }
      };
      img.src = user.background_image_url;
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  const { data: existingCollection, isLoading: collectionLoading } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: async () => {
      if (!collectionId) return null;
      const items = await Query.Collection.filter({ id: collectionId });
      return items[0] || null;
    },
    enabled: !!collectionId,
  });

  const { data: collectionItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["collectionItemsForEditor", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];
      return Query.CollectionItem.filter({ collection_id: collectionId });
    },
    enabled: !!collectionId,
  });

  const { data: genera = [] } = useQuery({
    queryKey: ["genera"],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["plants"],
    // listAll() - collection editing needs to pick from the complete catalog, list() truncates at 1000 rows.
    queryFn: () => Query.Plant.listAll(),
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["collectionEditorPublicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 60000,
  });

  const { data: collectionMaintainers = [] } = useQuery({
    queryKey: ["collectionMaintainers", collectionId],
    queryFn: () => {
      if (!collectionId) return Promise.resolve([]);
      return Query.CollectionMaintainer.filter({ collection_id: collectionId });
    },
    enabled: !!collectionId,
  });

  const { data: collectionItemProposals = [] } = useQuery({
    queryKey: ["collectionItemProposals", collectionId],
    queryFn: () => {
      if (!collectionId) return Promise.resolve([]);
      return Query.CollectionItemProposal.filter({ collection_id: collectionId });
    },
    enabled: !!collectionId,
  });

  const [itemNotes, setItemNotes] = useState({});
  const [searchMode, setSearchMode] = useState("genus"); // "genus" | "plant"
  const [searchQuery, setSearchQuery] = useState("");
  const [classroomTooltipOpen, setClassroomTooltipOpen] = useState(false);
  // Pending items buffered locally when creating a new collection (before save)
  const [pendingItems, setPendingItems] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [maintainerEmail, setMaintainerEmail] = useState("");
  const [maintainerRole, setMaintainerRole] = useState("admin");
  const [reviewNotesByProposalId, setReviewNotesByProposalId] = useState({});

  const navigateBackToCollection = (targetCollectionId = null) => {
    if (targetCollectionId) {
      navigate(createPageUrl(`Collection?collectionId=${targetCollectionId}`));
      return;
    }
    navigate(createPageUrl("Collection"));
  };

  useEffect(() => {
    if (collectionItems && collectionItems.length > 0) {
      const map = {};
      collectionItems.forEach((item) => {
        map[item.id] = item.note || "";
      });
      setItemNotes(map);
    } else {
      setItemNotes({});
    }
  }, [collectionItems]);

  useEffect(() => {
    if (existingCollection) {
      setFormData({
        title: existingCollection.title || "",
        slug: existingCollection.slug || "",
        description: existingCollection.description || "",
        background_color: existingCollection.background_color || "",
        is_public: !!existingCollection.is_public,
        private_maintained: !!existingCollection.private_maintained,
        is_classroom: !!existingCollection.is_classroom,
        show_participant_codes: !!existingCollection.show_participant_codes,
      });
    }
  }, [existingCollection]);

  const addMaintainerMutation = useMutation({
    mutationFn: async () => {
      if (!collectionId) return null;
      return addCollectionMaintainerByEmail({
        collectionId,
        email: maintainerEmail,
        role: maintainerRole,
        actorUser: user,
      });
    },
    onSuccess: () => {
      setMaintainerEmail("");
      queryClient.invalidateQueries({ queryKey: ["collectionMaintainers", collectionId] });
    },
  });

  const removeMaintainerMutation = useMutation({
    mutationFn: async (maintainerId) => removeCollectionMaintainer(maintainerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionMaintainers", collectionId] });
    },
  });

  const reviewProposalMutation = useMutation({
    mutationFn: async ({ proposalId, status }) => {
      return reviewCollectionItemProposal({
        proposalId,
        status,
        reviewNote: reviewNotesByProposalId[proposalId] || "",
        actorUser: user,
      });
    },
    onSuccess: (_data, variables) => {
      setReviewNotesByProposalId((prev) => ({
        ...prev,
        [variables.proposalId]: "",
      }));
      queryClient.invalidateQueries({ queryKey: ["collectionItemProposals", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collectionItemsForEditor", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collectionItems"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ collectionData, itemsToCreate }) => {
      const newCollection = await Query.Collection.create(collectionData);
      if (newCollection?.id && itemsToCreate.length > 0) {
        await Promise.all(
          itemsToCreate.map((item) =>
            Query.CollectionItem.create({
              collection_id: newCollection.id,
              genus_id: item.genusId || null,
              plant_id: item.plantId || null,
              note: item.note?.trim() || null,
            })
          )
        );
      }
      return newCollection;
    },
    onSuccess: (newCollection) => {
      queryClient.invalidateQueries({ queryKey: ["ownedCollections"] });
      if (newCollection?.id) {
        navigateBackToCollection(newCollection.id);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return Query.Collection.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownedCollections"] });
      queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
      navigateBackToCollection(collectionId);
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const updateItemNoteMutation = useMutation({
    mutationFn: async ({ id, note }) => {
      return Query.CollectionItem.update(id, { note: note || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionItemsForEditor", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collectionItems"] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ genusId, plantId }) => {
      if (!collectionId) return null;
      return Query.CollectionItem.create({
        collection_id: collectionId,
        genus_id: genusId || null,
        plant_id: plantId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionItemsForEditor", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collectionItems"] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id }) => {
      return Query.CollectionItem.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionItemsForEditor", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collectionItems"] });
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id) => {
      return Query.Collection.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownedCollections"] });
      queryClient.invalidateQueries({ queryKey: ["visibleCollections"] });
      navigate("/Collection");
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user || !user.id) return;

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      background_color: formData.background_color || null,
      is_public: formData.is_public,
      private_maintained: formData.private_maintained,
      is_classroom: formData.is_classroom,
      show_participant_codes: formData.show_participant_codes,
    };

    if (!collectionId) {
      // Owner der Kollektion immer auf aktuelle Auth-User-ID setzen (RLS)
      payload.auth_id = user.id;
      // Slug nur beim Anlegen erzeugen, wenn nicht gesetzt
      const baseSlug = (formData.slug || formData.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      payload.slug = baseSlug || undefined;
      createMutation.mutate({ collectionData: payload, itemsToCreate: pendingItems });
    } else {
      updateMutation.mutate({ id: collectionId, data: payload });
    }
  };

  const isLoading = isBootstrapping || collectionLoading;

  const handleItemNoteChange = (itemId, value) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: value }));
  };

  const resolveItemLabel = (item) => {
    if (item.genus_id) {
      const genus = genera.find((g) => g.id === item.genus_id);
      if (genus) {
        return genus.genus_name || genus.scientific_genus || "Unbekannte Gattung";
      }
      return "Gattung";
    }
    if (item.plant_id) {
      const plant = plants.find((p) => p.id === item.plant_id);
      if (plant) {
        return plant.german_name || plant.scientific_name || "Pflanze";
      }
      return "Pflanze";
    }
    return "Eintrag";
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const profileByAuthId = new Map((publicProfiles || []).map((profile) => [profile.auth_id, profile]));
  const pendingProposals = (collectionItemProposals || [])
    .filter((proposal) => proposal.status === "pending")
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const existingGenusIds = new Set(
    collectionItems.filter((item) => item.genus_id).map((item) => item.genus_id)
  );
  const existingPlantIds = new Set(
    collectionItems.filter((item) => item.plant_id).map((item) => item.plant_id)
  );

  // For new collection mode: track which entries are already pending
  const pendingGenusIds = new Set(pendingItems.filter((i) => i.genusId).map((i) => i.genusId));
  const pendingPlantIds = new Set(pendingItems.filter((i) => i.plantId).map((i) => i.plantId));

  let searchResults = [];
  if (normalizedSearch) {
    if (searchMode === "genus") {
      searchResults = genera
        .filter((g) => {
          const name = (g.genus_name || "").toLowerCase();
          const sci = (g.scientific_genus || "").toLowerCase();
          return name.includes(normalizedSearch) || sci.includes(normalizedSearch);
        })
        .slice(0, 20);
    } else {
      searchResults = plants
        .filter((p) => {
          const gn = (p.german_name || "").toLowerCase();
          const sn = (p.scientific_name || "").toLowerCase();
          return gn.includes(normalizedSearch) || sn.includes(normalizedSearch);
        })
        .slice(0, 20);
    }
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

  return (
    <div
      className="relative min-h-screen p-4 md:p-8"
      style={{
        background: averageColor
          ? "linear-gradient(135deg, "
            + getLighterColor(averageColor)
            + " 0%, "
            + averageColor
            + " 50%, "
            + getDarkerColor(averageColor)
            + " 100%)"
          : 'linear-gradient(to bottom, rgb(250, 250, 249), rgb(236, 253, 245))'
      }}
    >
      <MobileBackButton />

      <div className="max-w-xl mx-auto pt-2">
        <Card className="bg-white/90 backdrop-blur shadow-sm border-stone-200">
          <CardHeader>
            <CardTitle className="text-lg">
              {collectionId ? "Kollektion bearbeiten" : "Neue Kollektion anlegen"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-stone-500 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Lädt Kollektion...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    placeholder="z.B. Bienenfreunde"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="slug">Kurzname / URL-Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleChange("slug", e.target.value)}
                    placeholder="Optional, wird sonst automatisch erzeugt"
                    disabled={!!collectionId}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Kurze Beschreibung, was diese Kollektion besonders macht"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="background_color">Hintergrundfarbe (CSS rgb/hex)</Label>
                  <Input
                    id="background_color"
                    value={formData.background_color}
                    onChange={(e) => handleChange("background_color", e.target.value)}
                    placeholder="z.B. rgb(34, 197, 94) oder #16a34a"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-stone-100 pt-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_public">Öffentliche Kollektion</Label>
                      <p className="text-[11px] text-stone-500">
                        Sichtbar für andere in der Community und abonnierbar.
                      </p>
                    </div>
                    <Switch
                      id="is_public"
                      checked={formData.is_public}
                      onCheckedChange={(v) => handleChange("is_public", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="private_maintained">Private Maintained</Label>
                      <p className="text-[11px] text-stone-500">
                        Wenn aktiv, koennen nur Owner/Admins Pflanzen direkt einreichen.
                      </p>
                    </div>
                    <Switch
                      id="private_maintained"
                      checked={formData.private_maintained}
                      onCheckedChange={(v) => handleChange("private_maintained", v)}
                    />
                  </div>

                  <TooltipProvider>
                    <Tooltip open={classroomTooltipOpen} onOpenChange={setClassroomTooltipOpen}>
                      <TooltipTrigger asChild>
                        <div
                          className="flex items-center justify-between opacity-60 cursor-not-allowed"
                          onMouseEnter={() => setClassroomTooltipOpen(true)}
                          onMouseLeave={() => setClassroomTooltipOpen(false)}
                          onClick={() => setClassroomTooltipOpen(true)}
                        >
                          <div>
                            <Label htmlFor="is_classroom">Classroom-Modus</Label>
                            <p className="text-[11px] text-stone-500">
                              Für Klassen/Gruppen mit anonymen Kennungen.
                            </p>
                          </div>
                          <Switch
                            id="is_classroom"
                            checked={formData.is_classroom}
                            disabled
                            aria-disabled="true"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Classroom Modus für Kollektionen folgt noch.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="show_participant_codes">Teilnehmer-Kennungen anzeigen</Label>
                      <p className="text-[11px] text-stone-500">
                        Zeigt pro Pflanze an, welche Kennungen sie bereits gefunden haben.
                      </p>
                    </div>
                    <Switch
                      id="show_participant_codes"
                      checked={formData.show_participant_codes}
                      onCheckedChange={(v) => handleChange("show_participant_codes", v)}
                      disabled={!formData.is_classroom}
                    />
                  </div>
                </div>

                <div className="mt-4 border-t border-stone-100 pt-3">
                  <h2 className="text-sm font-semibold text-stone-800 mb-1">
                    Pflanzen in dieser Kollektion
                  </h2>
                  <p className="text-[11px] text-stone-500 mb-2">
                    {collectionId
                      ? "Suche nach Gattungen oder Arten und füge sie hinzu. Unten kannst du pro Eintrag eine kurze Erklärung ergänzen (z.B. \"Hilft bei Kopfschmerzen\")."
                      : "Wähle mindestens 3 Gattungen oder Arten aus, bevor du die Kollektion anlegst."}
                  </p>

                  {/* Hinzufügen-Bereich */}
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-stone-600">Suche in:</span>
                      <div className="inline-flex rounded-full bg-stone-100 p-0.5">
                        <button
                          type="button"
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            searchMode === "genus"
                              ? "bg-white shadow text-stone-900"
                              : "text-stone-500"
                          }`}
                          onClick={() => setSearchMode("genus")}
                        >
                          Gattungen
                        </button>
                        <button
                          type="button"
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            searchMode === "plant"
                              ? "bg-white shadow text-stone-900"
                              : "text-stone-500"
                          }`}
                          onClick={() => setSearchMode("plant")}
                        >
                          Arten
                        </button>
                      </div>
                    </div>

                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        searchMode === "genus"
                          ? "Nach Gattungsnamen suchen..."
                          : "Nach Pflanzennamen suchen..."
                      }
                      className="h-8 text-sm"
                    />

                    {normalizedSearch && (
                      <div className="max-h-40 overflow-y-auto border border-stone-200 rounded-md bg-white/95 text-[12px]">
                        {searchResults.length === 0 ? (
                          <div className="px-2 py-2 text-stone-500">
                            Keine Treffer.
                          </div>
                        ) : (
                          searchResults.map((entry) => {
                            const isExisting = collectionId
                              ? searchMode === "genus"
                                ? existingGenusIds.has(entry.id)
                                : existingPlantIds.has(entry.id)
                              : searchMode === "genus"
                                ? pendingGenusIds.has(entry.id)
                                : pendingPlantIds.has(entry.id);
                            const mainLabel =
                              searchMode === "genus"
                                ? entry.genus_name || entry.scientific_genus
                                : entry.german_name || entry.scientific_name;
                            const subLabel =
                              searchMode === "genus"
                                ? entry.scientific_genus
                                : entry.scientific_name;

                            return (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-stone-100 last:border-b-0"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-stone-800">{mainLabel}</div>
                                  {subLabel && (
                                    <div className="truncate text-[11px] text-stone-500">
                                      {subLabel}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  disabled={isExisting || addItemMutation.isPending}
                                  onClick={() => {
                                    if (collectionId) {
                                      addItemMutation.mutate({
                                        genusId: searchMode === "genus" ? entry.id : null,
                                        plantId: searchMode === "plant" ? entry.id : null,
                                      });
                                      setSearchQuery("");
                                    } else {
                                      setPendingItems((prev) => [
                                        ...prev,
                                        {
                                          tempId: `${searchMode}-${entry.id}-${Date.now()}`,
                                          genusId: searchMode === "genus" ? entry.id : null,
                                          plantId: searchMode === "plant" ? entry.id : null,
                                          label: mainLabel,
                                          subLabel: subLabel || null,
                                          note: "",
                                        },
                                      ]);
                                      setSearchQuery("");
                                    }
                                  }}
                                >
                                  {isExisting ? "Bereits drin" : "Hinzufügen"}
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pending items list (new collection mode) */}
                  {!collectionId && (
                    <>
                      <div className={`text-[11px] mb-2 font-medium ${pendingItems.length >= MIN_COLLECTION_ITEMS ? "text-emerald-600" : "text-amber-600"}`}>
                        {pendingItems.length} von mindestens {MIN_COLLECTION_ITEMS} ausgewählt
                      </div>
                      {pendingItems.length > 0 && (
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {pendingItems.map((item) => (
                            <div
                              key={item.tempId}
                              className="border border-stone-200 rounded-md px-2 py-1.5 bg-stone-50/80 text-[12px]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-stone-800 font-medium">{item.label}</div>
                                  {item.subLabel && (
                                    <div className="truncate text-[11px] text-stone-500">{item.subLabel}</div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="text-[10px] text-stone-400 hover:text-red-500 transition-colors shrink-0"
                                  onClick={() =>
                                    setPendingItems((prev) =>
                                      prev.filter((i) => i.tempId !== item.tempId)
                                    )
                                  }
                                >
                                  Entfernen
                                </button>
                              </div>

                              <Textarea
                                value={item.note || ""}
                                onChange={(e) => {
                                  const nextNote = e.target.value;
                                  setPendingItems((prev) =>
                                    prev.map((i) =>
                                      i.tempId === item.tempId
                                        ? { ...i, note: nextNote }
                                        : i
                                    )
                                  );
                                }}
                                rows={2}
                                className="mt-2 text-[11px]"
                                placeholder="Optionale kurze Erklärung zu dieser Pflanze in der Kollektion"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Saved items list (edit mode) */}
                  {collectionId && (
                    <>
                    {itemsLoading ? (
                      <div className="flex items-center justify-center py-4 text-stone-500 text-xs">
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Lädt Einträge der Kollektion...
                      </div>
                    ) : collectionItems.length === 0 ? (
                      <p className="text-[12px] text-stone-500">
                        Dieser Kollektion sind noch keine Pflanzen oder Gattungen zugeordnet.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {collectionItems.map((item) => {
                          const label = resolveItemLabel(item);
                          const currentNote = itemNotes[item.id] ?? "";
                          const originalNote = item.note || "";
                          const isDirty = currentNote !== originalNote;

                          return (
                            <div
                              key={item.id}
                              className="border border-stone-200 rounded-md p-2 bg-stone-50/80 flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-semibold text-stone-800 truncate">
                                  {label}
                                </span>
                                <div className="flex items-center gap-2">
                                  {isDirty && (
                                    <span className="text-[10px] text-emerald-600 font-medium">
                                      geändert
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className="text-[10px] text-stone-400 hover:text-red-500 transition-colors"
                                    onClick={() =>
                                      deleteItemMutation.mutate({ id: item.id })
                                    }
                                    disabled={deleteItemMutation.isPending}
                                  >
                                    Entfernen
                                  </button>
                                </div>
                              </div>

                              <Textarea
                                value={currentNote}
                                onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                                rows={2}
                                className="text-[11px]"
                                placeholder="Optionale kurze Erklärung zu dieser Pflanze in der Kollektion"
                              />

                              <div className="flex justify-end pt-1">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  className="text-[11px] h-7 px-2"
                                  disabled={updateItemNoteMutation.isPending || !isDirty}
                                  onClick={() =>
                                    updateItemNoteMutation.mutate({
                                      id: item.id,
                                      note: currentNote.trim(),
                                    })
                                  }
                                >
                                  {updateItemNoteMutation.isPending && (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  )}
                                  Speichern
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </>
                  )}
                </div>

                {collectionId && (
                  <div className="mt-4 border-t border-stone-100 pt-3 space-y-3">
                    <h2 className="text-sm font-semibold text-stone-800">Kollektion-Admins</h2>
                    <p className="text-[11px] text-stone-500">
                      Weise anderen Spielern Owner- oder Admin-Rechte zu.
                    </p>

                    <div className="flex items-center gap-2">
                      <Input
                        value={maintainerEmail}
                        onChange={(e) => setMaintainerEmail(e.target.value)}
                        placeholder="E-Mail des Spielers"
                        className="h-8 text-sm"
                      />
                      <select
                        className="h-8 rounded-md border border-stone-200 bg-white px-2 text-xs"
                        value={maintainerRole}
                        onChange={(e) => setMaintainerRole(e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-3 text-[11px]"
                        disabled={addMaintainerMutation.isPending || !maintainerEmail.trim()}
                        onClick={() => addMaintainerMutation.mutate()}
                      >
                        {addMaintainerMutation.isPending ? "..." : "Hinzufuegen"}
                      </Button>
                    </div>

                    {addMaintainerMutation.error && (
                      <p className="text-[11px] text-red-600">
                        {addMaintainerMutation.error.message || "Rolle konnte nicht gesetzt werden."}
                      </p>
                    )}

                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {(collectionMaintainers || []).map((maintainer) => {
                        const profile = profileByAuthId.get(maintainer.auth_id);
                        const isOwner = maintainer.role === "owner";
                        return (
                          <div
                            key={maintainer.id}
                            className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50/80 px-2 py-1.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-stone-800">
                                {profile?.display_name || profile?.full_name || profile?.user_email || maintainer.auth_id}
                              </p>
                              <p className="truncate text-[10px] text-stone-500">
                                {profile?.user_email || maintainer.auth_id}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] rounded-full border border-stone-300 bg-white px-2 py-0.5 text-stone-700">
                                {isOwner ? "Owner" : "Admin"}
                              </span>
                              {maintainer.auth_id !== user?.id && (
                                <button
                                  type="button"
                                  className="text-[10px] text-stone-400 hover:text-red-500 transition-colors"
                                  onClick={() => removeMaintainerMutation.mutate(maintainer.id)}
                                  disabled={removeMaintainerMutation.isPending}
                                >
                                  Entfernen
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {collectionId && (
                  <div className="mt-4 border-t border-stone-100 pt-3 space-y-2">
                    <h2 className="text-sm font-semibold text-stone-800">Offene Vorschlaege</h2>
                    <p className="text-[11px] text-stone-500">
                      Andere Spieler koennen Pflanzen einreichen, die hier bestaetigt oder abgelehnt werden.
                    </p>

                    {pendingProposals.length === 0 ? (
                      <p className="text-[12px] text-stone-500">Keine offenen Vorschlaege.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {pendingProposals.map((proposal) => {
                          const proposalPlant = plants.find((plant) => plant.id === proposal.plant_id);
                          const proposalGenus = genera.find((genus) => genus.id === proposal.genus_id);
                          const proposerProfile = profileByAuthId.get(proposal.proposed_by_auth_id);
                          const label =
                            proposalPlant?.species_name ||
                            proposalPlant?.scientific_name ||
                            proposalGenus?.genus_name ||
                            proposalGenus?.scientific_genus ||
                            "Pflanze";
                          const proposerLabel =
                            proposerProfile?.display_name ||
                            proposerProfile?.full_name ||
                            proposerProfile?.user_email ||
                            proposal.proposed_by_auth_id;

                          return (
                            <div
                              key={proposal.id}
                              className="rounded-md border border-stone-200 bg-stone-50/80 p-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-stone-800 truncate">{label}</p>
                                  <p className="text-[10px] text-stone-500 truncate">Vorgeschlagen von: {proposerLabel}</p>
                                  {!!proposal.note && (
                                    <p className="text-[10px] text-stone-600 mt-1 line-clamp-2">{proposal.note}</p>
                                  )}
                                </div>
                                <span className="text-[10px] rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700">
                                  pending
                                </span>
                              </div>

                              <Textarea
                                rows={2}
                                className="text-[11px] mt-2"
                                placeholder="Optionale Antwort / Begruendung"
                                value={reviewNotesByProposalId[proposal.id] || ""}
                                onChange={(e) =>
                                  setReviewNotesByProposalId((prev) => ({
                                    ...prev,
                                    [proposal.id]: e.target.value,
                                  }))
                                }
                              />

                              <div className="mt-2 flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] border-red-200 text-red-700 hover:bg-red-50"
                                  disabled={reviewProposalMutation.isPending}
                                  onClick={() =>
                                    reviewProposalMutation.mutate({
                                      proposalId: proposal.id,
                                      status: "rejected",
                                    })
                                  }
                                >
                                  Ablehnen
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  disabled={reviewProposalMutation.isPending}
                                  onClick={() =>
                                    reviewProposalMutation.mutate({
                                      proposalId: proposal.id,
                                      status: "approved",
                                    })
                                  }
                                >
                                  Bestaetigen
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 mt-2 border-t border-stone-100 flex flex-col gap-2">
                  {!collectionId && pendingItems.length < MIN_COLLECTION_ITEMS && formData.title.trim() && (
                    <p className="text-[11px] text-amber-600 text-right">
                      Bitte wähle mindestens {MIN_COLLECTION_ITEMS} Pflanzen oder Gattungen aus ({pendingItems.length}/{MIN_COLLECTION_ITEMS}).
                    </p>
                  )}
                  {collectionId && showDeleteConfirm && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-[12px] text-red-700">Kollektion wirklich löschen?</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-[11px] h-7 px-2"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={deleteCollectionMutation.isPending}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="text-[11px] h-7 px-2 bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => deleteCollectionMutation.mutate(collectionId)}
                          disabled={deleteCollectionMutation.isPending}
                        >
                          {deleteCollectionMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          Ja, löschen
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      {collectionId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-[11px] h-8 px-3 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isSaving || deleteCollectionMutation.isPending || showDeleteConfirm}
                          aria-label="Kollektion löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-8 px-3"
                        onClick={() => navigateBackToCollection(collectionId)}
                        disabled={isSaving || deleteCollectionMutation.isPending}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="text-[11px] h-8 px-3"
                        disabled={isSaving || !formData.title.trim() || (!collectionId && pendingItems.length < MIN_COLLECTION_ITEMS)}
                      >
                        {isSaving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {collectionId ? "Speichern" : "Kollektion anlegen"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

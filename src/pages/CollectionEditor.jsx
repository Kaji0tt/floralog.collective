import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import MobileBackButton from "@/components/navigation/MobileBackButton";

export default function CollectionEditor() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const collectionId = searchParams.get("id");

  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    background_color: "",
    is_public: false,
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
    queryFn: () => Query.Plant.list(),
  });

  const [itemNotes, setItemNotes] = useState({});
  const [searchMode, setSearchMode] = useState("genus"); // "genus" | "plant"
  const [searchQuery, setSearchQuery] = useState("");

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
        is_classroom: !!existingCollection.is_classroom,
        show_participant_codes: !!existingCollection.show_participant_codes,
      });
    }
  }, [existingCollection]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return Query.Collection.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownedCollections"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return Query.Collection.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownedCollections"] });
      queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
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
      is_classroom: formData.is_classroom,
      show_participant_codes: formData.show_participant_codes,
    };

    if (!collectionId) {
      // Owner der Kollektion immer auf aktuelle Auth-User-ID setzen (RLS)
      payload.auth_id = user.id;
      // Slug nur beim Anlegen erzeugen, wenn nicht gesetzt
      const baseSlug = (formData.slug || formData.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      payload.slug = baseSlug || undefined;
      createMutation.mutate(payload);
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

  const existingGenusIds = new Set(
    collectionItems.filter((item) => item.genus_id).map((item) => item.genus_id)
  );
  const existingPlantIds = new Set(
    collectionItems.filter((item) => item.plant_id).map((item) => item.plant_id)
  );

  let searchResults = [];
  if (normalizedSearch && collectionId) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50 p-4 md:p-8">
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
                      <Label htmlFor="is_classroom">Classroom-Modus</Label>
                      <p className="text-[11px] text-stone-500">
                        Für Klassen/Gruppen mit anonymen Kennungen.
                      </p>
                    </div>
                    <Switch
                      id="is_classroom"
                      checked={formData.is_classroom}
                      onCheckedChange={(v) => handleChange("is_classroom", v)}
                    />
                  </div>

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

                {collectionId && (
                  <div className="mt-4 border-t border-stone-100 pt-3">
                    <h2 className="text-sm font-semibold text-stone-800 mb-1">
                      Pflanzen in dieser Kollektion
                    </h2>
                    <p className="text-[11px] text-stone-500 mb-2">
                      Suche nach Gattungen oder Arten und füge sie hinzu. Unten kannst du pro
                      Eintrag eine kurze Erklärung ergänzen (z.B. "Hilft bei Kopfschmerzen").
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
                              const isExisting =
                                searchMode === "genus"
                                  ? existingGenusIds.has(entry.id)
                                  : existingPlantIds.has(entry.id);
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
                                    onClick={() =>
                                      addItemMutation.mutate({
                                        genusId: searchMode === "genus" ? entry.id : null,
                                        plantId: searchMode === "plant" ? entry.id : null,
                                      })
                                    }
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

                    {/* Notizen-Bereich */}
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
                  </div>
                )}

                <div className="pt-4 mt-2 border-t border-stone-100 flex justify-end gap-2">
                  <Button
                    type="submit"
                    disabled={isSaving || !formData.title.trim()}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {collectionId ? "Änderungen speichern" : "Kollektion anlegen"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

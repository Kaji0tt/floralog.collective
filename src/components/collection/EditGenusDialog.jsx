import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, GitMerge, ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";

const CATEGORIES = ["Bäume", "Sträucher", "Blumen"];

export default function EditGenusDialog({ genus, isOpen, onClose, isLightUi = true }) {
  const queryClient = useQueryClient();
  const [genusName, setGenusName] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState("");
  const [scientificGenus, setScientificGenus] = useState("");
  const [category, setCategory] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeError, setMergeError] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  const { data: allGenera = [] } = useQuery({
    queryKey: ["genera"],
    queryFn: () => Query.PlantGenus.list(),
    enabled: isOpen,
  });

  useEffect(() => {
    if (genus && isOpen) {
      setGenusName(genus.genus_name || "");
      setDescription(genus.description || "");
      setFamily(genus.family || "");
      setScientificGenus(genus.scientific_genus || "");
      // Normalize "Blumen & Kräuter" to "Blumen" for display
      const normalizedCat = genus.category === "Blumen & Kräuter" ? "Blumen" : (genus.category || "");
      setCategory(normalizedCat);
      setShowMerge(false);
      setMergeTargetId("");
      setMergeError("");
    }
  }, [genus, isOpen]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const oldCategory = genus.category;
      const newCategory = payload.data.category;
      const categoryChanged = newCategory && newCategory !== oldCategory;

      // Update genus
      await Query.PlantGenus.update(payload.id, payload.data);

      // If category changed, also update all plants that reference this genus
      if (categoryChanged) {
        await supabase
          .from("Plant")
          .update({ genus_category: newCategory })
          .eq("genus_category", oldCategory)
          .eq("genus_number", genus.category_dex_number);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genera"] });
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      handleClose();
    },
  });

  const handleClose = () => {
    setGenusName("");
    setDescription("");
    setFamily("");
    setScientificGenus("");
    setCategory("");
    setShowMerge(false);
    setMergeTargetId("");
    setMergeError("");
    onClose();
  };

  const handleSave = async () => {
    if (!genusName.trim()) {
      alert("Der Gattungsname ist erforderlich!");
      return;
    }

    updateMutation.mutate({
      id: genus.id,
      data: {
        genus_name: genusName.trim(),
        description: description.trim() || null,
        family: family.trim() || null,
        scientific_genus: scientificGenus.trim() || null,
        category: category || genus.category,
      },
    });
  };

  const handleMerge = async () => {
    if (!mergeTargetId) {
      setMergeError("Bitte eine Ziel-Gattung auswählen.");
      return;
    }
    const target = allGenera.find((g) => g.id === mergeTargetId);
    if (!target) {
      setMergeError("Ziel-Gattung nicht gefunden.");
      return;
    }
    if (target.id === genus.id) {
      setMergeError("Kann nicht in dieselbe Gattung eingliedern.");
      return;
    }

    const confirmed = window.confirm(
      `Alle Pflanzen von "${genus.genus_name}" werden zu "${target.genus_name}" verschoben und diese Gattung gelöscht. Fortfahren?`
    );
    if (!confirmed) return;

    setIsMerging(true);
    setMergeError("");
    try {
      // Move all plants from source genus to target genus
      const { error: plantUpdateError } = await supabase
        .from("Plant")
        .update({ genus_category: target.category, genus_number: target.category_dex_number })
        .eq("genus_category", genus.category)
        .eq("genus_number", genus.category_dex_number);

      if (plantUpdateError) throw plantUpdateError;

      // Also handle legacy "Blumen & Kräuter" variant if applicable
      if (genus.category === "Blumen" || genus.category === "Blumen & Kräuter") {
        const altCategory = genus.category === "Blumen" ? "Blumen & Kräuter" : "Blumen";
        await supabase
          .from("Plant")
          .update({ genus_category: target.category, genus_number: target.category_dex_number })
          .eq("genus_category", altCategory)
          .eq("genus_number", genus.category_dex_number);
      }

      // Delete source genus
      const { error: deleteError } = await supabase
        .from("PlantGenus")
        .delete()
        .eq("id", genus.id);

      if (deleteError) throw deleteError;

      queryClient.invalidateQueries({ queryKey: ["genera"] });
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      handleClose();
    } catch (err) {
      setMergeError(err?.message || "Fehler beim Eingliedern.");
    } finally {
      setIsMerging(false);
    }
  };

  if (!genus) return null;

  const inputClass = `border-2 focus:border-green-500 ${!isLightUi ? "border-stone-600 bg-stone-800/60 text-stone-100 placeholder:text-stone-500" : "border-stone-200"}`;
  const labelClass = `font-semibold ${!isLightUi ? "text-stone-200" : ""}`;

  // Merge target candidates: all genera except current one
  const mergeTargetOptions = allGenera
    .filter((g) => g.id !== genus.id)
    .sort((a, b) => {
      if (a.category !== b.category) return (a.category || "").localeCompare(b.category || "");
      return (a.genus_name || "").localeCompare(b.genus_name || "");
    });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto ${!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${!isLightUi ? "text-stone-100" : "text-stone-900"}`}>
            Gattung bearbeiten
          </DialogTitle>
          <DialogDescription className={`text-sm ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
            Passe den Namen und weitere Informationen dieser Gattung an
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kategorie */}
          <div className="space-y-2">
            <Label className={labelClass}>Kategorie</Label>
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border-2 text-xs font-semibold transition-colors ${
                    category === cat
                      ? "border-green-500 bg-green-500/20 text-green-700"
                      : isLightUi
                      ? "border-stone-200 text-stone-600 hover:border-stone-400"
                      : "border-stone-600 text-stone-300 hover:border-stone-400"
                  }`}
                >
                  {cat === "Bäume" ? "🌳" : cat === "Sträucher" ? "🌿" : "🌸"} {cat}
                </button>
              ))}
            </div>
            {genus.category === "Blumen & Kräuter" && (
              <p className={`text-xs ${!isLightUi ? "text-amber-400" : "text-amber-700"}`}>
                ⚠️ War als „Blumen & Kräuter" gespeichert – wird zu „Blumen" normalisiert.
              </p>
            )}
          </div>

          {/* Deutscher Name */}
          <div className="space-y-2">
            <Label htmlFor="genus-name" className={labelClass}>
              Deutscher Name *
            </Label>
            <Input
              id="genus-name"
              value={genusName}
              onChange={(e) => setGenusName(e.target.value)}
              placeholder="z.B. Eiche"
              className={inputClass}
            />
          </div>

          {/* Wissenschaftlicher Name */}
          <div className="space-y-2">
            <Label htmlFor="scientific-genus" className={labelClass}>
              Wissenschaftlicher Name
            </Label>
            <Input
              id="scientific-genus"
              value={scientificGenus}
              onChange={(e) => setScientificGenus(e.target.value)}
              placeholder="z.B. Quercus"
              className={inputClass}
            />
          </div>

          {/* Familie */}
          <div className="space-y-2">
            <Label htmlFor="family" className={labelClass}>
              Familie
            </Label>
            <Input
              id="family"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              placeholder="z.B. Fagaceae"
              className={inputClass}
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-2">
            <Label htmlFor="description" className={labelClass}>
              Beschreibung
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung der Gattung..."
              className={`${inputClass} min-h-24 resize-none`}
            />
          </div>

          {/* Hinweis */}
          <div className={`border rounded-lg p-3 ${!isLightUi ? "bg-blue-900/20 border-blue-700/40" : "bg-blue-50 border-blue-200"}`}>
            <p className={`text-xs ${!isLightUi ? "text-blue-200" : "text-blue-900"}`}>
              💡 <strong>Hinweis:</strong> Diese Änderungen werden auch in den Kollektionen aktualisiert.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !genusName.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichere...
                </>
              ) : (
                "Speichern"
              )}
            </Button>
            <Button
              onClick={handleClose}
              disabled={updateMutation.isPending}
              variant="outline"
              className={`flex-1 ${!isLightUi ? "border-stone-600 text-stone-300 hover:bg-stone-800" : ""}`}
            >
              Abbrechen
            </Button>
          </div>

          {updateMutation.isError && (
            <div className={`border rounded-lg p-3 ${!isLightUi ? "bg-red-900/20 border-red-700/40" : "bg-red-50 border-red-200"}`}>
              <p className={`text-xs ${!isLightUi ? "text-red-300" : "text-red-900"}`}>
                ❌ Fehler: {updateMutation.error?.message || "Speichern fehlgeschlagen"}
              </p>
            </div>
          )}

          {/* Trennlinie */}
          <hr className={`${!isLightUi ? "border-stone-700" : "border-stone-200"}`} />

          {/* Merge-Bereich */}
          <div>
            <button
              type="button"
              onClick={() => setShowMerge((v) => !v)}
              className={`flex items-center gap-2 text-sm font-semibold w-full ${!isLightUi ? "text-amber-400" : "text-amber-700"}`}
            >
              <GitMerge className="w-4 h-4" />
              In bestehende Gattung eingliedern (Duplikat-Fix)
              {showMerge ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </button>

            {showMerge && (
              <div className="mt-3 space-y-3">
                <p className={`text-xs ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
                  Alle Pflanzen dieser Gattung werden zur ausgewählten Ziel-Gattung verschoben, danach wird diese Gattung gelöscht. Verwende dies um Bug-Duplikate zu bereinigen.
                </p>
                <div className="space-y-2">
                  <Label className={labelClass}>Ziel-Gattung</Label>
                  <select
                    value={mergeTargetId}
                    onChange={(e) => { setMergeTargetId(e.target.value); setMergeError(""); }}
                    className={`w-full rounded-md border-2 px-3 py-2 text-sm focus:outline-none focus:border-green-500 ${
                      !isLightUi
                        ? "border-stone-600 bg-stone-800/60 text-stone-100"
                        : "border-stone-200 bg-white text-stone-900"
                    }`}
                  >
                    <option value="">-- Gattung wählen --</option>
                    {mergeTargetOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        [{g.category}] {g.genus_name} ({g.scientific_genus || "–"})
                      </option>
                    ))}
                  </select>
                </div>
                {mergeError && (
                  <p className={`text-xs ${!isLightUi ? "text-red-400" : "text-red-700"}`}>❌ {mergeError}</p>
                )}
                <Button
                  onClick={handleMerge}
                  disabled={isMerging || !mergeTargetId}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  {isMerging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Eingliedern...
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-4 h-4 mr-2" />
                      Jetzt eingliedern & löschen
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

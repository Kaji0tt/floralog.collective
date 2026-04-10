import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Query } from "@/api/entities";

export default function EditGenusDialog({ genus, isOpen, onClose, isLightUi = true }) {
  const queryClient = useQueryClient();
  const [genusName, setGenusName] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState("");
  const [scientificGenus, setScientificGenus] = useState("");

  useEffect(() => {
    if (genus && isOpen) {
      setGenusName(genus.genus_name || "");
      setDescription(genus.description || "");
      setFamily(genus.family || "");
      setScientificGenus(genus.scientific_genus || "");
    }
  }, [genus, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (payload) => Query.PlantGenus.update(payload.id, payload.data),
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
      },
    });
  };

  if (!genus) return null;

  const inputClass = `border-2 focus:border-green-500 ${!isLightUi ? "border-stone-600 bg-stone-800/60 text-stone-100 placeholder:text-stone-500" : "border-stone-200"}`;
  const labelClass = `font-semibold ${!isLightUi ? "text-stone-200" : ""}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`max-w-md w-[95vw] sm:w-full ${!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${!isLightUi ? "text-stone-100" : "text-stone-900"}`}>
            Gattung bearbeiten
          </DialogTitle>
          <DialogDescription className={`text-sm ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
            Passe den Namen und weitere Informationen dieser Gattung an
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
          <div className="flex gap-3 pt-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

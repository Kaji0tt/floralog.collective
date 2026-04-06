// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Query } from "@/api/entities";

export default function EditPlantDialog({ plant, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [speciesName, setSpeciesName] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (plant && isOpen) {
      setSpeciesName(plant.species_name || "");
      setScientificName(plant.scientific_name || "");
      setDescription(plant.description || "");
    }
  }, [plant, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (payload) => Query.Plant.update(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      handleClose();
    },
  });

  const handleClose = () => {
    setSpeciesName("");
    setScientificName("");
    setDescription("");
    onClose();
  };

  const handleSave = () => {
    if (!plant || !speciesName.trim()) return;

    updateMutation.mutate({
      id: plant.id,
      data: {
        species_name: speciesName.trim(),
        scientific_name: scientificName.trim() || null,
        description: description.trim() || null,
      },
    });
  };

  if (!plant) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-stone-900">
            Art bearbeiten
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-600">
            Passe Namen und Beschreibung dieser Art an
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="species-name" className="font-semibold">
              Deutscher Name *
            </Label>
            <Input
              id="species-name"
              value={speciesName}
              onChange={(e) => setSpeciesName(e.target.value)}
              placeholder="z.B. Stieleiche"
              className="border-2 border-stone-200 focus:border-green-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scientific-name" className="font-semibold">
              Wissenschaftlicher Name
            </Label>
            <Input
              id="scientific-name"
              value={scientificName}
              onChange={(e) => setScientificName(e.target.value)}
              placeholder="z.B. Quercus robur"
              className="border-2 border-stone-200 focus:border-green-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="species-description" className="font-semibold">
              Beschreibung
            </Label>
            <Textarea
              id="species-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung der Art..."
              className="border-2 border-stone-200 focus:border-green-500 min-h-24 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !speciesName.trim()}
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
              className="flex-1"
            >
              Abbrechen
            </Button>
          </div>

          {updateMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-900">
                Fehler: {updateMutation.error?.message || "Speichern fehlgeschlagen"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

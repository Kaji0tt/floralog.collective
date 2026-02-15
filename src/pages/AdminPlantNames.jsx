import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Edit, Loader2, Search } from "lucide-react";

export default function AdminPlantNames() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const updatePlantMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Plant.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
      setEditingId(null);
      setNewName("");
    },
  });

  // Filtere Pflanzen nach Suchbegriff
  const filteredPlants = plants.filter(plant => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      plant.species_name?.toLowerCase().includes(query) ||
      plant.scientific_name?.toLowerCase().includes(query) ||
      genera.find(g => g.id === plant.genus_id)?.genus_name?.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-stone-900 mb-3">
            Pflanzennamen bearbeiten 🔧
          </h1>
          <p className="text-lg text-stone-600">
            {plants.length} Pflanzen im Floralog
          </p>
        </div>

        <Card className="mb-6 border-2 border-green-200">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-5 h-5" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche nach Pflanzennamen (deutsch, lateinisch oder Gattung)..."
                className="pl-10 text-lg"
              />
            </div>
            {searchQuery && (
              <p className="text-sm text-stone-600 mt-2">
                {filteredPlants.length} {filteredPlants.length === 1 ? 'Pflanze' : 'Pflanzen'} gefunden
              </p>
            )}
          </CardContent>
        </Card>

        {filteredPlants.length === 0 ? (
          <Card className="border-2 border-stone-200">
            <CardContent className="p-8 text-center">
              <Search className="w-16 h-16 text-stone-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                Keine Pflanzen gefunden
              </h3>
              <p className="text-stone-600">
                Versuche einen anderen Suchbegriff.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPlants.map((plant) => {
              const genus = genera.find(g => g.id === plant.genus_id);
              const isEditing = editingId === plant.id;

              return (
                <Card key={plant.id} className="border-2 border-orange-200">
                  <CardHeader className="bg-orange-50">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {plant.image_url && (
                          <img
                            src={plant.image_url}
                            alt={plant.species_name}
                            className="w-16 h-16 object-cover rounded-lg border-2 border-stone-200"
                          />
                        )}
                        <div>
                          <div className="text-xl font-bold text-stone-900">
                            {plant.species_name}
                          </div>
                          <div className="text-sm text-stone-600 italic">
                            {plant.scientific_name}
                          </div>
                          {genus && (
                            <Badge className="mt-1 bg-green-600 text-white">
                              {genus.genus_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isEditing ? (
                      <div className="flex gap-3">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Neuer deutscher Name"
                          className="flex-1"
                        />
                        <Button
                          onClick={() => {
                            updatePlantMutation.mutate({
                              id: plant.id,
                              data: { species_name: newName }
                            });
                          }}
                          disabled={!newName || updatePlantMutation.isPending}
                        >
                          Speichern
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setNewName("");
                          }}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button
                          onClick={() => {
                            setEditingId(plant.id);
                            setNewName(genus?.genus_name || "");
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Manuell ändern
                        </Button>
                        <Button
                          onClick={() => autoFixMutation.mutate({
                            plantId: plant.id,
                            genusId: plant.genus_id
                          })}
                          disabled={autoFixMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {autoFixMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            "✨ Auto-Korrektur"
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
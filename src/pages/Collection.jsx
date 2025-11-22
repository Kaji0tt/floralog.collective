import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Leaf } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import MobileBackButton from "../components/navigation/MobileBackButton";
import HintDialog from "../components/collection/HintDialog";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Collection() {
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: userDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user || !user.email) {
        return [];
      }
      const discoveries = await base44.entities.UserPlantDiscovery.list();
      return discoveries.filter(d => d.user === user.email || d.created_by === user.email);
    },
  });

  const isLoading = generaLoading || plantsLoading || discoveriesLoading;

  const generaWithDiscovery = genera.map(genus => {
    const genusPlants = plants.filter(p => p.genus_id === genus.id);
    const discoveredSpecies = genusPlants.filter(p =>
      userDiscoveries.some(d => d.plant_id === p.id)
    );
    return {
      ...genus,
      discovered: discoveredSpecies.length > 0,
      discoveredCount: discoveredSpecies.length,
      totalSpecies: genusPlants.length
    };
  }).sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
      return categoryOrder[a.category] - categoryOrder[b.category];
    }
    return (a.category_dex_number || 0) - (b.category_dex_number || 0);
  });

  const categories = ["Alle", "Bäume", "Sträucher", "Blumen"];

  const filteredGenera = activeCategory === "Alle"
    ? generaWithDiscovery
    : generaWithDiscovery.filter(g => g.category === activeCategory);

  const discoveredCount = filteredGenera.filter(g => g.discovered).length;
  const totalCount = filteredGenera.length;

  const discoveredSpecies = userDiscoveries.length;
  const totalSpecies = plants.length;

  const handleShowHint = (genus) => {
    setSelectedGenus(genus);
    setShowHintDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />

      <HintDialog
        genus={selectedGenus}
        isOpen={showHintDialog}
        onClose={() => setShowHintDialog(false)}
      />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm border border-stone-200">
              <div className="text-left">
                <div className="text-2xl font-bold text-green-700">{discoveredCount} / {totalCount}</div>
                <div className="text-sm font-medium text-stone-600">Gattungen</div>
              </div>
            </div>

            <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm border border-amber-200">
              <div className="text-left">
                <div className="text-2xl font-bold text-amber-700">{discoveredSpecies} / {totalSpecies}</div>
                <div className="text-sm font-medium text-stone-600">Arten</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-white border border-stone-200 p-1 h-auto shadow-sm">
              {categories.map(category => {
                const categoryGenera = category === "Alle"
                  ? generaWithDiscovery
                  : generaWithDiscovery.filter(g => g.category === category);
                const discovered = categoryGenera.filter(g => g.discovered).length;

                return (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold px-6 py-2"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{category}</span>
                      <Badge variant="secondary" className="bg-stone-100 text-xs font-semibold">
                        {discovered}/{categoryGenera.length}
                      </Badge>
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {filteredGenera.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-200">
              <Leaf className="w-12 h-12 text-stone-400" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">
              Keine Pflanzen in dieser Kategorie
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredGenera.map((genus) => (
              <GenusCard
                key={genus.id}
                genus={genus}
                onShowHint={handleShowHint}
                userDiscoveries={userDiscoveries}
                plants={plants}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
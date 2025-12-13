import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Leaf, Search } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import MobileBackButton from "../components/navigation/MobileBackButton";
import HintDialog from "../components/collection/HintDialog";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Collection() {
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [discoveryFilter, setDiscoveryFilter] = useState("Alle");
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    const genusPlants = plants.filter(p => 
      p.genus_category === genus.category && p.genus_number === genus.category_dex_number
    );
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
      return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999);
    }
    return (a.category_dex_number || 999999) - (b.category_dex_number || 999999);
  });

  const categories = ["Alle", "Bäume", "Sträucher", "Blumen"];

  const filteredGenera = generaWithDiscovery
    .filter(g => activeCategory === "Alle" || g.category === activeCategory)
    .filter(g => {
      if (discoveryFilter === "Entdeckt") return g.discovered;
      if (discoveryFilter === "Nicht entdeckt") return !g.discovered;
      return true;
    })
    .filter(g => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return g.genus_name?.toLowerCase().includes(query) ||
             g.scientific_genus?.toLowerCase().includes(query);
    });

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
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 mb-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-6 mb-4">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-green-700">{discoveredCount} / {totalCount}</div>
                <div className="text-xs font-medium text-stone-600">Gattungen</div>
              </div>
            </div>
            <div className="h-8 w-px bg-stone-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-amber-700">{discoveredSpecies} / {totalSpecies}</div>
                <div className="text-xs font-medium text-stone-600">Arten</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => {
                  const categoryGenera = category === "Alle"
                    ? generaWithDiscovery
                    : generaWithDiscovery.filter(g => g.category === category);
                  const discovered = categoryGenera.filter(g => g.discovered).length;
                  return (
                    <SelectItem key={category} value={category}>
                      {category} ({discovered}/{categoryGenera.length})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={discoveryFilter} onValueChange={setDiscoveryFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Alle">Alle</SelectItem>
                <SelectItem value="Entdeckt">Entdeckt</SelectItem>
                <SelectItem value="Nicht entdeckt">Nicht entdeckt</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>
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
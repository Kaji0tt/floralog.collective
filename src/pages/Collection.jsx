import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Leaf, ListTree, Map } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import MobileBackButton from "../components/navigation/MobileBackButton";
import HintDialog from "../components/collection/HintDialog";
import PlantCard from "../components/collection/PlantCard";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

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
      } catch (error) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

export default function Collection() {
  const [viewMode, setViewMode] = useState("genera"); // "genera" oder "species"
  const [selectedExpedition, setSelectedExpedition] = useState(null);
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

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

  const { data: expeditions = [] } = useQuery({
    queryKey: ['expeditions'],
    queryFn: () => base44.entities.Expedition.list('expedition_number'),
  });

  const { data: userExpeditions = [] } = useQuery({
    queryKey: ['userExpeditions'],
    queryFn: () => base44.entities.UserExpedition.list(),
    enabled: !!user?.email,
  });

  const isLoading = generaLoading || plantsLoading || discoveriesLoading;

  // Filtere basierend auf Expedition
  let filteredPlants = plants;
  let filteredGenera = genera;

  if (selectedExpedition) {
    const expedition = expeditions.find(e => e.id === selectedExpedition);
    if (expedition) {
      // Filtere nach Pflanzen-IDs
      if (expedition.target_plants && expedition.target_plants.length > 0) {
        filteredPlants = plants.filter(p => expedition.target_plants.includes(p.id));
      }
      
      // Filtere nach Gattungen
      if (expedition.target_genera && expedition.target_genera.length > 0) {
        filteredGenera = genera.filter(g => 
          expedition.target_genera.some(tg => 
            tg.category === g.category && tg.category_dex_number === g.category_dex_number
          )
        );
        
        // Filtere Pflanzen nach den gefilterten Gattungen
        filteredPlants = filteredPlants.filter(p =>
          filteredGenera.some(g => 
            g.category === p.genus_category && g.category_dex_number === p.genus_number
          )
        );
      }
    }
  }

  const generaWithDiscovery = filteredGenera.map(genus => {
    const genusPlants = filteredPlants.filter(p => 
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

  const plantsWithDiscovery = filteredPlants.map(plant => ({
    ...plant,
    discovered: userDiscoveries.some(d => d.plant_id === plant.id)
  })).sort((a, b) => {
    if (a.genus_category !== b.genus_category) {
      const categoryOrder = { "Bäume": 1, "Sträucher": 2, "Blumen": 3 };
      return (categoryOrder[a.genus_category] || 999) - (categoryOrder[b.genus_category] || 999);
    }
    if (a.genus_number !== b.genus_number) {
      return (a.genus_number || 999999) - (b.genus_number || 999999);
    }
    return (a.species_name || "").localeCompare(b.species_name || "");
  });

  const discoveredCount = generaWithDiscovery.filter(g => g.discovered).length;
  const totalCount = generaWithDiscovery.length;

  const discoveredSpeciesCount = plantsWithDiscovery.filter(p => p.discovered).length;
  const totalSpeciesCount = plantsWithDiscovery.length;

  useEffect(() => {
    if (user?.background_color) {
      setAverageColor(user.background_color);
    } else if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [user?.background_image_url, user?.background_color]);

  const handleShowHint = (genus) => {
    setSelectedGenus(genus);
    setShowHintDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

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

  return (
    <>
      {/* Fixer Hintergrund */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: averageColor 
            ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      />
      
      {/* Scrollbarer Content */}
      <div className="min-h-screen p-4 md:p-8">
        <MobileBackButton />

      <HintDialog
        genus={selectedGenus}
        isOpen={showHintDialog}
        onClose={() => setShowHintDialog(false)}
      />

      {/* Fixed Filter Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Toggle Button Links */}
            <Button
              onClick={() => setViewMode(viewMode === "genera" ? "species" : "genera")}
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
            >
              {viewMode === "genera" ? <ListTree className="w-4 h-4" /> : <Map className="w-4 h-4" />}
            </Button>

            {/* Titel + Stats */}
            <div className="flex-1 text-center">
              <h1 className="font-bold text-stone-900 text-sm sm:text-base leading-tight">
                {user?.display_name || user?.full_name || 'Dein'}'s Floralog
              </h1>
              <div className="flex items-center justify-center gap-3 text-xs mt-1">
                <span className="font-semibold text-green-700">
                  {discoveredCount}/{totalCount} Gattungen
                </span>
                <span className="text-stone-400">•</span>
                <span className="font-semibold text-amber-700">
                  {discoveredSpeciesCount}/{totalSpeciesCount} Arten
                </span>
              </div>
            </div>

            {/* Expedition Select Rechts */}
            <Select value={selectedExpedition || "all"} onValueChange={(value) => setSelectedExpedition(value === "all" ? null : value)}>
              <SelectTrigger className="bg-white h-9 w-32 flex-shrink-0">
                <SelectValue placeholder="Alle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {expeditions.filter(e => e.is_active !== false).map(expedition => (
                  <SelectItem key={expedition.id} value={expedition.id}>
                    {expedition.icon_emoji} {expedition.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content with top padding for fixed filter */}
      <div className="max-w-7xl mx-auto pt-24">
        {viewMode === "genera" ? (
          generaWithDiscovery.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-200">
                <Leaf className="w-12 h-12 text-stone-400" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-2">
                Keine Gattungen gefunden
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {generaWithDiscovery.map((genus) => (
                <GenusCard
                  key={genus.id}
                  genus={genus}
                  onShowHint={handleShowHint}
                  userDiscoveries={userDiscoveries}
                  plants={filteredPlants}
                />
              ))}
            </div>
          )
        ) : (
          plantsWithDiscovery.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-200">
                <Leaf className="w-12 h-12 text-stone-400" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-2">
                Keine Arten gefunden
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {plantsWithDiscovery.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  userDiscoveries={userDiscoveries}
                  genera={genera}
                />
              ))}
            </div>
          )
        )}
      </div>
      </div>
    </>
  );
}
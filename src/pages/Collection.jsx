import React, { useState, useEffect } from "react";
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
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [discoveryFilter, setDiscoveryFilter] = useState("Alle");
  const [selectedGenus, setSelectedGenus] = useState(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      if (["Häufig", "Gelegentlich", "Selten", "Sehr Selten", "Extrem Selten"].includes(discoveryFilter)) {
        const genusPlants = plants.filter(p => 
          p.genus_category === g.category && p.genus_number === g.category_dex_number
        );
        return genusPlants.some(p => 
          p.rarity === discoveryFilter && 
          userDiscoveries.some(d => d.plant_id === p.id)
        );
      }
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

  useEffect(() => {
    if (user?.background_image_url) {
      getAverageColor(user.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else if (user?.background_color) {
      setAverageColor(user.background_color);
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
    <div 
      className="min-h-screen p-4 md:p-8"
      style={{
        background: averageColor 
          ? `linear-gradient(135deg, ${getLighterColor(averageColor)} 0%, ${averageColor} 50%, ${getDarkerColor(averageColor)} 100%)`
          : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
      }}
    >
      <MobileBackButton />

      <HintDialog
        genus={selectedGenus}
        isOpen={showHintDialog}
        onClose={() => setShowHintDialog(false)}
      />

      {/* Fixed Filter Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="text-center">
              <div className="text-sm font-bold text-green-700">{discoveredCount}/{totalCount}</div>
              <div className="text-[10px] font-medium text-stone-600">Gattungen</div>
            </div>
            <div className="h-6 w-px bg-stone-200"></div>
            <div className="text-center">
              <div className="text-sm font-bold text-amber-700">{discoveredSpecies}/{totalSpecies}</div>
              <div className="text-[10px] font-medium text-stone-600">Arten</div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Select value={activeCategory} onValueChange={setActiveCategory}>
                <SelectTrigger className="bg-white flex-1 h-9">
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
                <SelectTrigger className="bg-white flex-1 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alle">Alle</SelectItem>
                  <SelectItem value="Entdeckt">Entdeckt</SelectItem>
                  <SelectItem value="Nicht entdeckt">Nicht entdeckt</SelectItem>
                  <SelectItem value="Häufig">Häufig</SelectItem>
                  <SelectItem value="Gelegentlich">Gelegentlich</SelectItem>
                  <SelectItem value="Selten">Selten</SelectItem>
                  <SelectItem value="Sehr Selten">Sehr Selten</SelectItem>
                  <SelectItem value="Extrem Selten">Extrem Selten</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400" />
              <Input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-white h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content with top padding for fixed filter */}
      <div className="max-w-7xl mx-auto pt-28">

        {filteredGenera.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-200">
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
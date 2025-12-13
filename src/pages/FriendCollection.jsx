import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Leaf } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function FriendCollection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [friendUser, setFriendUser] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadFriendUser = async () => {
      // Versuche PublicProfile zu laden
      const profiles = await base44.entities.PublicProfile.list();
      const profile = profiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
      
      if (profile) {
        setFriendUser(profile);
      } else {
        // Fallback
        setFriendUser({
          email: friendEmail,
          full_name: friendEmail,
          display_name: friendEmail,
          level: 1
        });
      }
    };
    if (friendEmail) {
      loadFriendUser();
    }
  }, [friendEmail]);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: friendDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['friendDiscoveries', friendEmail],
    queryFn: async () => {
      // Nutze das neue "user" Feld (mit Fallback auf created_by für alte Einträge)
      const discoveries = await base44.entities.UserPlantDiscovery.list();
      return discoveries.filter(d => d.user === friendEmail || d.created_by === friendEmail);
    },
    enabled: !!friendEmail,
  });

  const isLoading = generaLoading || plantsLoading || discoveriesLoading;

  const friendPlantIds = friendDiscoveries.map(d => d.plant_id);
  const friendPlants = plants.filter(p => friendPlantIds.includes(p.id));

  const generaWithNumbers = genera.map((genus, index) => {
    if (!genus.category_dex_number) {
      const categoryGenera = genera.filter(g =>
        g.category === genus.category &&
        g.category_dex_number &&
        g.id !== genus.id
      );
      const highestNumber = Math.max(0, ...categoryGenera.map(g => g.category_dex_number));
      const tempNumber = highestNumber + index + 1;

      return {
        ...genus,
        category_dex_number: tempNumber
      };
    }
    return genus;
  });

  const generaWithDiscovery = generaWithNumbers.map(genus => {
    const genusPlants = friendPlants.filter(p => 
      p.genus_category === genus.category && p.genus_number === genus.category_dex_number
    );
    const allGenusPlants = plants.filter(p => 
      p.genus_category === genus.category && p.genus_number === genus.category_dex_number
    );
    return {
      ...genus,
      discovered: genusPlants.length > 0,
      discoveredCount: genusPlants.length,
      totalSpecies: allGenusPlants.length
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

  if (isLoading || !friendUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton backUrl={createPageUrl(`FriendProfile?email=${friendEmail}`)} />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="flex flex-col items-center relative mb-4"
          >
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedMessage(true);
                setTimeout(() => setCopiedMessage(false), 2000);
              }}
              className="flex items-center justify-center gap-4 p-2 rounded-lg hover:bg-stone-100 transition-colors duration-200 cursor-pointer"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                {friendUser.avatar_url ? (
                  <img src={friendUser.avatar_url} alt={friendUser.full_name} className="w-full h-full object-cover" />
                ) : (
                  <img src={LOGO_URL} alt="PlantDex" className="w-8 h-8 object-contain" />
                )}
              </div>
              <div className="text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-stone-900">
                  {friendUser.full_name}'s PlantDex
                </h1>
                <p className="text-lg text-stone-600">
                  Level {friendUser.level || 1} • {friendUser.selected_title || friendUser.title || "Pflanzen-Anfänger"}
                </p>
              </div>
            </button>
            {copiedMessage && (
              <Badge className="mt-2 bg-green-500 text-white shadow-sm">
                Link kopiert!
              </Badge>
            )}
          </div>
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm border border-stone-200">
            <div className="text-left">
              <div className="text-2xl font-bold text-green-700">{discoveredCount} / {totalCount}</div>
              <div className="text-sm font-medium text-stone-600">Gattungen entdeckt</div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
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

        {/* Genera Grid */}
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
                userDiscoveries={friendDiscoveries}
                plants={plants}
                friendEmail={friendEmail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
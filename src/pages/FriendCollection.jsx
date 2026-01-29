import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Leaf, Search } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MobileBackButton from "../components/navigation/MobileBackButton";

export default function FriendCollection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [discoveryFilter, setDiscoveryFilter] = useState("Alle");
  const [searchQuery, setSearchQuery] = useState("");
  const [friendUser, setFriendUser] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isNotFriend, setIsNotFriend] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadFriendUser = async () => {
      if (!friendEmail || !currentUser?.email) return;
      
      // Prüfe Freundschaftsstatus
      const allFriends = await base44.entities.Friend.list();
      const currentEmailLower = currentUser.email.toLowerCase();
      const friendEmailLower = friendEmail.toLowerCase();
      
      const friendship = allFriends.find(f =>
        ((f.request_sent_by?.toLowerCase() === currentEmailLower && 
          f.request_sent_to?.toLowerCase() === friendEmailLower) ||
         (f.request_sent_by?.toLowerCase() === friendEmailLower && 
          f.request_sent_to?.toLowerCase() === currentEmailLower)) &&
        f.status === 'accepted'
      );
      
      if (!friendship) {
        setIsNotFriend(true);
        return;
      }
      
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
  }, [friendEmail, currentUser?.email]);

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
          friendDiscoveries.some(d => d.plant_id === p.id)
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
  
  const totalDiscoveredGenera = generaWithDiscovery.filter(g => g.discovered).length;
  const totalGeneraCount = generaWithDiscovery.length;

  if (isNotFriend) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Zugriff verweigert</h2>
          <p className="text-stone-600 mb-6">
            Du musst mit dieser Person befreundet sein, um ihre Sammlung zu sehen.
          </p>
          <button
            onClick={() => navigate(createPageUrl("Friends"))}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
          >
            Zurück zu Freunden
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !friendUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton backUrl={createPageUrl(`FriendProfile?email=${friendEmail}`)} />
      
      {/* Fixed Filter Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-center flex-1">
              <div className="text-sm font-bold text-green-700">{totalDiscoveredGenera}/{totalGeneraCount}</div>
              <div className="text-[10px] font-medium text-stone-600">Gattungen</div>
            </div>
            
            <div className="h-6 w-px bg-stone-200"></div>
            
            <h1 className="text-center flex-1 font-bold text-stone-900 text-xs sm:text-sm md:text-base lg:text-lg px-1 leading-tight line-clamp-2">
              {friendUser.display_name || friendUser.full_name}'s Floralog
            </h1>
            
            <div className="h-6 w-px bg-stone-200"></div>
            
            <div className="text-center flex-1">
              <div className="text-sm font-bold text-amber-700">{friendDiscoveries.length}/{plants.length}</div>
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
      <div className="max-w-7xl mx-auto pt-32">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
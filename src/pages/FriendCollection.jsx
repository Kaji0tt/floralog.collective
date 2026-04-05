import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Leaf, SlidersHorizontal } from "lucide-react";
import GenusCard from "../components/collection/GenusCard";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MobileBackButton from "../components/navigation/MobileBackButton";
import SearchSortBar from "../components/collection/SearchSortBar";

const CATEGORY_CHIPS = [
  { value: "Bäume", emoji: "🌳" },
  { value: "Sträucher", emoji: "🌿" },
  { value: "Blumen", emoji: "🌸" },
];

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
        resolve("rgb(" + r + ", " + g + ", " + b + ")");
      } catch (error) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

export default function FriendCollection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [discoveredFilter, setDiscoveredFilter] = useState("all");
  const [friendUser, setFriendUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isNotFriend, setIsNotFriend] = useState(false);
  const [averageColor, setAverageColor] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadFriendUser = async () => {
      if (!friendEmail || !currentUser?.email) return;
      
      // Prüfe Freundschaftsstatus
      const allFriends = await Query.Friend.list();
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
      const profiles = await Query.PublicProfile.list();
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

  useEffect(() => {
    if (friendUser?.background_color) {
      setAverageColor(friendUser.background_color);
    } else if (friendUser?.background_image_url) {
      getAverageColor(friendUser.background_image_url).then(color => {
        if (color) setAverageColor(color);
      });
    } else {
      setAverageColor(null);
    }
  }, [friendUser?.background_image_url, friendUser?.background_color]);

  const { data: genera = [], isLoading: generaLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
  });

  const { data: friendDiscoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ['friendDiscoveries', friendUser?.auth_id],
    queryFn: async () => {
      // Nutze bevorzugt auth_id des Freundes, damit RLS-Policies greifen können
      if (!friendUser?.auth_id) {
        return [];
      }
      return Query.UserPlantDiscovery.filter({ auth_id: friendUser.auth_id });
    },
    enabled: !!friendUser?.auth_id,
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

  let filteredGenera = generaWithDiscovery;
  if (discoveredFilter === "undiscovered") {
    filteredGenera = filteredGenera.filter(g => !g.discovered);
  } else if (discoveredFilter === "discovered") {
    filteredGenera = filteredGenera.filter(g => g.discovered);
  }

  if (activeCategory) {
    filteredGenera = filteredGenera.filter(g => g.category === activeCategory);
  }

  filteredGenera = filteredGenera.filter(g => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (g.genus_name?.toLowerCase().includes(query) ||
        g.scientific_genus?.toLowerCase().includes(query)) {
      return true;
    }
    return plants.some(p =>
      p.genus_category === g.category &&
      p.genus_number === g.category_dex_number &&
      (p.species_name?.toLowerCase().includes(query) ||
       p.scientific_name?.toLowerCase().includes(query))
    );
  });

  const totalDiscoveredGenera = generaWithDiscovery.filter(g => g.discovered).length;
  const totalGeneraCount = generaWithDiscovery.length;
  const heroProgressPercent = totalGeneraCount
    ? Math.round((totalDiscoveredGenera / totalGeneraCount) * 100)
    : 0;
  const heroTitle = (friendUser?.display_name || friendUser?.full_name || friendEmail) + "'s Floralog";
  const listTopFadePx = 12;

  const getLighterColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
    const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
    const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
    return "rgb(" + r + ", " + g + ", " + b + ")";
  };

  const getDarkerColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.floor(parseInt(match[1]) * 0.6);
    const g = Math.floor(parseInt(match[2]) * 0.6);
    const b = Math.floor(parseInt(match[3]) * 0.6);
    return "rgb(" + r + ", " + g + ", " + b + ")";
  };

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
    <div className="relative min-h-screen">
      {/* Fixer Hintergrund */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: averageColor
            ? "linear-gradient(135deg, "
              + getLighterColor(averageColor)
              + " 0%, "
              + averageColor
              + " 50%, "
              + getDarkerColor(averageColor)
              + " 100%)"
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      />

      {/* Scrollbarer Content */}
      <div className="h-screen p-4 md:p-8 overflow-hidden">
        <MobileBackButton backUrl={createPageUrl(`FriendProfile?email=${friendEmail}`)} />

        <div className="max-w-7xl mx-auto h-full pt-0 flex flex-col gap-3">
          <div className="shrink-0 space-y-3">
            {/* Hero-Kachel */}
            <div
              className="bg-white/80 rounded-2xl border shadow-sm p-3 flex flex-col gap-3"
              style={{
                borderColor: averageColor || 'rgba(148, 163, 184, 0.35)',
              }}
            >
              <div className="space-y-1">
                <h1 className="text-lg font-bold text-stone-900 leading-tight">
                  {heroTitle}
                </h1>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-stone-600">
                    <div className="flex items-center gap-1">
                      <span>Sammlungsfortschritt</span>
                      {totalGeneraCount > 0 && (
                        <span className="text-[10px] text-stone-500">
                          ({totalDiscoveredGenera}/{totalGeneraCount})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span>{heroProgressPercent}%</span>
                      {CATEGORY_CHIPS.map((categoryChip) => {
                        const isActive = activeCategory === categoryChip.value;
                        return (
                          <button
                            key={categoryChip.value}
                            type="button"
                            onClick={() => setActiveCategory(isActive ? null : categoryChip.value)}
                            className={
                              "p-1 rounded-full border transition-colors " +
                              (isActive
                                ? "bg-stone-100 text-stone-700 border-emerald-500"
                                : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200")
                            }
                            aria-label={categoryChip.value + (isActive ? " deaktivieren" : " filtern")}
                            aria-pressed={isActive}
                          >
                            <span className="text-[11px] leading-none">{categoryChip.emoji}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setFiltersOpen((prev) => !prev)}
                        className={
                          "p-1 rounded-full transition-colors " +
                          (filtersOpen
                            ? "bg-stone-200 text-stone-800"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200")
                        }
                        aria-label={filtersOpen ? "Suche und Filter ausblenden" : "Suche und Filter einblenden"}
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: heroProgressPercent + '%',
                        backgroundColor: averageColor || 'rgb(34, 197, 94)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Suche & Filter (per Icon ein- und ausblendbar) */}
            {filtersOpen && (
              <div className="space-y-2">
                <SearchSortBar
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  showSortControls={false}
                  showDiscoveredToggle
                  discoveredFilter={discoveredFilter}
                  onDiscoveredFilterChange={setDiscoveredFilter}
                />
              </div>
            )}
          </div>

          {/* Collection Grid */}
          <div
            className="relative flex-1 min-h-0 overflow-y-auto pb-20"
            style={{
              WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
              maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black 100%)`,
            }}
          >
            {filteredGenera.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-200">
                  <Leaf className="w-12 h-12 text-stone-400" />
                </div>
                <h3 className="text-2xl font-bold text-stone-900 mb-2">
                  Keine Pflanzen gefunden
                </h3>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" style={{ paddingTop: listTopFadePx }}>
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
      </div>
    </div>
  );
}

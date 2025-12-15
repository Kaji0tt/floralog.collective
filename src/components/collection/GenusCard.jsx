import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, TreeDeciduous, Flower2, Leaf, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

const categoryIcons = {
  "Bäume": TreeDeciduous,
  "Sträucher": Leaf,
  "Blumen": Flower2
};

export default function GenusCard({ genus, onShowHint, userDiscoveries = [], plants = [], friendEmail }) {
  const navigate = useNavigate();
  const discovered = genus.discovered;
  const [isFlipped, setIsFlipped] = React.useState(false);
  const CategoryIcon = categoryIcons[genus.category] || TreeDeciduous;

  // Hole das Gattungsbild: Front-Image bevorzugt, sonst neuestes
  const genusDiscoveries = userDiscoveries.filter(d => {
    const plant = plants.find(p => p.id === d.plant_id);
    return plant && plant.genus_category === genus.category && plant.genus_number === genus.category_dex_number && d.image_url;
  });
  const genusImage = genusDiscoveries.find(d => d.is_front_image)?.image_url || 
                     genusDiscoveries.sort((a, b) => new Date(b.discovered_date) - new Date(a.discovered_date))[0]?.image_url;

  // Ermittle höchste Rarität der entdeckten Pflanzen dieser Gattung
  const rarityOrder = { "Häufig": 0, "Gelegentlich": 1, "Selten": 2, "Sehr Selten": 3, "Extrem Selten": 4 };
  const discoveredPlants = plants.filter(p => 
    p.genus_category === genus.category && p.genus_number === genus.category_dex_number && userDiscoveries.some(d => d.plant_id === p.id)
  );
  const highestRarity = discoveredPlants.reduce((max, plant) => {
    const plantRarity = rarityOrder[plant.rarity] || 0;
    return plantRarity > max ? plantRarity : max;
  }, 0);

  // Bestimme Rahmenfarbe basierend auf höchster Rarität
  const getBorderColor = () => {
    if (!discovered) return 'border-stone-200';
    if (highestRarity >= 3) return 'border-purple-400'; // Sehr Selten oder höher
    if (highestRarity === 2) return 'border-blue-400'; // Selten
    if (highestRarity === 1) return 'border-green-400'; // Gelegentlich
    return 'border-gray-400'; // Häufig
  };

  const handleClick = () => {
    if (discovered) {
      // Wenn friendEmail vorhanden, füge es zur URL hinzu
      const url = friendEmail 
        ? createPageUrl(`GenusDetail?id=${genus.id}&email=${friendEmail}`)
        : createPageUrl(`GenusDetail?id=${genus.id}`);
      navigate(url);
    } else {
      // Kachel umdrehen und Gattungsname zeigen
      setIsFlipped(true);
      setTimeout(() => {
        setIsFlipped(false);
      }, 3000);
    }
  };

  const handleHelpClick = (e) => {
    e.stopPropagation();
    if (onShowHint) {
      onShowHint(genus);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: discovered ? 1.05 : 1.02 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card
        className={`cursor-pointer overflow-hidden border-2 shadow-sm transition-all duration-300 ${
          discovered 
            ? `${getBorderColor()} hover:shadow-lg bg-white` 
            : 'border-stone-200 opacity-60 hover:opacity-75 hover:border-stone-300 bg-stone-50'
        }`}
        onClick={handleClick}
      >
        <CardContent className="p-2">
          {/* Dex Number Badge */}
          <div className="flex justify-between items-start mb-2">
            <Badge className="bg-stone-800 text-white font-bold text-[10px] px-1.5 py-0.5">
              {genus.category === "Bäume" && "🌳"}
              {genus.category === "Sträucher" && "🌿"}
              {genus.category === "Blumen" && "🌸"}
              #{String(genus.category_dex_number).padStart(3, '0')}
            </Badge>
            {discovered ? (
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            ) : (
              <div 
                className="w-5 h-5 bg-stone-400 rounded-full flex items-center justify-center hover:bg-stone-500 transition-colors cursor-pointer"
                onClick={handleHelpClick}
              >
                <HelpCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Image */}
          <div className="relative mb-2">
            <motion.div 
              className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 z-10"
              style={{ perspective: 1000 }}
            >
              {discovered && genusImage ? (
                <img
                  src={genusImage}
                  alt={genus.genus_name}
                  className="w-full h-full object-cover"
                />
              ) : (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <CategoryIcon className="w-12 h-12 text-stone-300" strokeWidth={1.5} />
                </motion.div>
                <motion.div
                  className="absolute inset-0 flex items-center justify-center text-center px-2"
                  style={{ 
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)"
                  }}
                >
                  <p className="font-bold text-stone-700 break-words text-xs">
                    {genus.genus_name}
                  </p>
                </motion.div>
              </motion.div>
            )}
            </motion.div>
          </div>

          {/* Name and Progress */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold break-words text-xs leading-tight ${discovered ? 'text-stone-900' : 'text-stone-500'}`}>
                {discovered ? genus.genus_name : '???'}
              </h3>
            </div>

            {discovered && (
              <div className="text-[10px] font-semibold text-green-700 whitespace-nowrap">
                {genus.discoveredCount}/{genus.totalSpecies}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
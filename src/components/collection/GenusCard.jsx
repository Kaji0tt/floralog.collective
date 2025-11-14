
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
  const CategoryIcon = categoryIcons[genus.category] || TreeDeciduous;

  // Hole das erste Bild dieser Gattung aus den UserDiscoveries
  const genusImage = userDiscoveries.find(d => {
    const plant = plants.find(p => p.id === d.plant_id);
    return plant && plant.genus_id === genus.id && d.image_url;
  })?.image_url;

  const handleClick = () => {
    if (discovered) {
      // Wenn friendEmail vorhanden, füge es zur URL hinzu
      const url = friendEmail 
        ? createPageUrl(`GenusDetail?id=${genus.id}&email=${friendEmail}`)
        : createPageUrl(`GenusDetail?id=${genus.id}`);
      navigate(url);
    } else if (onShowHint) {
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
            ? 'border-green-300 hover:shadow-lg bg-white' 
            : 'border-stone-200 opacity-60 hover:opacity-75 hover:border-stone-300 bg-stone-50'
        }`}
        onClick={handleClick}
      >
        <CardContent className="p-4">
          {/* Dex Number Badge */}
          <div className="flex justify-between items-start mb-3">
            <Badge className="bg-stone-800 text-white font-bold text-sm px-2 py-1">
              {genus.category === "Bäume" && "🌳"}
              {genus.category === "Sträucher" && "🌿"}
              {genus.category === "Blumen" && "🌸"}
              #{String(genus.category_dex_number).padStart(3, '0')}
            </Badge>
            {discovered && (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          {/* Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-stone-100 to-stone-200">
            {discovered && genusImage ? (
              <img
                src={genusImage}
                alt={genus.genus_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <CategoryIcon className="w-16 h-16 text-stone-300" strokeWidth={1.5} />
                {!discovered && (
                  <div className="absolute bottom-2 right-2 bg-stone-400 rounded-full p-1">
                    <HelpCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Name */}
          <h3 className={`text-base font-bold mb-1 ${discovered ? 'text-stone-900' : 'text-stone-500'}`}>
            {discovered ? genus.genus_name : '???'}
          </h3>
          
          <p className={`text-xs italic mb-2 ${discovered ? 'text-stone-600' : 'text-stone-400'}`}>
            {discovered ? genus.scientific_genus : ''}
          </p>

          {/* Progress Badge */}
          {discovered && (
            <Badge variant="outline" className="border border-green-500 text-green-700 bg-green-50 font-semibold mb-2 text-xs">
              {genus.discoveredCount}/{genus.totalSpecies} Arten
            </Badge>
          )}

          {/* Category Badge */}
          <Badge className={`${discovered ? 'bg-green-600' : 'bg-stone-600'} text-white font-semibold text-xs`}>
            {genus.category}
          </Badge>
        </CardContent>
      </Card>
    </motion.div>
  );
}

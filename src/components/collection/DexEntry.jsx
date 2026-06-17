
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, TreeDeciduous, Flower2, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import {
  getConservationFromPlant,
  getRarityBadgeClass,
  getRarityBorderClass,
  getRarityStars,
} from "@/lib/conservationStatus";

const categoryColors = {
  "Bäume": "from-green-600 to-emerald-700",
  "Sträucher": "from-blue-600 to-cyan-700",
  "Blumen & Kräuter": "from-purple-600 to-pink-700"
};

const categoryIcons = {
  "Bäume": TreeDeciduous,
  "Sträucher": Leaf,
  "Blumen & Kräuter": Flower2
};

export default function DexEntry({ plant }) {
  const navigate = useNavigate();
  const discovered = plant.discovered;
  const CategoryIcon = categoryIcons[plant.category] || TreeDeciduous;
  const conservation = getConservationFromPlant(plant);
  const rarityStars = getRarityStars(conservation.populationRaw);
  const rarityBadgeClass = getRarityBadgeClass(conservation.populationRaw);

  return (
    <motion.div
      whileHover={{ scale: discovered ? 1.05 : 1.02 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card
        className={`cursor-pointer overflow-hidden border-4 shadow-xl transition-all duration-300 ${
          discovered 
            ? `${getRarityBorderClass(conservation.populationRaw, true)} hover:shadow-2xl` 
            : 'border-gray-400 opacity-75 hover:opacity-90'
        }`}
        onClick={() => discovered && navigate(createPageUrl(`PlantDetail?id=${plant.id}`))}
      >
        <div className={`h-2 bg-gradient-to-r ${categoryColors[plant.category]}`} />
        
        <CardContent className="p-4">
          {/* Dex Number Badge */}
          <div className="flex justify-between items-start mb-3">
            <Badge className="bg-gray-800 text-white font-black text-lg px-3 py-1">
              #{String(plant.dex_number).padStart(3, '0')}
            </Badge>
            {discovered && (
              <div className="flex gap-1">
                {Array.from({ length: rarityStars.length }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
            )}
          </div>

          {/* Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-gray-200 to-gray-300">
            {discovered && plant.image_url ? (
              <img
                src={plant.image_url}
                alt={plant.common_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <CategoryIcon className="w-20 h-20 text-gray-400" strokeWidth={1.5} />
              </div>
            )}
            
            {discovered && (
              <div className="absolute top-2 right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Name */}
          <h3 className={`text-lg font-black mb-1 ${discovered ? 'text-gray-900' : 'text-gray-500'}`}>
            {discovered ? plant.common_name : '???'}
          </h3>
          
          <p className={`text-sm italic mb-2 ${discovered ? 'text-gray-600' : 'text-gray-400'}`}>
            {discovered ? plant.scientific_name : 'Noch nicht entdeckt'}
          </p>

          {/* Category and Subcategory Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`${discovered ? rarityBadgeClass : 'bg-gray-400 text-white'} font-bold`}>
              {plant.category}
            </Badge>
            {discovered && plant.subcategory && (
              <Badge variant="outline" className="border-2 border-gray-300 bg-white font-bold text-gray-700">
                {plant.subcategory}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

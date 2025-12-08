import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function PlantCard({ plant }) {
  const navigate = useNavigate();

  const getRarityBorderColor = (rarity) => {
    switch (rarity) {
      case "Häufig": return "border-gray-400 hover:border-gray-500";
      case "Gelegentlich": return "border-green-500 hover:border-green-600";
      case "Selten": return "border-purple-500 hover:border-purple-600";
      case "Sehr Selten": return "border-orange-500 hover:border-orange-600";
      case "Extrem Selten": return "border-red-500 hover:border-red-600";
      default: return "border-gray-400 hover:border-gray-500";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`group cursor-pointer overflow-hidden border-2 hover:shadow-2xl transition-all duration-300 ${getRarityBorderColor(plant.rarity)}`}
        onClick={() => navigate(createPageUrl(`PlantDetail?id=${plant.id}`))}
      >
        <div className="relative aspect-square overflow-hidden">
          <img
            src={plant.image_url}
            alt={plant.common_name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
              <ExternalLink className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <CardContent className="p-5">
          <h3 className="font-bold text-xl text-gray-900 mb-1 line-clamp-1 group-hover:text-green-700 transition-colors">
            {plant.common_name}
          </h3>
          <p className="text-sm text-gray-600 italic mb-3 line-clamp-1">
            {plant.scientific_name}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
              {plant.family}
            </Badge>
          </div>

          <div className="flex items-center text-xs text-gray-500 gap-2">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(plant.scan_date), "d. MMM yyyy", { locale: de })}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
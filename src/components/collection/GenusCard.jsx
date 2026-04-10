import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, TreeDeciduous, Flower2, Leaf, HelpCircle, PencilIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import EditGenusDialog from "./EditGenusDialog";

const categoryIcons = {
  "Bäume": TreeDeciduous,
  "Sträucher": Leaf,
  "Blumen": Flower2
};

export default function GenusCard({ genus, onShowHint, userDiscoveries = [], plants = [], friendEmail, collectionNote, isAdmin = false, uiTheme = "dark" }) {
  const navigate = useNavigate();
  const discovered = genus.discovered;
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const CategoryIcon = categoryIcons[genus.category] || TreeDeciduous;
  const isLightUi = uiTheme === "light";

  const getDiscoveryTimestamp = (discovery) => {
    const raw = discovery?.discovered_date || discovery?.created_date || discovery?.created_at;
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Hole das Gattungsbild: Front-Image bevorzugt, sonst neuestes
  const genusDiscoveries = userDiscoveries.filter(d => {
    const plant = plants.find(p => p.id === d.plant_id);
    return plant && plant.genus_category === genus.category && plant.genus_number === genus.category_dex_number && d.image_url;
  });
  const genusImage =
    genusDiscoveries.find((d) => d.is_front_image)?.image_url ||
    genusDiscoveries.find((d) => d.is_species_front_image)?.image_url ||
    [...genusDiscoveries].sort((a, b) => getDiscoveryTimestamp(b) - getDiscoveryTimestamp(a))[0]?.image_url;

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
    if (!discovered) return isLightUi ? 'border-stone-300' : 'border-stone-500/55';
    if (highestRarity >= 3) return isLightUi ? 'border-fuchsia-500/75' : 'border-fuchsia-300/80';
    if (highestRarity === 2) return isLightUi ? 'border-sky-600/70' : 'border-sky-300/80';
    if (highestRarity === 1) return isLightUi ? 'border-emerald-600/70' : 'border-emerald-300/80';
    return isLightUi ? 'border-amber-700/55' : 'border-[#f0e5a5]/45';
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

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsEditOpen(true);
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: discovered ? 1.05 : 1.02 }}
        whileTap={{ scale: 0.95 }}
      >
        <Card
          className={`cursor-pointer overflow-hidden border-2 shadow-sm transition-all duration-300 ${
            discovered 
              ? `${getBorderColor()} hover:shadow-lg ${isLightUi ? "bg-white/95" : "bg-[#171a17]/88"}`
              : `${getBorderColor()} ${isLightUi ? "opacity-70 hover:opacity-85 hover:border-stone-400 bg-stone-100/90" : "opacity-65 hover:opacity-85 hover:border-stone-400/70 bg-[#111412]/80"}`
          }`}
          onClick={handleClick}
        >
          <CardContent className="p-2">
            {/* Dex Number Badge */}
            <div className="flex justify-between items-start mb-2">
              <Badge className={"font-bold text-[10px] px-1.5 py-0.5 " + (isLightUi ? "bg-stone-800 text-white" : "bg-[#f0e5a5]/20 text-[#f8f1c8] border border-[#f0e5a5]/30") }>
                {genus.category === "Bäume" && "🌳"}
                {genus.category === "Sträucher" && "🌿"}
                {genus.category === "Blumen" && "🌸"}
                #{String(genus.category_dex_number).padStart(3, '0')}
              </Badge>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className={"shrink-0 w-5 h-5 rounded-full border transition-colors inline-flex items-center justify-center " + (isLightUi
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 border-amber-300"
                      : "bg-[#f0e5a5]/20 text-[#f0e5a5] hover:bg-[#f0e5a5]/30 border-[#f0e5a5]/45")}
                    aria-label="Gattung bearbeiten"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                )}
                {discovered ? (
                  <div className={"w-5 h-5 rounded-full flex items-center justify-center " + (isLightUi ? "bg-emerald-600" : "bg-emerald-500/90") }>
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div 
                    className={"w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer " + (isLightUi ? "bg-stone-400 hover:bg-stone-500" : "bg-stone-600 hover:bg-stone-500") }
                    onClick={handleHelpClick}
                  >
                    <HelpCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Image */}
            <div className="relative mb-2">
              <motion.div 
                className={"relative aspect-square rounded-lg overflow-hidden z-10 " + (isLightUi ? "bg-gradient-to-br from-stone-100 to-stone-200" : "bg-gradient-to-br from-stone-800/85 to-stone-900/95")}
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
                    <CategoryIcon className={"w-12 h-12 " + (isLightUi ? "text-stone-300" : "text-stone-500")} strokeWidth={1.5} />
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center text-center px-2"
                    style={{ 
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)"
                    }}
                  >
                    <p className={"font-bold break-words text-xs " + (isLightUi ? "text-stone-700" : "text-stone-200")}>
                      {genus.genus_name}
                    </p>
                  </motion.div>
                </motion.div>
              )}
              </motion.div>
            </div>

            {/* Name, Progress & optionale Kollektions-Notiz */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold break-words text-xs leading-tight ${discovered ? (isLightUi ? 'text-stone-900' : 'text-stone-100') : (isLightUi ? 'text-stone-500' : 'text-stone-300')}`}>
                    {discovered ? genus.genus_name : '???'}
                  </h3>
                </div>

                {discovered && (
                  <div className={"text-[10px] font-semibold whitespace-nowrap " + (isLightUi ? "text-emerald-700" : "text-emerald-300") }>
                    {genus.discoveredCount}/{genus.totalSpecies}
                  </div>
                )}
              </div>

              {!!collectionNote?.trim() && (
                <div className="max-h-14 overflow-y-auto pr-1">
                  <p className={"text-[10px] font-normal leading-snug whitespace-pre-wrap break-words " + (isLightUi ? "text-stone-500" : "text-stone-300/85")}>
                    {collectionNote}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <EditGenusDialog
        genus={genus}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        isLightUi={isLightUi}
      />
    </>
  );
}
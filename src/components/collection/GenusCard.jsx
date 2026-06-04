import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, TreeDeciduous, Flower2, Leaf, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import EditGenusDialog from "./EditGenusDialog";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";

const categoryIcons = {
  "Bäume": TreeDeciduous,
  "Sträucher": Leaf,
  "Blumen": Flower2,
  "Blumen & Kräuter": Flower2
};

export default function GenusCard({
  genus,
  onShowHint,
  userDiscoveries = [],
  plants = [],
  selectedCollectionId = "global",
  friendEmail,
  friendDiscoveries = [],
  friendDiscoveryCount = 0,
  collectionNote,
  isAdmin = false,
  uiTheme = "dark",
}) {
  const navigate = useNavigate();
  const discovered = genus.discovered;
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [showCategoryIcon, setShowCategoryIcon] = React.useState(true);
  const longPressTimerRef = React.useRef(null);
  const longPressTriggeredRef = React.useRef(false);
  const longPressStartPointRef = React.useRef(null);
  const longPressMovementCancelledRef = React.useRef(false);
  const headerRowRef = React.useRef(null);
  const CategoryIcon = categoryIcons[genus.category] || TreeDeciduous;
  const isLightUi = uiTheme === "light";
  const showFriendLogos = friendDiscoveryCount > 0;
  const visibleFriendLogos = (friendDiscoveries || []).slice(0, 3);
  const remainingFriendCount = Math.max(0, friendDiscoveryCount - visibleFriendLogos.length);

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
    if (highestRarity === 4) return isLightUi ? 'border-red-500/80' : 'border-red-300/85';
    if (highestRarity === 3) return isLightUi ? 'border-orange-500/80' : 'border-orange-300/85';
    if (highestRarity === 2) return isLightUi ? 'border-fuchsia-500/75' : 'border-fuchsia-300/80';
    if (highestRarity === 1) return isLightUi ? 'border-emerald-600/70' : 'border-emerald-300/80';
    return isLightUi ? 'border-amber-700/55' : 'border-[#f0e5a5]/45';
  };

  const handleClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const nextParams = new URLSearchParams();
    nextParams.set("id", genus.id);
    if (friendEmail) {
      nextParams.set("email", friendEmail);
    } else if (selectedCollectionId && selectedCollectionId !== "global") {
      nextParams.set("collectionId", selectedCollectionId);
    }

    const url = createPageUrl(`GenusDetail?${nextParams.toString()}`);
    navigate(url);
  };

  const handleHelpClick = (e) => {
    e.stopPropagation();
    if (onShowHint) {
      onShowHint(genus);
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPointRef.current = null;
    longPressMovementCancelledRef.current = false;
  };

  const handleLongPressStart = (clientX = null, clientY = null) => {
    if (!isAdmin) return;

    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressMovementCancelledRef.current = false;
    if (typeof clientX === "number" && typeof clientY === "number") {
      longPressStartPointRef.current = { x: clientX, y: clientY };
    }
    longPressTimerRef.current = window.setTimeout(() => {
      if (longPressMovementCancelledRef.current) return;
      longPressTriggeredRef.current = true;
      setIsEditOpen(true);
    }, 3000);
  };

  const handleLongPressMove = (clientX = null, clientY = null) => {
    if (!isAdmin || longPressMovementCancelledRef.current) return;
    if (!longPressTimerRef.current || !longPressStartPointRef.current) return;
    if (typeof clientX !== "number" || typeof clientY !== "number") return;

    const deltaX = Math.abs(clientX - longPressStartPointRef.current.x);
    const deltaY = Math.abs(clientY - longPressStartPointRef.current.y);
    const movementThresholdPx = 8;

    if (deltaX > movementThresholdPx || deltaY > movementThresholdPx) {
      longPressMovementCancelledRef.current = true;
      clearLongPress();
    }
  };

  React.useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, []);

  React.useEffect(() => {
    const headerRow = headerRowRef.current;
    if (!headerRow || typeof ResizeObserver === "undefined") return;

    const updateCategoryIconVisibility = () => {
      const rowWidth = headerRow.getBoundingClientRect().width;
      const hasFriendLogos = showFriendLogos;
      const compactThreshold = hasFriendLogos ? 154 : 132;
      setShowCategoryIcon(rowWidth >= compactThreshold);
    };

    updateCategoryIconVisibility();
    const observer = new ResizeObserver(updateCategoryIconVisibility);
    observer.observe(headerRow);

    return () => observer.disconnect();
  }, [showFriendLogos, selectedCollectionId, genus.category, genus.category_dex_number]);

  return (
    <>
      <motion.div
        whileHover={{ scale: discovered ? 1.05 : 1.02 }}
        whileTap={{ scale: 0.95 }}
      >
        <Card
          className={`relative cursor-pointer overflow-hidden border-2 shadow-sm transition-all duration-300 ${
            discovered 
              ? `${getBorderColor()} hover:shadow-lg ${isLightUi ? "bg-white/95" : "bg-black/45"}`
              : `${getBorderColor()} ${isLightUi ? "opacity-85 hover:opacity-100 hover:border-stone-400 bg-stone-100/90" : "opacity-85 hover:opacity-100 hover:border-stone-400/70 bg-black/45"}`
          }`}
          onClick={handleClick}
          onMouseDown={(event) => handleLongPressStart(event.clientX, event.clientY)}
          onMouseMove={(event) => handleLongPressMove(event.clientX, event.clientY)}
          onMouseUp={clearLongPress}
          onMouseLeave={clearLongPress}
          onTouchStart={(event) => {
            const touch = event.touches?.[0] || event.changedTouches?.[0];
            handleLongPressStart(touch?.clientX ?? null, touch?.clientY ?? null);
          }}
          onTouchMove={(event) => {
            const touch = event.touches?.[0] || event.changedTouches?.[0];
            handleLongPressMove(touch?.clientX ?? null, touch?.clientY ?? null);
          }}
          onTouchEnd={clearLongPress}
          onTouchCancel={clearLongPress}
        >
          <CardContent className="p-2">
            {/* Dex Number Badge */}
            <div ref={headerRowRef} className="flex justify-between items-start mb-2">
              <Badge className={"font-bold text-[10px] px-1.5 py-0.5 " + (isLightUi ? "bg-stone-800 text-white" : "bg-[#f0e5a5]/20 text-[#f8f1c8] border border-[#f0e5a5]/30") }>
                {showCategoryIcon && genus.category === "Bäume" && "🌳"}
                {showCategoryIcon && genus.category === "Sträucher" && "🌿"}
                {showCategoryIcon && genus.category === "Blumen" && "🌸"}
                {showCategoryIcon && genus.category === "Blumen & Kräuter" && "🌸"}
                #{String(genus.category_dex_number).padStart(3, '0')}
              </Badge>
              <div className="flex items-center gap-1">
                {showFriendLogos && (
                  <div className="mr-1 flex items-center">
                    {visibleFriendLogos.map((entry, index) => (
                      <div
                        key={entry.authId || entry.email || index}
                        className="w-5 h-5 rounded-full overflow-hidden bg-black/35"
                        style={{ marginLeft: index === 0 ? 0 : -6 }}
                        title={entry.name || entry.email || "Freund"}
                      >
                        <CustomLogoAvatar
                          logoAssets={entry.logoAssets}
                          className="w-full h-full"
                          fallbackText={(entry.name || entry.email || "?").charAt(0).toUpperCase()}
                          fallbackClassName="text-[9px] font-bold text-white"
                        />
                      </div>
                    ))}
                    {remainingFriendCount > 0 && (
                      <div
                        className={"w-5 h-5 -ml-1.5 rounded-full border text-[9px] font-semibold flex items-center justify-center " + (isLightUi
                          ? "bg-sky-100 text-sky-800 border-sky-400/60"
                          : "bg-sky-500/20 text-sky-100 border-sky-200/55")}
                        title={`+${remainingFriendCount} weitere Freunde`}
                      >
                        +{remainingFriendCount}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Image */}
            <div className="relative mb-2">
              <motion.div 
                className={"relative aspect-square rounded-lg overflow-hidden z-10 " + (isLightUi ? "bg-gradient-to-br from-stone-100 to-stone-200" : "bg-gradient-to-br from-stone-800/85 to-stone-900/95")}
              >
                {discovered && genusImage ? (
                  <img
                    src={genusImage}
                    alt={genus.genus_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CategoryIcon className={"w-12 h-12 " + (isLightUi ? "text-stone-300" : "text-stone-500")} strokeWidth={1.5} />
                  </div>
                )}

                {discovered ? (
                  <div className={"absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm " + (isLightUi ? "bg-emerald-600" : "bg-emerald-500/90") }>
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div
                    className={"absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-sm " + (isLightUi ? "bg-stone-400 hover:bg-stone-500" : "bg-stone-600 hover:bg-stone-500") }
                    onClick={handleHelpClick}
                  >
                    <HelpCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Name, Progress & optionale Kollektions-Notiz */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold break-words text-xs leading-tight ${discovered ? (isLightUi ? 'text-stone-900' : 'text-stone-100') : (isLightUi ? 'text-stone-500' : 'text-stone-300')}`}>
                    {genus.genus_name}
                  </h3>
                </div>

                <div className={"text-[10px] font-semibold whitespace-nowrap " + (discovered
                  ? (isLightUi ? "text-emerald-700" : "text-emerald-300")
                  : (isLightUi ? "text-stone-600" : "text-stone-300"))}>
                  {genus.discoveredCount}/{genus.totalSpecies}
                </div>
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
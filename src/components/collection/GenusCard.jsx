import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, TreeDeciduous, Flower2, Leaf, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import EditGenusDialog from "./EditGenusDialog";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { getPopulationScore, getRarityBorderClass } from "@/lib/conservationStatus";

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
  const longPressTimerRef = React.useRef(null);
  const longPressTriggeredRef = React.useRef(false);
  const longPressStartPointRef = React.useRef(null);
  const longPressMovementCancelledRef = React.useRef(false);
  const headerRowRef = React.useRef(null);
  const [isCoarsePointer, setIsCoarsePointer] = React.useState(false);
  const [logoOverlap, setLogoOverlap] = React.useState(-6);
  const badgeRef = React.useRef(null);
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

  // Ermittle höchste Seltenheit aus red_list_population der entdeckten Pflanzen.
  const discoveredPlants = plants.filter(p => 
    p.genus_category === genus.category && p.genus_number === genus.category_dex_number && userDiscoveries.some(d => d.plant_id === p.id)
  );
  const highestConservation = discoveredPlants.reduce((max, plant) => {
    const population = plant?.red_list_population ?? plant?.aiData?.red_list_population ?? null;
    const score = getPopulationScore(population);
    return score > max.score ? { score, population } : max;
  }, { score: 0, population: null });

  // Bestimme Rahmenfarbe basierend auf höchster Rarität
  const getBorderColor = () => {
    if (!discovered) return isLightUi ? 'border-stone-300' : 'border-stone-500/55';
    return getRarityBorderClass(highestConservation.population, isLightUi);
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const apply = () => setIsCoarsePointer(mediaQuery.matches);
    apply();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", apply);
      return () => mediaQuery.removeEventListener("change", apply);
    }

    mediaQuery.addListener(apply);
    return () => mediaQuery.removeListener(apply);
  }, []);

  React.useEffect(() => {
    if (!showFriendLogos || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const rowEl = headerRowRef.current;
      const badgeEl = badgeRef.current;
      if (!rowEl || !badgeEl) return;

      const rowWidth = rowEl.getBoundingClientRect().width;
      const badgeWidth = badgeEl.getBoundingClientRect().width;
      const logoCount = visibleFriendLogos.length + (remainingFriendCount > 0 ? 1 : 0);
      const logoSize = 20;
      const availableForLogos = rowWidth - badgeWidth;
      const minNeeded = logoSize + (logoCount - 1) * (logoSize - 10);

      if (logoCount <= 1 || availableForLogos >= minNeeded) {
        setLogoOverlap(-6);
      } else {
        const maxOverlap = logoSize - 6;
        const needed = logoSize + (logoCount - 1) * (logoSize - maxOverlap);
        const ratio = Math.min(1, (availableForLogos - logoSize) / Math.max(1, needed - logoSize));
        const overlap = Math.round(-6 - (maxOverlap - 6) * (1 - ratio));
        setLogoOverlap(Math.max(-14, overlap));
      }
    };

    update();
    const observer = new ResizeObserver(update);
    if (headerRowRef.current) observer.observe(headerRowRef.current);
    if (badgeRef.current) observer.observe(badgeRef.current);

    return () => observer.disconnect();
  }, [showFriendLogos, visibleFriendLogos.length, remainingFriendCount, selectedCollectionId]);

  return (
    <>
      <motion.div
        whileHover={{ scale: discovered ? 1.05 : 1.02 }}
        whileTap={isCoarsePointer ? undefined : { scale: 0.95 }}
        style={{ touchAction: "pan-y" }}
      >
        <Card
          className={`relative cursor-pointer overflow-hidden border-2 shadow-sm transition-all duration-300 ${
            discovered 
              ? `${getBorderColor()} hover:shadow-lg ${isLightUi ? "bg-white/95" : "bg-black/45"}`
              : `${getBorderColor()} ${isLightUi ? "opacity-85 hover:opacity-100 hover:border-stone-400 bg-stone-100/90" : "opacity-85 hover:opacity-100 hover:border-stone-400/70 bg-black/45"}`
          }`}
          style={{ touchAction: "pan-y" }}
          onClick={handleClick}
        >
          <CardContent className="p-2">
            {/* Dex Number Badge */}
            <div ref={headerRowRef} className="flex justify-between items-start mb-2">
              <Badge
                ref={badgeRef}
                className={"font-bold text-[10px] px-1.5 py-0.5 shrink-0 " + (isLightUi ? "bg-stone-800 text-white" : "bg-[#f0e5a5]/20 text-[#f8f1c8] border border-[#f0e5a5]/30") }
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
                {genus.category === "Bäume" && "🌳"}
                {genus.category === "Sträucher" && "🌿"}
                {genus.category === "Blumen" && "🌸"}
                {genus.category === "Blumen & Kräuter" && "🌸"}
                #{String(genus.category_dex_number).padStart(3, '0')}
              </Badge>
              <div className="flex items-center">
                {showFriendLogos && (
                  <div className="flex items-center">
                    {visibleFriendLogos.map((entry, index) => (
                      <div
                        key={entry.authId || entry.email || index}
                        className="w-5 h-5 rounded-full overflow-hidden bg-black/35"
                        style={{ marginLeft: index === 0 ? 0 : logoOverlap }}
                        title={entry.name || entry.email || "Freund"}
                      >
                        <CustomLogoAvatar
                          logoAssets={entry.logoAssets}
                          className="w-full h-full"
                          tooltipText={entry.name || entry.email || "Freund"}
                          fallbackText={(entry.name || entry.email || "?").charAt(0).toUpperCase()}
                          fallbackClassName="text-[9px] font-bold text-white"
                        />
                      </div>
                    ))}
                    {remainingFriendCount > 0 && (
                      <div
                        className={"w-5 h-5 rounded-full border text-[9px] font-semibold flex items-center justify-center " + (isLightUi
                          ? "bg-sky-100 text-sky-800 border-sky-400/60"
                          : "bg-sky-500/20 text-sky-100 border-sky-200/55")}
                        style={{ marginLeft: logoOverlap }}
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
              </motion.div>
            </div>

            {/* Name, Progress & optionale Kollektions-Notiz */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1 min-w-0">
                    {discovered ? (
                      <CheckCircle className={"w-3.5 h-3.5 mt-0.5 flex-shrink-0 " + (isLightUi ? "text-emerald-600" : "text-emerald-300")} />
                    ) : (
                      <button
                        type="button"
                        className={"mt-0.5 flex-shrink-0 rounded-full transition-colors " + (isLightUi ? "text-stone-500 hover:text-stone-700" : "text-stone-300 hover:text-stone-100")}
                        onClick={handleHelpClick}
                        aria-label={`Hinweis zu ${genus.genus_name} anzeigen`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <h3 className={`font-bold break-words text-xs leading-tight ${discovered ? (isLightUi ? 'text-stone-900' : 'text-stone-100') : (isLightUi ? 'text-stone-500' : 'text-stone-300')}`}>
                      {genus.genus_name}
                    </h3>
                  </div>
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
import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listRobotPlantShopItems,
  listRobotPlantInventory,
  listRobotPlantActiveEffects,
  purchaseRobotPlantShopItem,
  useRobotPlantInventoryItem,
} from "@/api/robotPlantService";
import { getCurrentUser } from "@/api/userApi";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2, RefreshCw, Sparkles, ShoppingBag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const KNOWN_CATEGORY_ORDER = ["fertilizer", "accessory", "background"];
const CATEGORY_META = {
  fertilizer: {
    title: "Duenger",
    subtitle: "Pflege-Boosts fuer deine Pflanze",
  },
  accessory: {
    title: "Accessoires",
    subtitle: "Kosmetische Extras und Freischaltungen",
  },
  background: {
    title: "Hintergruende",
    subtitle: "Neue Stimmungen fuer deine Home-Ansicht",
  },
  all: {
    title: "Alle Artikel",
    subtitle: "Gesamtes Sortiment im Ueberblick",
  },
};

const formatCategoryLabel = (value) => {
  if (!value) return "Sonstiges";
  const normalized = String(value).trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getShopItemDetailText = (item) => {
  const detailParts = [];

  if (item?.description) {
    detailParts.push(item.description);
  }

  if (Number(item?.effect_value || 0) > 0 && Number(item?.duration_hours || 0) > 0) {
    detailParts.push(
      `Reduziert den taeglichen Verfall deiner Pflanze um ${Math.round(Number(item.effect_value) * 100)}% fuer ${item.duration_hours} Stunden.`
    );
  }

  if (detailParts.length === 0) {
    detailParts.push("Dieses Item erweitert deinen Shop um weitere Pflege- oder Kosmetikoptionen.");
  }

  return detailParts.join(" ");
};

/**
 * Self-contained shop panel. Follows the same architecture pattern as
 * AchievementsFeatureRoot and FriendsFeatureRoot.
 *
 * @param {{ embedded?: boolean, playerSeeds: number, initialCategory?: string, authId?: string | null, onHeaderMetaChange?: Function }} props
 */
export default function ShopFeatureRoot({
  embedded = true,
  playerSeeds = 0,
  initialCategory = "fertilizer",
  authId = null,
  onHeaderMetaChange,
}) {
  const { isLightUi } = useUiTheme();
  const queryClient = useQueryClient();

  const [shopCategory, setShopCategory] = useState(initialCategory);
  const [careActionMessage, setCareActionMessage] = useState(null);
  const [lastResolvedCategory, setLastResolvedCategory] = useState(initialCategory);
  const [purchaseQuantities, setPurchaseQuantities] = useState({});
  const [selectedShopItemId, setSelectedShopItemId] = useState(null);

  const { data: fallbackUser = null } = useQuery({
    queryKey: ["shopCurrentUser"],
    queryFn: () => getCurrentUser(),
    enabled: !authId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const resolvedAuthId = authId || fallbackUser?.id || null;

  const {
    data: robotPlantShopItems,
    isPending: isShopItemsPending,
    isFetching: isShopItemsFetching,
    error: shopItemsError,
    refetch: refetchShopItems,
  } = useQuery({
    queryKey: ["robotPlantShopItems", resolvedAuthId],
    queryFn: () => listRobotPlantShopItems(),
    enabled: !!resolvedAuthId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const { data: robotPlantInventory = [] } = useQuery({
    queryKey: ["robotPlantInventory", resolvedAuthId],
    queryFn: () => listRobotPlantInventory(resolvedAuthId),
    enabled: !!resolvedAuthId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: robotPlantActiveEffects = [] } = useQuery({
    queryKey: ["robotPlantActiveEffects", resolvedAuthId],
    queryFn: () => listRobotPlantActiveEffects(resolvedAuthId),
    enabled: !!resolvedAuthId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const shopItems = Array.isArray(robotPlantShopItems) ? robotPlantShopItems : [];

  useEffect(() => {
    setShopCategory(initialCategory || "fertilizer");
  }, [initialCategory]);

  const categoryCounts = shopItems.reduce((acc, item) => {
    const itemType = item?.item_type || "other";
    acc[itemType] = (acc[itemType] || 0) + 1;
    return acc;
  }, {});

  const dynamicCategories = Object.keys(categoryCounts).filter(
    (category) => !KNOWN_CATEGORY_ORDER.includes(category)
  );

  const categoryChips = [
    ...KNOWN_CATEGORY_ORDER.filter((category) => categoryCounts[category] > 0 || category === initialCategory),
    ...dynamicCategories,
    "all",
  ].map((categoryKey) => ({
    key: categoryKey,
    label: CATEGORY_META[categoryKey]?.title || formatCategoryLabel(categoryKey),
    count: categoryKey === "all"
      ? shopItems.length
      : (categoryCounts[categoryKey] || 0),
  }));

  useEffect(() => {
    const availableCategories = new Set(categoryChips.map((chip) => chip.key));
    if (availableCategories.size === 0) return;

    if (!availableCategories.has(shopCategory)) {
      const fallbackCategory = availableCategories.has(initialCategory)
        ? initialCategory
        : categoryChips[0]?.key || "all";

      if (fallbackCategory && fallbackCategory !== lastResolvedCategory) {
        setShopCategory(fallbackCategory);
        setLastResolvedCategory(fallbackCategory);
      }
      return;
    }

    if (shopCategory !== lastResolvedCategory) {
      setLastResolvedCategory(shopCategory);
    }
  }, [categoryChips, initialCategory, lastResolvedCategory, shopCategory]);

  const purchaseShopItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }) => purchaseRobotPlantShopItem({ itemId, quantity }),
    onSuccess: async (result) => {
      if (!result?.applied) {
        setCareActionMessage(
          result?.error_code === "insufficient_balance"
            ? "Nicht genug Samen fuer diesen Kauf."
            : "Kauf konnte nicht abgeschlossen werden."
        );
        return;
      }
      setCareActionMessage("Item gekauft.");
      await queryClient.invalidateQueries({ queryKey: ["robotPlantState"] });
      await queryClient.invalidateQueries({ queryKey: ["robotPlantInventory", resolvedAuthId] });
    },
    onError: () => {
      setCareActionMessage("Kauf fehlgeschlagen.");
    },
  });

  const useInventoryItemMutation = useMutation({
    mutationFn: ({ itemId }) => useRobotPlantInventoryItem({ itemId }),
    onSuccess: async (result) => {
      if (!result?.applied) {
        setCareActionMessage("Aktivierung fehlgeschlagen.");
        return;
      }
      setCareActionMessage("Duenger aktiviert.");
      await queryClient.invalidateQueries({ queryKey: ["robotPlantInventory", resolvedAuthId] });
      await queryClient.invalidateQueries({ queryKey: ["robotPlantActiveEffects", resolvedAuthId] });
    },
    onError: () => {
      setCareActionMessage("Aktivierung fehlgeschlagen.");
    },
  });

  const inventoryByItemId = Object.fromEntries(
    robotPlantInventory.map((entry) => [entry.item_id, entry.quantity || 0])
  );

  const updatePurchaseQuantity = (itemId, nextQuantity, maxAffordable) => {
    const clampedQuantity = maxAffordable <= 0
      ? 0
      : Math.max(1, Math.min(maxAffordable, nextQuantity));
    setPurchaseQuantities((current) => ({
      ...current,
      [itemId]: clampedQuantity,
    }));
  };

  const filteredShopItems = shopItems.filter((item) => {
    if (shopCategory === "all") return true;
    return item.item_type === shopCategory;
  });

  useEffect(() => {
    if (!selectedShopItemId) return;
    const stillVisible = filteredShopItems.some((item) => item.id === selectedShopItemId);
    if (!stillVisible) {
      setSelectedShopItemId(null);
    }
  }, [filteredShopItems, selectedShopItemId]);

  const activeDecayEffects = robotPlantActiveEffects
    .filter((effect) => effect.effect_type === "decay_reduction")
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());

  const activeDecayPercent = activeDecayEffects.reduce(
    (acc, effect) => acc + Number(effect.effect_value || 0),
    0
  );

  const isBusy = purchaseShopItemMutation.isPending || useInventoryItemMutation.isPending;
  const isAuthResolving = !resolvedAuthId;
  const showShopLoadingState = (isAuthResolving || isShopItemsPending) && shopItems.length === 0;
  const currentCategoryMeta = CATEGORY_META[shopCategory] || {
    title: formatCategoryLabel(shopCategory),
    subtitle: "Artikel in dieser Kategorie",
  };
  const tabsHeaderClass = embedded
    ? `sticky top-0 z-40 backdrop-blur-sm border-b ${isLightUi ? "bg-white/70 border-[#b99a48]/30" : "bg-black/20 border-[#f0e5a5]/20"}`
    : `sticky top-0 z-40 border-b ${isLightUi ? "bg-white/90 border-stone-200/80 backdrop-blur-xl" : "bg-stone-950/75 border-[#f0e5a5]/20 backdrop-blur-xl"}`;
  const bottomBarClass = embedded
    ? `shrink-0 backdrop-blur-sm border-t ${isLightUi ? "bg-white/70 border-[#b99a48]/30" : "bg-black/20 border-[#f0e5a5]/20"}`
    : `shrink-0 border-t ${isLightUi ? "bg-white/90 border-stone-200/80 backdrop-blur-xl" : "bg-stone-950/75 border-[#f0e5a5]/20 backdrop-blur-xl"}`;
  const contentClass = embedded ? "mt-0 px-4 pb-4 flex-1 min-h-0 overflow-y-auto" : "px-4 pb-8 pt-4";
  const listTopFadePx = 12;
  const listBottomFadePx = 18;
  const contentMaskStyle = embedded ? {
    WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
    maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
  } : undefined;

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function") return;

    onHeaderMetaChange({
      title: "Shop",
      subtitle: currentCategoryMeta.subtitle,
    });
  }, [currentCategoryMeta.subtitle, embedded, onHeaderMetaChange]);

  return (
    <section
      data-embedded-module="shop"
      data-theme={isLightUi ? "light" : "dark"}
      className="flex-1 min-h-0 overflow-hidden flex flex-col"
    >
      <div className={`${tabsHeaderClass} shrink-0`}>
        <div className="w-full px-2 py-2">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 px-2">
              {categoryChips.map((chip) => {
                const isPrimary = shopCategory === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setShopCategory(chip.key)}
                    className={
                      "flex items-center justify-center gap-2 px-2 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors min-w-fit " +
                      (isPrimary
                        ? (isLightUi
                          ? "bg-white/90 text-[#8f6b22] shadow-sm"
                          : "bg-black/55 text-[#f7f0c1] shadow-sm")
                        : (isLightUi
                          ? "bg-white/55 text-stone-700 hover:bg-white/75"
                          : "bg-black/35 text-stone-200 hover:bg-black/50"))
                    }
                    style={{
                      borderColor: isPrimary
                        ? (isLightUi ? "rgba(200,172,98,0.70)" : "rgba(240,229,165,0.75)")
                        : (isLightUi ? "rgba(200,172,98,0.35)" : "rgba(255,255,255,0.3)"),
                    }}
                  >
                    <span className="font-medium truncate">{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={contentClass} style={contentMaskStyle}>
        <div className="max-w-5xl mx-auto space-y-3" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
          {!!careActionMessage && (
            <div className={`text-[11px] md:text-xs ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
              {careActionMessage}
            </div>
          )}

          {showShopLoadingState ? (
            <div className="px-1 py-6 flex flex-col items-center justify-center gap-2 text-center">
              <Loader2 className={`w-6 h-6 animate-spin ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <div className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Shop wird geladen</div>
              <div className={`text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>Artikel werden aus der Datenbank geladen.</div>
            </div>
          ) : shopItemsError ? (
            <div className="px-1 py-6 flex flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag className={`w-6 h-6 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <div className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Shopdaten konnten nicht geladen werden</div>
              <div className={`text-xs max-w-md ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
                Statt eines stillen leeren Shops wird der Fehler jetzt sichtbar. Ein erneuter Abruf behebt in der Regel kurzzeitige Supabase-Aussetzer.
              </div>
              <button
                type="button"
                onClick={() => refetchShopItems()}
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-semibold border ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/65 text-stone-800"
                    : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isShopItemsFetching ? "animate-spin" : ""}`} />
                Erneut laden
              </button>
            </div>
          ) : filteredShopItems.length === 0 ? (
            <div className="px-1 py-6 flex flex-col items-center justify-center gap-2 text-center">
              <Sparkles className={`w-6 h-6 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <div className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Keine Artikel in dieser Kategorie</div>
              <div className={`text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
                Wechsle auf eine andere Kategorie oder pruefe spaeter erneut.
              </div>
            </div>
          ) : (
            filteredShopItems.map((item) => {
              const owned = inventoryByItemId[item.id] || 0;
              const canUse =
                owned > 0 &&
                Number(item.effect_value || 0) > 0 &&
                Number(item.duration_hours || 0) > 0;
              const itemDetailText = getShopItemDetailText(item);
              const seedCost = Math.max(1, Number(item.seed_cost || 0));
              const maxAffordable = Math.max(0, Math.floor(playerSeeds / seedCost));
              const selectedQuantity = maxAffordable <= 0
                ? 0
                : Math.max(1, Math.min(maxAffordable, Number(purchaseQuantities[item.id] || 1)));
              const isSelectedItem = selectedShopItemId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedShopItemId(item.id)}
                  className={`relative overflow-hidden rounded-2xl border backdrop-blur-md px-3 py-3 cursor-pointer transition-all duration-200 ease-out will-change-transform ${
                    isLightUi
                      ? "border-[#c8ac62]/35 bg-white/78"
                      : "border-[#f0e5a5]/30 bg-black/36"
                  } ${isSelectedItem
                    ? (isLightUi
                      ? "border-[#c8ac62]/75 ring-2 ring-[#c8ac62]/70 scale-[1.01] shadow-[0_0_0_1px_rgba(200,172,98,0.25),0_16px_34px_rgba(162,129,48,0.22),0_0_24px_rgba(200,172,98,0.30)]"
                      : "border-[#f0e5a5]/65 ring-2 ring-[#f0e5a5]/60 scale-[1.01] shadow-[0_0_0_1px_rgba(240,229,165,0.22),0_18px_36px_rgba(0,0,0,0.45),0_0_24px_rgba(240,229,165,0.25)]")
                    : (isLightUi
                      ? "shadow-[0_14px_32px_rgba(162,129,48,0.12)]"
                      : "shadow-[0_16px_34px_rgba(0,0,0,0.28)]")}`}
                >
                  <div className={`absolute left-0 top-0 h-full w-1 ${isLightUi ? "bg-[#c8ac62]/55" : "bg-[#f0e5a5]/55"}`} />
                  <div
                    className="absolute left-0 top-0 h-full w-16"
                    style={{
                      background: isLightUi
                        ? "linear-gradient(90deg, rgba(200,172,98,0.14) 0%, transparent 100%)"
                        : "linear-gradient(90deg, rgba(240,229,165,0.14) 0%, transparent 100%)",
                    }}
                  />
                  <div
                    className={`absolute inset-0 ${isSelectedItem ? (isLightUi ? "bg-white/42" : "bg-black/46") : (isLightUi ? "bg-white/30" : "bg-black/30")}`}
                    style={{ backdropFilter: "blur(10px)" }}
                  />
                  {isSelectedItem && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: isLightUi
                          ? "radial-gradient(circle at 82% 14%, rgba(200,172,98,0.34) 0%, rgba(200,172,98,0.06) 38%, rgba(255,255,255,0) 65%)"
                          : "radial-gradient(circle at 82% 14%, rgba(240,229,165,0.22) 0%, rgba(240,229,165,0.05) 42%, rgba(0,0,0,0) 68%)",
                        filter: "blur(8px)",
                      }}
                    />
                  )}

                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`text-sm font-semibold truncate ${isLightUi ? "text-stone-900" : "text-[#f8f4d6]"}`}>
                          {item.title}
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                isLightUi
                                  ? "bg-white/85 border-[#c8ac62]/45 text-[#8f6b22] hover:bg-white"
                                  : "bg-black/45 border-[#f0e5a5]/35 text-[#f0e5a5] hover:bg-black/60"
                              }`}
                              aria-label={`Mehr Informationen zu ${item.title}`}
                            >
                              <Info className="w-2.5 h-2.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className={isLightUi
                              ? "w-72 border-[#c8ac62]/55 bg-white/95 text-stone-800"
                              : "w-72 bg-emerald-950/95 border-amber-600/40 text-amber-50/90"}
                          >
                            <div className="space-y-2">
                              <h3 className={`text-sm font-semibold ${isLightUi ? "text-[#8f6b22]" : "text-amber-300"}`}>
                                {item.title}
                              </h3>
                              <p className={`text-xs ${isLightUi ? "text-stone-700" : "text-amber-50/80"}`}>
                                {itemDetailText}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className={`text-[11px] mt-1 line-clamp-2 ${isLightUi ? "text-stone-600" : "text-stone-300/90"}`}>
                        {item.description || itemDetailText}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 text-[11px] flex-shrink-0">
                      <div className={"rounded-full px-2 py-0.5 border " + (isLightUi ? "bg-white/75 border-[#c8ac62]/35 text-stone-700" : "bg-black/45 border-[#f0e5a5]/30 text-stone-100")}>
                        {item.seed_cost} Samen
                      </div>
                      {owned >= 1 && (
                        <div className={"rounded-full px-2 py-0.5 border " + (isLightUi ? "bg-white/75 border-[#c8ac62]/35 text-stone-700" : "bg-black/45 border-[#f0e5a5]/30 text-stone-100")}>
                          Inventar: {owned}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelectedItem && (
                    <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div
                        className={`inline-flex items-center h-[30px] rounded-full border overflow-hidden ${
                          isLightUi
                            ? "border-[#c8ac62]/55 bg-white/65 text-stone-800"
                            : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                        }`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={isBusy || selectedQuantity <= 1}
                          onClick={() => updatePurchaseQuantity(item.id, selectedQuantity - 1, maxAffordable)}
                          className={`h-full w-8 text-sm font-semibold disabled:opacity-35 ${
                            isLightUi ? "hover:bg-white/80" : "hover:bg-black/55"
                          }`}
                          aria-label={`Menge fuer ${item.title} verringern`}
                        >
                          -
                        </button>
                        <div className={`h-full min-w-12 px-2 flex items-center justify-center text-[11px] font-semibold border-x ${
                          isLightUi ? "border-[#c8ac62]/35" : "border-[#f0e5a5]/25"
                        }`}>
                          {selectedQuantity}
                        </div>
                        <button
                          type="button"
                          disabled={isBusy || maxAffordable <= 0 || selectedQuantity >= maxAffordable}
                          onClick={() => updatePurchaseQuantity(item.id, selectedQuantity + 1, maxAffordable)}
                          className={`h-full w-8 text-sm font-semibold disabled:opacity-35 ${
                            isLightUi ? "hover:bg-white/80" : "hover:bg-black/55"
                          }`}
                          aria-label={`Menge fuer ${item.title} erhoehen`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isBusy || maxAffordable <= 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          purchaseShopItemMutation.mutate({ itemId: item.id, quantity: selectedQuantity });
                        }}
                        className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border disabled:opacity-60 ${
                          isLightUi
                            ? "border-[#c8ac62]/55 bg-white/65 text-stone-800 hover:bg-white/85"
                            : "border-[#f0e5a5]/45 bg-black/40 text-stone-100 hover:bg-black/55"
                        }`}
                      >
                        Kaufen
                      </button>

                      {canUse && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(event) => {
                            event.stopPropagation();
                            useInventoryItemMutation.mutate({ itemId: item.id });
                          }}
                          className={`h-9 px-3 rounded-full text-[11px] font-semibold border disabled:opacity-60 ${
                            isLightUi
                              ? "border-emerald-500/50 bg-emerald-100/70 text-emerald-900"
                              : "border-emerald-400/40 bg-emerald-900/35 text-emerald-100"
                          }`}
                        >
                          Im Slot aktivieren
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={bottomBarClass}>
        <div className="w-full px-2 py-2">
          <div className="flex items-center justify-between gap-2 px-2">
            <span
              className={`inline-flex items-center h-8 rounded-full border px-3 text-[11px] font-semibold backdrop-blur-sm ${
                isLightUi
                  ? "border-[#c8ac62]/55 bg-white/65 text-[#8f6b22]"
                  : "border-[#f0e5a5]/35 bg-black/35 text-[#f0e5a5]"
              }`}
            >
              {playerSeeds} Samen
            </span>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center h-8 rounded-full border px-3 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                    isLightUi
                      ? "border-[#c8ac62]/55 bg-white/65 text-[#8f6b22] hover:bg-white/80"
                      : "border-[#f0e5a5]/35 bg-black/35 text-[#f0e5a5] hover:bg-black/50"
                  }`}
                >
                  Dünger: {Math.round(activeDecayPercent * 100)}%
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className={isLightUi
                  ? "w-72 border-[#c8ac62]/55 bg-white/95 text-stone-800"
                  : "w-72 bg-emerald-950/95 border-amber-600/40 text-amber-50/90"}
              >
                <div className="space-y-2">
                  <h3 className={`text-sm font-semibold ${isLightUi ? "text-[#8f6b22]" : "text-amber-300"}`}>
                    Dünger-Effekt
                  </h3>
                  <p className={`text-xs ${isLightUi ? "text-stone-700" : "text-amber-50/80"}`}>
                    Dünger reduziert den täglichen Verfall (Decay) deiner Pflanze. Der Prozentwert zeigt die aktuell aktive Gesamtreduktion durch laufende Effekte.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </section>
  );
}

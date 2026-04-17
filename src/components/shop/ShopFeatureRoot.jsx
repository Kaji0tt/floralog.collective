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
import { Loader2, RefreshCw, Sparkles, ShoppingBag } from "lucide-react";
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
    mutationFn: ({ itemId }) => purchaseRobotPlantShopItem({ itemId, quantity: 1 }),
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

  const filteredShopItems = shopItems.filter((item) => {
    if (shopCategory === "all") return true;
    return item.item_type === shopCategory;
  });

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

              return (
                <div
                  key={item.id}
                  className={`rounded-[1.4rem] border p-4 ${
                    isLightUi
                      ? "border-[#d9c48a]/45 bg-white/72 shadow-[0_14px_32px_rgba(162,129,48,0.12)]"
                      : "border-[#f0e5a5]/25 bg-black/30 shadow-[0_16px_34px_rgba(0,0,0,0.28)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>{item.title}</div>
                      <div className={`text-[11px] mt-1 ${isLightUi ? "text-stone-600" : "text-stone-300/80"}`}>{item.description || ""}</div>
                    </div>
                    <Badge className={`${isLightUi ? "bg-[#8f6b22] text-white" : "border border-[#d6b665]/55 bg-[#2b2412]/72 text-[#f6e7b7]"} shrink-0`}>
                      {item.seed_cost} Samen
                    </Badge>
                  </div>

                  <div className={`mt-3 flex flex-wrap items-center gap-2 text-[11px] ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
                    <span>Besitz: {owned}</span>
                    {Number(item.effect_value || 0) > 0 && Number(item.duration_hours || 0) > 0 ? (
                      <span>
                        Effekt: -{Math.round(Number(item.effect_value) * 100)}% Tages-Decay fuer {item.duration_hours}h
                      </span>
                    ) : (
                      <span>Ohne aktiven Soforteffekt</span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy || playerSeeds < Number(item.seed_cost || 0)}
                      onClick={() => purchaseShopItemMutation.mutate({ itemId: item.id })}
                      className={`h-9 px-3 rounded-xl text-xs font-semibold border disabled:opacity-60 ${
                        isLightUi
                          ? "border-[#c8ac62]/55 bg-white/65 text-stone-800"
                          : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                      }`}
                    >
                      Kaufen
                    </button>
                    {canUse && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => useInventoryItemMutation.mutate({ itemId: item.id })}
                        className={`h-9 px-3 rounded-xl text-xs font-semibold border disabled:opacity-60 ${
                          isLightUi
                            ? "border-emerald-500/50 bg-emerald-100/70 text-emerald-900"
                            : "border-emerald-400/40 bg-emerald-900/35 text-emerald-100"
                        }`}
                      >
                        Im Slot aktivieren
                      </button>
                    )}
                  </div>
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

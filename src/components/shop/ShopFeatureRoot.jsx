import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, RefreshCw, Image as ImageIcon, BadgeCheck, PaintBucket, Lock, ArrowRight } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { getUserWallet, grantWalletCurrency } from "@/api/walletService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import {
  getUnlockedProfileCustomizationCatalog,
  profileCustomizationCategoryComparator,
  resolveTitleValue,
} from "@/lib/profileCustomizationOptions";
import { LOGO_ACCESSORY_DEFAULTS } from "@/lib/logoAccessoryAssets";

const BORDER_COLOR_PRESETS = [
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#00c7be",
  "#0a84ff",
  "#5856d6",
  "#bf5af2",
  "#ff2d55",
  "#8e8e93",
  "#ffffff",
  "#000000",
];

const CATEGORY_META = {
  backgrounds: {
    title: "Hintergruende",
    subtitle: "Alle freigeschalteten Hintergründe fuer dein Profil",
    emptyLabel: "Noch keine Hintergrundoptionen freigeschaltet.",
  },
  titles: {
    title: "Titel",
    subtitle: "Alle freigeschalteten Titel fuer dein Profil",
    emptyLabel: "Noch keine Titel freigeschaltet.",
  },
  accessories: {
    title: "Accessoires",
    subtitle: "Austauschbare Teile fuer dein Home-Logo",
    emptyLabel: "Noch keine Accessoires verfuegbar.",
  },
};

const ACCESSORY_PURCHASABLE_REWARD_TYPES = new Set(["logo_accessory", "accessory"]);
const ACCESSORY_GRID_COLUMNS = 2;
const ACCESSORY_GRID_ROWS = 2;
const ACCESSORY_GRID_PAGE_SIZE = ACCESSORY_GRID_COLUMNS * ACCESSORY_GRID_ROWS;

const chunkIntoAccessoryPages = (options) => {
  const source = Array.isArray(options) ? options : [];
  if (source.length === 0) return [];

  const pages = [];
  for (let index = 0; index < source.length; index += ACCESSORY_GRID_PAGE_SIZE) {
    pages.push(source.slice(index, index + ACCESSORY_GRID_PAGE_SIZE));
  }
  return pages;
};

const getBackgroundSelectionState = (user, option) => {
  if (!option) return false;
  if (option.type === "color") {
    return !user?.background_image_url && user?.background_color === option.value;
  }
  return user?.background_image_url === option.value;
};

const getBackgroundButtonStyle = ({ isActive, isLightUi }) => {
  if (isActive) {
    return isLightUi
      ? "border-[#c8ac62]/80 ring-2 ring-[#c8ac62]/60 shadow-[0_10px_26px_rgba(162,129,48,0.24)]"
      : "border-[#f0e5a5]/70 ring-2 ring-[#f0e5a5]/55 shadow-[0_14px_28px_rgba(0,0,0,0.34)]";
  }

  return isLightUi
    ? "border-[#c8ac62]/35 hover:border-[#c8ac62]/60"
    : "border-[#f0e5a5]/25 hover:border-[#f0e5a5]/45";
};

const BackgroundOptionCard = ({ option, user, isLightUi, isPending, onSelect }) => {
  const isActive = getBackgroundSelectionState(user, option);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => onSelect(option)}
      className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-200 disabled:opacity-60 ${getBackgroundButtonStyle({ isActive, isLightUi })}`}
    >
      <div className="aspect-[1.1/1] w-full">
        {option.type === "color" ? (
          <div className="h-full w-full" style={{ backgroundColor: option.value }} />
        ) : (
          <img src={option.value} alt={option.label} className="h-full w-full object-cover" />
        )}
      </div>
      <div className={`absolute inset-0 ${isActive ? (isLightUi ? "bg-white/10" : "bg-black/10") : "bg-transparent"}`} />
      <div className="absolute inset-x-0 bottom-0 p-2">
        <div className={`rounded-xl border px-2 py-2 backdrop-blur-md ${
          isLightUi
            ? "border-white/65 bg-white/75 text-stone-800"
            : "border-white/10 bg-black/45 text-stone-100"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold">{option.label}</span>
            {isActive && <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />}
          </div>
          {option.unlockLabel && (
            <div className={`mt-1 text-[10px] ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
              {option.unlockLabel}
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

const TitleOptionRow = ({ option, user, isLightUi, isPending, onSelect }) => {
  const isActive = resolveTitleValue(user?.selected_title) === resolveTitleValue(option?.value, option?.label);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => onSelect(option)}
      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors disabled:opacity-60 ${
        isActive
          ? (isLightUi
            ? "border-[#c8ac62]/75 bg-white/85 text-stone-900 shadow-[0_10px_24px_rgba(162,129,48,0.16)]"
            : "border-[#f0e5a5]/55 bg-black/55 text-stone-100")
          : (isLightUi
            ? "border-[#c8ac62]/30 bg-white/65 text-stone-800 hover:bg-white/85"
            : "border-[#f0e5a5]/20 bg-black/30 text-stone-100 hover:bg-black/45")
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{option.label}</div>
          <div className={`mt-1 text-[11px] ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
            {option.source === "achievement" ? "Freigeschaltet durch Erfolg" : "Freigeschaltet als Belohnung"}
          </div>
        </div>
        {isActive && <BadgeCheck className={`h-4 w-4 shrink-0 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />}
      </div>
    </button>
  );
};

const getAccessorySelectionState = (user, option) => {
  const profileField = option?.profileField;
  if (!profileField) return false;

  const activeValue = user?.[profileField] || LOGO_ACCESSORY_DEFAULTS[profileField];
  return activeValue === option.value;
};

const AccessoryOptionCard = ({ option, user, isLightUi, isPending, onSelect }) => {
  const isActive = getAccessorySelectionState(user, option);
  const isLocked = Boolean(option?.isLocked);
  const isPurchasable = isLocked && Boolean(option?.isPurchasable) && Number(option?.sparkPrice || 0) > 0;
  const isFaceAccessory = option?.profileField === "selected_face_asset" || String(option?.value || "").startsWith("face_");
  const unlockCondition = option?.unlockCondition;
  const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
  const tooltipContent = isLocked
    ? (isPurchasable ? `${sparkPrice} Funken` : (unlockCondition || "Freischaltung noch nicht erreicht."))
    : null;

  const buttonContent = (
    <button
      type="button"
      disabled={isPending}
      onClick={() => onSelect(option)}
      className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-200 disabled:opacity-60 ${isLocked ? "cursor-help" : ""} ${getBackgroundButtonStyle({ isActive, isLightUi })}`}
    >
      <div className="aspect-square w-full p-2">
        <img
          src={option.imageUrl}
          alt={option.label}
          className="h-full w-full object-contain"
          style={isFaceAccessory ? { transform: "translateY(-28%) scale(1.4)", transformOrigin: "center center" } : undefined}
        />
      </div>
      {isLocked && <div className="absolute inset-0 bg-black/45" />}
      <div className={`absolute inset-0 ${isActive ? (isLightUi ? "bg-white/10" : "bg-black/10") : "bg-transparent"}`} />
      <div className="absolute inset-x-0 bottom-0 p-2">
        <div className={`rounded-xl border px-2 py-2 backdrop-blur-md ${
          isLightUi
            ? "border-white/65 bg-white/75 text-stone-800"
            : "border-white/10 bg-black/45 text-stone-100"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold">{option.label}</span>
            {isLocked ? (
              isPurchasable ? (
                <Sparkles className={`h-3.5 w-3.5 shrink-0 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              ) : (
                <Lock className={`h-3.5 w-3.5 shrink-0 ${isLightUi ? "text-stone-600" : "text-stone-200/90"}`} />
              )
            ) : (
              isActive && <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
            )}
          </div>
          {isLocked && (
            <div className={`mt-1 text-[10px] ${isLightUi ? "text-stone-600" : "text-stone-300/80"}`}>
              {isPurchasable ? `${sparkPrice} Funken` : "Noch gesperrt"}
            </div>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <LockedTooltip
      content={tooltipContent}
      contentClassName={isLightUi ? "" : "text-white/90"}
    >
      {buttonContent}
    </LockedTooltip>
  );
};

const BorderColorPicker = ({ currentColor, isLightUi, isPending, onSelectColor }) => {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [draftColor, setDraftColor] = React.useState(currentColor || BORDER_COLOR_PRESETS[0]);
  const [customHex, setCustomHex] = React.useState(currentColor || BORDER_COLOR_PRESETS[0]);
  const hasColor = Boolean(currentColor);

  React.useEffect(() => {
    if (!isPickerOpen) return;
    const nextColor = currentColor || BORDER_COLOR_PRESETS[0];
    setDraftColor(nextColor);
    setCustomHex(nextColor.toUpperCase());
  }, [currentColor, isPickerOpen]);

  const normalizeHexColor = (value) => {
    const sanitized = String(value || "").trim();
    const withHash = sanitized.startsWith("#") ? sanitized : `#${sanitized}`;
    return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
  };

  const handleOpenPicker = () => {
    if (isPending) return;
    setIsPickerOpen(true);
  };

  const handleApplyCustomColor = () => {
    const normalized = normalizeHexColor(customHex);
    if (!normalized) return;
    setDraftColor(normalized);
    setCustomHex(normalized);
  };

  const handleConfirm = () => {
    onSelectColor(draftColor);
    setIsPickerOpen(false);
  };

  const handleReset = (e) => {
    e.stopPropagation();
    onSelectColor(null);
  };

  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        isLightUi
          ? "border-[#c8ac62]/35 bg-white/60"
          : "border-[#f0e5a5]/25 bg-black/25"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={`text-xs font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
            Rahmenfarbe
          </div>
          <div className={`mt-0.5 text-[11px] ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
            {hasColor ? currentColor.toUpperCase() : "Standard (keine Tönung)"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasColor && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleReset}
              className={`h-8 rounded-xl border px-2.5 text-[11px] font-medium disabled:opacity-60 ${
                isLightUi
                  ? "border-[#c8ac62]/40 bg-white/75 text-stone-600 hover:bg-white"
                  : "border-[#f0e5a5]/25 bg-black/35 text-stone-200 hover:bg-black/50"
              }`}
            >
              Zurücksetzen
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={handleOpenPicker}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all disabled:opacity-60 ${
              hasColor
                ? "border-transparent shadow-md"
                : isLightUi
                  ? "border-[#c8ac62]/50 bg-white/75 hover:bg-white"
                  : "border-[#f0e5a5]/35 bg-black/35 hover:bg-black/50"
            }`}
            style={hasColor ? { backgroundColor: currentColor } : undefined}
            title="Rahmenfarbe wählen"
          >
            {!hasColor && (
              <PaintBucket
                className={`h-4 w-4 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}
              />
            )}
          </button>
        </div>
      </div>

      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className={`max-w-[min(92vw,26rem)] rounded-2xl ${isLightUi ? "border-[#c8ac62]/45 bg-white" : "border-[#f0e5a5]/35 bg-[#1a1d1a]"}`}>
          <DialogHeader>
            <DialogTitle className={`${isLightUi ? "text-stone-900" : "text-stone-100"}`}>Rahmenfarbe wählen</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {BORDER_COLOR_PRESETS.map((color) => {
                const isActive = draftColor?.toUpperCase() === color.toUpperCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setDraftColor(color);
                      setCustomHex(color.toUpperCase());
                    }}
                    className={`h-9 rounded-lg border-2 transition-all ${isActive ? "scale-105" : "hover:scale-105"}`}
                    style={{
                      backgroundColor: color,
                      borderColor: isActive
                        ? (isLightUi ? "rgba(41,37,36,0.95)" : "rgba(255,255,255,0.9)")
                        : (isLightUi ? "rgba(200,172,98,0.35)" : "rgba(240,229,165,0.35)"),
                    }}
                    aria-label={`Farbe ${color}`}
                  />
                );
              })}
            </div>

            <div className="space-y-2">
              <span className={`text-xs font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                Farbe auswählen
              </span>
              <div
                className={`rounded-xl border p-2 ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50" : "border-[#f0e5a5]/25 bg-black/25"}`}
              >
                <HexColorPicker color={draftColor} onChange={(value) => {
                  const normalized = normalizeHexColor(value);
                  if (!normalized) return;
                  setDraftColor(normalized);
                  setCustomHex(normalized);
                }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <span className={`text-xs font-medium whitespace-nowrap ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                Benutzerdefiniert
              </span>
              <input
                type="text"
                inputMode="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#AABBCC"
                className={`h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-xs uppercase tracking-wide ${isLightUi ? "border-[#c8ac62]/45 bg-white text-stone-800" : "border-[#f0e5a5]/35 bg-black/35 text-stone-100"}`}
              />
              <button
                type="button"
                onClick={handleApplyCustomColor}
                disabled={!normalizeHexColor(customHex)}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-50 ${isLightUi ? "border-[#c8ac62]/45 bg-white/75 text-stone-700 hover:bg-white" : "border-[#f0e5a5]/25 bg-black/35 text-stone-100 hover:bg-black/55"}`}
              >
                Anwenden
              </button>
            </div>

            <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
              Ausgewählte Farbe: <span className="font-semibold">{draftColor.toUpperCase()}</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap ${isLightUi ? "border-[#c8ac62]/45 bg-white/70 text-stone-700 hover:bg-white" : "border-[#f0e5a5]/25 bg-black/30 text-stone-200 hover:bg-black/50"}`}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${isLightUi ? "border-[#c8ac62]/50 bg-[#f4e7bf] text-stone-800 hover:bg-[#f7edd0]" : "border-[#f0e5a5]/40 bg-[#4f4826] text-[#f7f0c1] hover:bg-[#5a512b]"}`}
              >
                Festlegen
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children, isLightUi }) => {
  return (
    <div className={`rounded-[1.5rem] border px-3 py-3 backdrop-blur-md ${
      isLightUi
        ? "border-[#c8ac62]/30 bg-white/72"
        : "border-[#f0e5a5]/20 bg-black/28"
    }`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
        <h3 className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{title}</h3>
      </div>
      {children}
    </div>
  );
};

const AccessoryPagedGrid = ({ options, user, isLightUi, isPending, onSelect }) => {
  const pages = chunkIntoAccessoryPages(options);
  const hasOverflow = (options?.length || 0) > ACCESSORY_GRID_PAGE_SIZE;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`text-[11px] ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
          2x2 Ansicht pro Seite
        </div>
        <div className={`inline-flex items-center gap-1 text-[11px] font-medium ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
          <span>{hasOverflow ? "Nach rechts scrollen" : "Kompakte 2x2 Ansicht"}</span>
          {hasOverflow && <ArrowRight className="h-3.5 w-3.5" />}
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex snap-x snap-mandatory gap-3">
          {pages.map((pageOptions, pageIndex) => {
            const placeholders = Math.max(0, ACCESSORY_GRID_PAGE_SIZE - pageOptions.length);

            return (
              <div key={`accessory-page-${pageIndex}`} className="min-w-full snap-start">
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {pageOptions.map((option) => (
                    <AccessoryOptionCard
                      key={option.id}
                      option={option}
                      user={user}
                      isLightUi={isLightUi}
                      isPending={isPending}
                      onSelect={onSelect}
                    />
                  ))}
                  {Array.from({ length: placeholders }).map((_, placeholderIndex) => (
                    <div
                      key={`accessory-placeholder-${pageIndex}-${placeholderIndex}`}
                      aria-hidden="true"
                      className={`aspect-square rounded-2xl border border-dashed ${
                        isLightUi ? "border-[#c8ac62]/25 bg-white/35" : "border-[#f0e5a5]/15 bg-black/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function ShopFeatureRoot({
  embedded = true,
  initialCategory = "backgrounds",
  authId = null,
  currentUser = null,
  onHeaderMetaChange,
  onUserUpdated,
}) {
  const { isLightUi } = useUiTheme();
  const queryClient = useQueryClient();

  const [shopCategory, setShopCategory] = useState(initialCategory);
  const [shopMessage, setShopMessage] = useState(null);
  const [purchaseConfirmOption, setPurchaseConfirmOption] = useState(null);

  const { data: fallbackUser = null } = useQuery({
    queryKey: ["shopCurrentUser"],
    queryFn: () => getCurrentUser(),
    enabled: !authId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const resolvedAuthId = authId || fallbackUser?.id || null;

  const { data: userDiscoveries = [], isPending: isDiscoveriesPending, refetch: refetchDiscoveries } = useQuery({
    queryKey: ["userDiscoveries", resolvedAuthId],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: resolvedAuthId }),
    enabled: !!resolvedAuthId,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: achievements = [], isPending: isAchievementsPending, refetch: refetchAchievements } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => Query.Achievement.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userAchievements = [], isPending: isUserAchievementsPending, refetch: refetchUserAchievements } = useQuery({
    queryKey: ["userAchievements", resolvedAuthId],
    queryFn: () => Query.UserAchievement.filter({ auth_id: resolvedAuthId }),
    enabled: !!resolvedAuthId,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: rewards = [], isPending: isRewardsPending, refetch: refetchRewards } = useQuery({
    queryKey: ["rewards"],
    queryFn: () => Query.Reward.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userRewards = [], isPending: isUserRewardsPending, refetch: refetchUserRewards } = useQuery({
    queryKey: ["userRewards", resolvedAuthId],
    queryFn: () => Query.UserReward.filter({ auth_id: resolvedAuthId }),
    enabled: !!resolvedAuthId,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: userWallet = null, isPending: isUserWalletPending, refetch: refetchUserWallet } = useQuery({
    queryKey: ["userWallet", resolvedAuthId],
    queryFn: () => getUserWallet(resolvedAuthId),
    enabled: !!resolvedAuthId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: logoAssets = [], isPending: isLogoAssetsPending, refetch: refetchLogoAssets } = useQuery({
    queryKey: ["logoAssets"],
    queryFn: () => Query.LogoAsset.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const catalog = useMemo(() => {
    return getUnlockedProfileCustomizationCatalog({
      achievements,
      userAchievements,
      rewards,
      userRewards,
      userDiscoveries,
      logoAssets,
    });
  }, [achievements, logoAssets, rewards, userAchievements, userDiscoveries, userRewards]);

  const categories = useMemo(() => {
    return [...(catalog.categories || [])].sort(profileCustomizationCategoryComparator);
  }, [catalog.categories]);

  useEffect(() => {
    setShopCategory(initialCategory || "backgrounds");
  }, [initialCategory]);

  useEffect(() => {
    if (!categories.some((category) => category.key === shopCategory)) {
      setShopCategory(categories[0]?.key || "backgrounds");
    }
  }, [categories, shopCategory]);

  const currentCategory = categories.find((category) => category.key === shopCategory) || categories[0] || null;

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function" || !currentCategory) return;
    onHeaderMetaChange({
      title: "Shop",
      subtitle: currentCategory.subtitle || CATEGORY_META[currentCategory.key]?.subtitle || null,
    });
  }, [currentCategory, embedded, onHeaderMetaChange]);

  const updateCustomizationMutation = useMutation({
    mutationFn: async (updates) => updateCurrentUserProfile(updates),
    onSuccess: async () => {
      const freshUser = await getCurrentUser();
      if (typeof onUserUpdated === "function") {
        onUserUpdated(freshUser);
      }
      setShopMessage("Profil angepasst.");
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      await queryClient.invalidateQueries({ queryKey: ["shopCurrentUser"] });
    },
    onError: () => {
      setShopMessage("Anpassung konnte nicht gespeichert werden.");
    },
  });

  const purchaseAccessoryMutation = useMutation({
    mutationFn: async (option) => {
      if (!resolvedAuthId) {
        throw new Error("Nutzerkontext nicht gefunden.");
      }

      const sparkPrice = Math.max(0, Math.round(Number(option?.sparkPrice || 0)));
      if (!option?.isPurchasable || sparkPrice <= 0) {
        throw new Error("Dieses Accessoire ist nicht kaufbar.");
      }

      const currentWallet = await getUserWallet(resolvedAuthId);
      const sparksBalance = Math.max(0, Number(currentWallet?.sparks_balance ?? 0));
      if (sparksBalance < sparkPrice) {
        return {
          applied: false,
          errorCode: "insufficient_sparks",
          sparksBalance,
          sparkPrice,
        };
      }

      const matchingReward = (Array.isArray(rewards) ? rewards : []).find((reward) => {
        const rewardType = String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();
        return ACCESSORY_PURCHASABLE_REWARD_TYPES.has(rewardType) && String(reward?.value || "").trim() === String(option?.value || "").trim();
      });

      if (!matchingReward?.id) {
        return {
          applied: false,
          errorCode: "reward_not_configured",
        };
      }

      const alreadyOwned = (Array.isArray(userRewards) ? userRewards : []).some((entry) => entry?.reward_id === matchingReward.id);
      if (alreadyOwned) {
        return {
          applied: true,
          alreadyOwned: true,
          sparksBalance,
        };
      }

      const eventReference = `shop-accessory:${String(option.value)}:${Date.now()}`;
      const debitResult = await grantWalletCurrency({
        authId: resolvedAuthId,
        currencyCode: "sparks",
        eventSource: "shop_accessory_purchase",
        eventReference,
        amount: sparkPrice,
        direction: "debit",
        metadata: {
          source: "profile_shop",
          accessory_id: String(option.value),
          reward_id: matchingReward.id,
          spark_price: sparkPrice,
        },
      });

      try {
        await Query.UserReward.create({
          reward_id: matchingReward.id,
          reward_name: matchingReward.display_name || matchingReward.name || matchingReward.value || String(option.value),
          auth_id: resolvedAuthId,
          user_email: currentUser?.email || fallbackUser?.email || null,
          user_name: currentUser?.display_name || currentUser?.full_name || fallbackUser?.display_name || fallbackUser?.full_name || currentUser?.email || fallbackUser?.email || null,
          unlocked_date: new Date().toISOString(),
        });
      } catch (createError) {
        try {
          await grantWalletCurrency({
            authId: resolvedAuthId,
            currencyCode: "sparks",
            eventSource: "shop_accessory_purchase_refund",
            eventReference,
            amount: sparkPrice,
            direction: "credit",
            metadata: {
              source: "profile_shop",
              accessory_id: String(option.value),
              reason: "user_reward_create_failed",
            },
          });
        } catch (_refundError) {
          // Intentionally ignored: purchase error is returned and can be retried.
        }

        throw createError;
      }

      return {
        applied: true,
        alreadyOwned: false,
        sparksBalance: Math.max(0, Number(debitResult?.sparks_balance ?? sparksBalance - sparkPrice)),
      };
    },
    onSuccess: async (result) => {
      if (!result?.applied) {
        if (result?.errorCode === "insufficient_sparks") {
          setShopMessage(`Nicht genug Funken. Benötigt: ${result.sparkPrice}, verfügbar: ${result.sparksBalance}.`);
        } else if (result?.errorCode === "reward_not_configured") {
          setShopMessage("Dieses Accessoire kann aktuell nicht gekauft werden.");
        } else {
          setShopMessage("Kauf konnte nicht abgeschlossen werden.");
        }
      } else if (result?.alreadyOwned) {
        setShopMessage("Dieses Accessoire ist bereits freigeschaltet.");
      } else {
        setShopMessage("Accessoire gekauft. Du kannst es jetzt ausrüsten.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["userRewards", resolvedAuthId] }),
        queryClient.invalidateQueries({ queryKey: ["userWallet", resolvedAuthId] }),
        refetchUserRewards(),
        refetchUserWallet(),
      ]);
    },
    onError: (error) => {
      const message = String(error?.message || "").trim();
      setShopMessage(message ? `Kauf fehlgeschlagen: ${message}` : "Kauf fehlgeschlagen.");
    },
  });

  const handleSelectBackground = async (option) => {
    setShopMessage(null);

    if (option?.type === "color") {
      await updateCustomizationMutation.mutateAsync({
        background_image_url: null,
        background_color: option.value,
      });
      return;
    }

    await updateCustomizationMutation.mutateAsync({
      background_image_url: option?.value || null,
      background_color: null,
    });
  };

  const handleResetBackground = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({
      background_image_url: null,
      background_color: null,
    });
  };

  const handleSelectTitle = async (option) => {
    setShopMessage(null);
    const nextTitle = resolveTitleValue(option?.value, option?.label);
    await updateCustomizationMutation.mutateAsync({ selected_title: nextTitle || null });
  };

  const handleResetTitle = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_title: null });
  };

  const handleSelectAccessory = async (option) => {
    if (!option?.profileField) return;
    if (option?.isLocked) {
      if (option?.isPurchasable && Number(option?.sparkPrice || 0) > 0) {
        setShopMessage(null);
        setPurchaseConfirmOption(option);
      } else {
        setShopMessage("Dieses Accessoire ist noch gesperrt.");
      }
      return;
    }
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ [option.profileField]: option.value });
  };

  const handleSelectBorderColor = async (hex) => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_border_color: hex || null });
  };

  const handleResetAccessories = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({
      selected_face_asset: LOGO_ACCESSORY_DEFAULTS.selected_face_asset,
      selected_plant_asset: LOGO_ACCESSORY_DEFAULTS.selected_plant_asset,
      selected_border_asset: LOGO_ACCESSORY_DEFAULTS.selected_border_asset,
      selected_border_color: null,
    });
  };

  const isAuthResolving = !resolvedAuthId;
  const isLoading = isAuthResolving || isDiscoveriesPending || isAchievementsPending || isUserAchievementsPending || isRewardsPending || isUserRewardsPending || isLogoAssetsPending || isUserWalletPending;
  const resolvedCurrentUser = currentUser || fallbackUser || (authId ? { id: authId } : null);
  const availableSparks = Math.max(0, Number(userWallet?.sparks_balance ?? 0));
  const purchaseDialogSparkPrice = Math.max(0, Number(purchaseConfirmOption?.sparkPrice ?? 0));
  const canAffordPurchaseDialogOption = availableSparks >= purchaseDialogSparkPrice;
  const resolvedCurrentTitle = resolveTitleValue(resolvedCurrentUser?.selected_title, resolvedCurrentUser?.title) || "Pflanzen-Entdecker";
  const isMutationPending = updateCustomizationMutation.isPending || purchaseAccessoryMutation.isPending;

  const handleClosePurchaseDialog = () => {
    if (purchaseAccessoryMutation.isPending) return;
    setPurchaseConfirmOption(null);
  };

  const handleConfirmAccessoryPurchase = async () => {
    if (!purchaseConfirmOption || purchaseAccessoryMutation.isPending) return;
    if (!canAffordPurchaseDialogOption) {
      setShopMessage(`Nicht genug Funken. Benötigt: ${purchaseDialogSparkPrice}, verfügbar: ${availableSparks}.`);
      return;
    }

    try {
      await purchaseAccessoryMutation.mutateAsync(purchaseConfirmOption);
      setPurchaseConfirmOption(null);
    } catch (_error) {
      // Die Fehlermeldung wird in onError/onSuccess gesetzt.
    }
  };

  const tabsHeaderClass = embedded
    ? `sticky top-0 z-40 backdrop-blur-sm border-b ${isLightUi ? "bg-white/70 border-[#b99a48]/30" : "bg-black/20 border-[#f0e5a5]/20"}`
    : `sticky top-0 z-40 border-b ${isLightUi ? "bg-white/90 border-stone-200/80 backdrop-blur-xl" : "bg-stone-950/75 border-[#f0e5a5]/20 backdrop-blur-xl"}`;
  const contentClass = embedded ? "mt-0 px-4 pb-4 flex-1 min-h-0 overflow-y-auto" : "px-4 pb-8 pt-4";
  const listTopFadePx = 12;
  const listBottomFadePx = 18;
  const contentMaskStyle = embedded
    ? {
        WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
        maskImage: `linear-gradient(to bottom, transparent 0px, black ${listTopFadePx}px, black calc(100% - ${listBottomFadePx}px), transparent 100%)`,
      }
    : undefined;

  const refetchAll = async () => {
    await Promise.all([
      refetchDiscoveries(),
      refetchAchievements(),
      refetchUserAchievements(),
      refetchRewards(),
      refetchUserRewards(),
      refetchLogoAssets(),
      refetchUserWallet(),
    ]);
  };

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
              {categories.map((category) => {
                const isPrimary = shopCategory === category.key;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setShopCategory(category.key)}
                    className={
                      "flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-colors min-w-fit " +
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
                    <span className="font-medium truncate">{category.title}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isLightUi ? "bg-[#c8ac62]/12 text-stone-600" : "bg-white/10 text-stone-200/80"
                    }`}>
                      {category.optionCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={contentClass} style={contentMaskStyle}>
        <div className="max-w-5xl mx-auto space-y-3" style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}>
          {!!shopMessage && (
            <div className={`text-[11px] md:text-xs ${isLightUi ? "text-stone-700" : "text-stone-200/90"}`}>
              {shopMessage}
            </div>
          )}

          {isLoading ? (
            <div className="px-1 py-6 flex flex-col items-center justify-center gap-2 text-center">
              <Loader2 className={`w-6 h-6 animate-spin ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <div className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Freischaltungen werden geladen</div>
              <div className={`text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>Der Shop sammelt deine bereits freigeschalteten Anpassungen.</div>
            </div>
          ) : !currentCategory ? (
            <div className="px-1 py-6 flex flex-col items-center justify-center gap-3 text-center">
              <Sparkles className={`w-6 h-6 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <div className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Noch keine Anpassungskategorien verfuegbar</div>
              <button
                type="button"
                onClick={refetchAll}
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-semibold border ${
                  isLightUi
                    ? "border-[#c8ac62]/55 bg-white/65 text-stone-800"
                    : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Erneut laden
              </button>
            </div>
          ) : currentCategory.key === "backgrounds" ? (
            <div className="space-y-3">
              <div className={`rounded-[1.5rem] border px-3 py-3 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-[#f0e5a5]/20 bg-black/28"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Aktiver Hintergrund</div>
                    <div className={`mt-1 text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
                      Presets, Farben und eigene Scans werden direkt auf dein Profil angewendet.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isMutationPending}
                    onClick={handleResetBackground}
                    className={`h-9 rounded-xl border px-3 text-xs font-semibold disabled:opacity-60 ${
                      isLightUi
                        ? "border-[#c8ac62]/40 bg-white/75 text-stone-700 hover:bg-white"
                        : "border-[#f0e5a5]/25 bg-black/35 text-stone-100 hover:bg-black/50"
                    }`}
                  >
                    Standardhintergrund
                  </button>
                </div>
              </div>

              {currentCategory.sections.map((section) => {
                const icon = section.key === "colors" ? PaintBucket : ImageIcon;
                return (
                  <SectionCard key={section.key} title={section.title} icon={icon} isLightUi={isLightUi}>
                    {section.options.length === 0 ? (
                      <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                        {section.emptyLabel}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {section.options.map((option) => (
                          <BackgroundOptionCard
                            key={option.id}
                            option={option}
                            user={resolvedCurrentUser}
                            isLightUi={isLightUi}
                            isPending={isMutationPending}
                            onSelect={handleSelectBackground}
                          />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                );
              })}
            </div>
          ) : currentCategory.key === "accessories" ? (
            <div className="space-y-3">
              <div className={`rounded-[1.5rem] border px-3 py-3 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-[#f0e5a5]/20 bg-black/28"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Aktives Logo-Set</div>
                    <div className={`mt-1 text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
                      Gesicht, Pflanze und Rahmen koennen getrennt ausgeruestet werden.
                    </div>
                    <div className={`mt-1 text-xs font-medium ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                      Verfügbare Funken: {availableSparks}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isMutationPending}
                    onClick={handleResetAccessories}
                    className={`h-9 rounded-xl border px-3 text-xs font-semibold disabled:opacity-60 ${
                      isLightUi
                        ? "border-[#c8ac62]/40 bg-white/75 text-stone-700 hover:bg-white"
                        : "border-[#f0e5a5]/25 bg-black/35 text-stone-100 hover:bg-black/50"
                    }`}
                  >
                    Standard-Logo
                  </button>
                </div>
              </div>

              {currentCategory.sections.map((section) => (
                <SectionCard key={section.key} title={section.title} icon={Sparkles} isLightUi={isLightUi}>
                  {section.options.length === 0 ? (
                    <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                      {section.emptyLabel}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AccessoryPagedGrid
                        options={section.options}
                        user={resolvedCurrentUser}
                        isLightUi={isLightUi}
                        isPending={isMutationPending}
                        onSelect={handleSelectAccessory}
                      />
                      {section.key === "border" && (
                        <BorderColorPicker
                          currentColor={resolvedCurrentUser?.selected_border_color || null}
                          isLightUi={isLightUi}
                          isPending={isMutationPending}
                          onSelectColor={handleSelectBorderColor}
                        />
                      )}
                    </div>
                  )}
                </SectionCard>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-[1.5rem] border px-3 py-3 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-[#f0e5a5]/20 bg-black/28"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Aktiver Titel</div>
                    <div className={`mt-1 text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
                      Aktuell: {resolvedCurrentTitle}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isMutationPending}
                    onClick={handleResetTitle}
                    className={`h-9 rounded-xl border px-3 text-xs font-semibold disabled:opacity-60 ${
                      isLightUi
                        ? "border-[#c8ac62]/40 bg-white/75 text-stone-700 hover:bg-white"
                        : "border-[#f0e5a5]/25 bg-black/35 text-stone-100 hover:bg-black/50"
                    }`}
                  >
                    Standardtitel
                  </button>
                </div>
              </div>

              <SectionCard title="Freigeschaltete Titel" icon={BadgeCheck} isLightUi={isLightUi}>
                {currentCategory.sections[0]?.options?.length ? (
                  <div className="space-y-2">
                    {currentCategory.sections[0].options.map((option) => (
                      <TitleOptionRow
                        key={option.id}
                        option={option}
                        user={resolvedCurrentUser}
                        isLightUi={isLightUi}
                        isPending={isMutationPending}
                        onSelect={handleSelectTitle}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                    {CATEGORY_META.titles.emptyLabel}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(purchaseConfirmOption)} onOpenChange={(open) => {
        if (!open) handleClosePurchaseDialog();
      }}>
        <DialogContent className={`max-w-[min(92vw,25rem)] rounded-2xl ${isLightUi ? "border-[#c8ac62]/45 bg-white" : "border-[#f0e5a5]/35 bg-[#1a1d1a]"}`}>
          <DialogHeader>
            <DialogTitle className={`${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
              Accessoire freischalten?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {purchaseConfirmOption?.imageUrl && (
              <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border p-2 ${
                isLightUi
                  ? "border-[#c8ac62]/40 bg-white"
                  : "border-[#f0e5a5]/35 bg-black/30"
              }`}>
                <img
                  src={purchaseConfirmOption.imageUrl}
                  alt={purchaseConfirmOption?.label || "Accessoire Vorschau"}
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            <p className={`text-sm ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
              Möchtest du <span className="font-semibold">{purchaseConfirmOption?.label || "dieses Accessoire"}</span> für <span className="font-semibold">{purchaseDialogSparkPrice} Funken</span> kaufen?
            </p>

            <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
              Verfügbare Funken: <span className="font-semibold">{availableSparks}</span>
            </div>

            {!canAffordPurchaseDialogOption && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/35 bg-red-900/25 text-red-200"}`}>
                Du hast nicht genug Funken für diesen Kauf.
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={purchaseAccessoryMutation.isPending}
                onClick={handleClosePurchaseDialog}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${isLightUi ? "border-[#c8ac62]/45 bg-white/70 text-stone-700 hover:bg-white" : "border-[#f0e5a5]/25 bg-black/30 text-stone-200 hover:bg-black/50"}`}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={purchaseAccessoryMutation.isPending || !canAffordPurchaseDialogOption}
                onClick={handleConfirmAccessoryPurchase}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${isLightUi ? "border-[#c8ac62]/50 bg-[#f4e7bf] text-stone-800 hover:bg-[#f7edd0]" : "border-[#f0e5a5]/40 bg-[#4f4826] text-[#f7f0c1] hover:bg-[#5a512b]"}`}
              >
                {purchaseAccessoryMutation.isPending ? "Kaufe..." : "Freischalten"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

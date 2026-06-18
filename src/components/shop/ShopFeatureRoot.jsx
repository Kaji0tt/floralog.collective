import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  BadgeCheck,
  PaintBucket,
  Lock,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gem,
  Bot,
  User,
  Check,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { getUserWallet } from "@/api/walletService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import CollectionCategoryEntryCard from "@/components/collection/CollectionCategoryEntryCard";
import {
  getUnlockedProfileCustomizationCatalog,
  profileCustomizationCategoryComparator,
  resolveTitleValue,
} from "@/lib/profileCustomizationOptions";
import { LOGO_ACCESSORY_DEFAULTS } from "@/lib/logoAccessoryAssets";
import {
  evaluateProfileBadges,
  PROFILE_BADGE_DEFINITIONS,
  PROFILE_BADGE_MAX_SELECTED,
  sanitizeSelectedProfileBadgeIds,
} from "@/lib/profileBadges";
import { getProfileBadgeIconComponent } from "@/lib/profileBadgeIcons";

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

const ROOT_CATEGORY_META = {
  shop: {
    key: "shop",
    title: "Shop",
    subtitle: "Bernstein kaufen und Gegenstaende mit Bernstein oder Funken freischalten.",
    accent: "global",
    icon: Gem,
  },
  florabot: {
    key: "florabot",
    title: "Florabot",
    subtitle: "Freigeschaltete Anpassungen fuer Rahmen, Pflanze und Gesicht.",
    accent: "themes",
    icon: Bot,
  },
  profile: {
    key: "profile",
    title: "Profil",
    subtitle: "Abzeichen, Hintergruende und Titel fuer dein Profil.",
    accent: "shared",
    icon: User,
  },
};

const ROOT_DEFAULT_SUBCATEGORY = {
  shop: "offers",
  florabot: "accessories",
  profile: "backgrounds",
};

const ROOT_SUBCATEGORY_ORDER = {
  shop: ["offers", "unlocks"],
  florabot: ["accessories"],
  profile: ["badges", "backgrounds", "titles"],
};

const ROOT_SHOP_CATEGORY_MAP = {
  accessories: "florabot",
  backgrounds: "profile",
  titles: "profile",
  badges: "profile",
  offers: "shop",
  unlocks: "shop",
  shop: "shop",
  florabot: "florabot",
  profile: "profile",
};

const BADGE_RANK_BADGE_STYLE = {
  gray: "bg-[#9ca3af]/20 text-[#6b7280] border-[#9ca3af]/55",
  white: "bg-white/50 text-stone-700 border-white/70",
  bronze: "bg-[#cd7f32]/18 text-[#9a5c22] border-[#cd7f32]/45",
  silver: "bg-[#c0c7d1]/20 text-[#7d8798] border-[#c0c7d1]/50",
  gold: "bg-[#f5c542]/20 text-[#9a6b00] border-[#f5c542]/50",
};

const BADGE_RANK_ICON_STYLE = {
  gray: "text-[#9ca3af]",
  white: "text-white",
  bronze: "text-[#cd7f32]",
  silver: "text-[#c0c7d1]",
  gold: "text-[#f5c542]",
};

const getBadgeCardSurfaceClassName = (rankKey, isLightUi) => {
  if (rankKey === "gold") {
    return isLightUi
      ? "border-[#f5c542]/50 bg-gradient-to-br from-[#fef3c7]/75 via-white/80 to-[#fde68a]/60"
      : "border-[#f5c542]/50 bg-gradient-to-br from-[#3a2d12]/70 via-[#2b2414]/65 to-[#4b3a16]/70";
  }

  if (rankKey === "silver") {
    return isLightUi
      ? "border-[#c0c7d1]/50 bg-gradient-to-br from-[#eef2f7]/80 via-white/80 to-[#dce3ef]/65"
      : "border-[#c0c7d1]/45 bg-gradient-to-br from-[#242a33]/70 via-[#1e232d]/65 to-[#2d3542]/70";
  }

  if (rankKey === "bronze") {
    return isLightUi
      ? "border-[#cd7f32]/45 bg-gradient-to-br from-[#fde6d0]/78 via-white/80 to-[#f7cfac]/65"
      : "border-[#cd7f32]/45 bg-gradient-to-br from-[#332114]/70 via-[#2a1c12]/65 to-[#473122]/70";
  }

  if (rankKey === "white") {
    return isLightUi
      ? "border-[#e2e8f0]/70 bg-white/82"
      : "border-white/40 bg-white/12";
  }

  return isLightUi
    ? "border-[#cbd5e1]/45 bg-white/72"
    : "border-white/15 bg-black/30";
};

const getCategoryOptionCount = (category, predicate = null) => {
  if (!category?.sections?.length) return 0;
  return category.sections.reduce((sum, section) => {
    const options = Array.isArray(section?.options) ? section.options : [];
    if (typeof predicate !== "function") return sum + options.length;
    return sum + options.filter(predicate).length;
  }, 0);
};

const getRootCategoryFromInitialCategory = (initialCategory) => {
  const normalized = String(initialCategory || "").trim().toLowerCase();
  return ROOT_SHOP_CATEGORY_MAP[normalized] || "florabot";
};

const getInitialSubcategoryForRoot = (rootCategory, initialCategory) => {
  const normalized = String(initialCategory || "").trim().toLowerCase();
  const preferredOrder = ROOT_SUBCATEGORY_ORDER[rootCategory] || [];
  if (preferredOrder.includes(normalized)) return normalized;
  return preferredOrder[0] || ROOT_DEFAULT_SUBCATEGORY[rootCategory] || "backgrounds";
};

const shouldStartOnRootCategoryLanding = (initialCategory) => {
  const normalized = String(initialCategory || "").trim().toLowerCase();
  return !normalized || normalized === "root" || normalized === "categories" || normalized === "landing";
};

const orderByCategoryList = (items, order) => {
  const safeItems = Array.isArray(items) ? items : [];
  const safeOrder = Array.isArray(order) ? order : [];
  return [...safeItems].sort((left, right) => {
    const leftIndex = safeOrder.indexOf(left?.key);
    const rightIndex = safeOrder.indexOf(right?.key);
    const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeftIndex - normalizedRightIndex;
  });
};

const ACCESSORY_PURCHASABLE_REWARD_TYPES = new Set(["logo_accessory", "accessory"]);
const ACCESSORY_GRID_COLUMNS = 2;
const ACCESSORY_GRID_ROWS = 2;
const ACCESSORY_GRID_PAGE_SIZE = ACCESSORY_GRID_COLUMNS * ACCESSORY_GRID_ROWS;

const normalizeAccessoryId = (value) => String(value || "").trim().toLowerCase();

const normalizeRewardAccessoryValue = (value) => {
  const normalized = normalizeAccessoryId(value);
  if (!normalized) return "";
  if (normalized.startsWith("face_") || normalized.startsWith("plant_") || normalized.startsWith("border_")) {
    return normalized;
  }

  // Backward-compatible shorthand support, e.g. "v" -> "face_v".
  return `face_${normalized}`;
};

const accessoryValueMatches = (rewardValue, accessoryId) => {
  const normalizedReward = normalizeRewardAccessoryValue(rewardValue);
  const normalizedAccessory = normalizeAccessoryId(accessoryId);
  return Boolean(normalizedReward) && Boolean(normalizedAccessory) && normalizedReward === normalizedAccessory;
};

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

const BackgroundOptionCard = ({ option, user, isLightUi, isPending, isSelected = false, onSelect }) => {
  const isActive = getBackgroundSelectionState(user, option);
  const isLocked = Boolean(option?.isLocked);

  const buttonContent = (
    <button
      type="button"
      disabled={isPending || isLocked}
      onClick={() => onSelect(option)}
      className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-200 disabled:opacity-60 ${isLocked ? "cursor-help" : ""} ${getBackgroundButtonStyle({ isActive, isLightUi })} ${
        isSelected
          ? (isLightUi ? "ring-2 ring-[#c8ac62]/70" : "ring-2 ring-[#f0e5a5]/70")
          : ""
      }`}
    >
      <div className="aspect-[1.1/1] w-full">
        {option.type === "color" ? (
          <div className="h-full w-full" style={{ backgroundColor: option.value }} />
        ) : (
          <img src={option.value} alt={option.label} className="h-full w-full object-cover" />
        )}
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
              <Lock className={`h-3.5 w-3.5 shrink-0 ${isLightUi ? "text-stone-600" : "text-stone-200/90"}`} />
            ) : (
              isActive && <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
            )}
          </div>
          {(option.unlockLabel || option.unlockCondition || isLocked) && (
            <div className={`mt-1 text-[10px] ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
              {isLocked ? (option.unlockCondition || "Noch gesperrt") : option.unlockLabel}
            </div>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <LockedTooltip
      content={isLocked ? (option.unlockCondition || "Noch nicht freigeschaltet") : null}
      contentClassName={isLightUi ? "" : "text-white/90"}
    >
      {buttonContent}
    </LockedTooltip>
  );
};

const TitleOptionRow = ({ option, user, isLightUi, isPending, isSelected = false, onSelect }) => {
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
          } ${isSelected ? (isLightUi ? "ring-2 ring-[#c8ac62]/60" : "ring-2 ring-[#f0e5a5]/65") : ""}`}
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

const formatAccessoryPriceLabel = (sparkPrice, amberPrice) => {
  const parts = [];
  if (sparkPrice > 0) parts.push(`${sparkPrice} Funken`);
  if (amberPrice > 0) parts.push(`${amberPrice} Bernstein`);
  return parts.join(" + ");
};

const AccessoryOptionCard = ({ option, user, isLightUi, isPending, isSelected = false, onSelect }) => {
  const isActive = getAccessorySelectionState(user, option);
  const isLocked = Boolean(option?.isLocked);
  const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
  const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
  const isPurchasable = isLocked && Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);
  const isFaceAccessory = option?.profileField === "selected_face_asset" || String(option?.value || "").startsWith("face_");
  const unlockCondition = option?.unlockCondition;
  const tooltipContent = isLocked
    ? (isPurchasable ? formatAccessoryPriceLabel(sparkPrice, amberPrice) : (unlockCondition || "Freischaltung noch nicht erreicht."))
    : null;

  const buttonContent = (
    <button
      type="button"
      disabled={isPending}
      onClick={() => onSelect(option)}
      className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-200 disabled:opacity-60 ${isLocked ? "cursor-help" : ""} ${getBackgroundButtonStyle({ isActive, isLightUi })} ${
        isSelected
          ? (isLightUi ? "ring-2 ring-[#c8ac62]/70" : "ring-2 ring-[#f0e5a5]/70")
          : ""
      }`}
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
              {isPurchasable ? formatAccessoryPriceLabel(sparkPrice, amberPrice) : "Noch gesperrt"}
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

const AccessoryPagedGrid = ({ options, user, isLightUi, isPending, onSelect, selectedOptionId = null }) => {
  const pages = chunkIntoAccessoryPages(options);
  const scrollRef = React.useRef(/** @type {HTMLDivElement | null} */ (null));
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(pages.length > 1);

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState, pages.length]);

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <div className="space-y-2">
      <div ref={scrollRef} className="overflow-x-auto hide-scrollbar pb-1">
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
                      isSelected={selectedOptionId === option.id}
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

      {showArrows && (
        <div className="flex items-center justify-between gap-2" aria-hidden="true">
          <div className={`flex items-center gap-1 text-[11px] font-medium ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"} ${canScrollLeft ? "visible" : "invisible"}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-medium ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"} ${canScrollRight ? "visible" : "invisible"}`}>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * @param {{
 *   embedded?: boolean,
 *   showEmbeddedBottomDivider?: boolean,
 *   initialCategory?: string,
 *   authId?: string | null,
 *   currentUser?: any,
 *   badgeMetrics?: Record<string, number> | null,
 *   onHeaderMetaChange?: any,
 *   onUserUpdated?: (user: any) => void,
 *   externalActionMode?: boolean,
 *   onActionStateChange?: any,
 * }} props
 */
export default function ShopFeatureRoot({
  embedded = true,
  showEmbeddedBottomDivider = true,
  initialCategory = "accessories",
  authId = null,
  currentUser = null,
  badgeMetrics = null,
  onHeaderMetaChange,
  onUserUpdated,
  externalActionMode = false,
  onActionStateChange,
}) {
  const { isLightUi } = useUiTheme();
  const queryClient = useQueryClient();

  const [shopRootCategory, setShopRootCategory] = useState(() => getRootCategoryFromInitialCategory(initialCategory));
  const [isRootCategoryLandingVisible, setIsRootCategoryLandingVisible] = useState(() => shouldStartOnRootCategoryLanding(initialCategory));
  const [shopCategory, setShopCategory] = useState(() => {
    const initialRoot = getRootCategoryFromInitialCategory(initialCategory);
    return getInitialSubcategoryForRoot(initialRoot, initialCategory);
  });
  const [shopMessage, setShopMessage] = useState(null);
  const [purchaseConfirmOption, setPurchaseConfirmOption] = useState(null);
  const [selectedOptionForAction, setSelectedOptionForAction] = useState(null);
  const [collapsedBackgroundSections, setCollapsedBackgroundSections] = useState({
    presets: false,
    colors: false,
    scans: true,
  });

  const { data: fallbackUser = null } = useQuery({
    queryKey: ["shopCurrentUser"],
    queryFn: () => getCurrentUser(),
    enabled: !authId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const resolvedAuthId = authId || fallbackUser?.id || null;
  const resolvedUserEmail =
    currentUser?.user_email ||
    currentUser?.email ||
    fallbackUser?.user_email ||
    fallbackUser?.email ||
    null;

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

  const { data: genera = [] } = useQuery({
    queryKey: ["plantGenera"],
    queryFn: () => Query.PlantGenus.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const speciesIds = useMemo(
    () => [...new Set((rewards || []).filter((r) => r.requires_plant_species_id).map((r) => r.requires_plant_species_id))],
    [rewards],
  );

  const { data: rewardPlants = [] } = useQuery({
    queryKey: ["rewardPlants", speciesIds],
    queryFn: async () => {
      const { data } = await supabase.from("Plant").select("id, species_name").in("id", speciesIds);
      return data || [];
    },
    enabled: speciesIds.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const catalog = useMemo(() => {
    return getUnlockedProfileCustomizationCatalog({
      achievements,
      userAchievements,
      rewards,
      userRewards,
      userDiscoveries,
      logoAssets,
      genera,
      plants: rewardPlants,
    });
  }, [achievements, logoAssets, rewards, userAchievements, userDiscoveries, userRewards, genera, rewardPlants]);

  const customizationCategories = useMemo(() => {
    return [...(catalog.categories || [])].sort(profileCustomizationCategoryComparator);
  }, [catalog.categories]);

  const evaluatedBadges = useMemo(() => {
    return evaluateProfileBadges(badgeMetrics || {});
  }, [badgeMetrics]);

  const badgeCategory = useMemo(() => {
    return {
      key: "badges",
      title: "Abzeichen",
      subtitle: "Metrik-Abzeichen mit 5 Raengen (Grau, Weiss, Bronze, Silber, Gold)",
      sections: [
        {
          key: "metric_badges",
          title: "Metrik-Abzeichen",
          emptyLabel: "Noch keine Abzeichen verfuegbar.",
          options: evaluatedBadges,
        },
      ],
      optionCount: evaluatedBadges.length,
    };
  }, [evaluatedBadges]);

  const florabotCategories = useMemo(() => {
    return orderByCategoryList(
      customizationCategories.filter((category) => category.key === "accessories"),
      ROOT_SUBCATEGORY_ORDER.florabot,
    );
  }, [customizationCategories]);

  const profileCategories = useMemo(() => {
    const resolved = [
      ...customizationCategories.filter((category) => category.key === "backgrounds" || category.key === "titles"),
      badgeCategory,
    ].map((category) => ({
      ...category,
      optionCount: typeof category.optionCount === "number" ? category.optionCount : getCategoryOptionCount(category),
    }));

    return orderByCategoryList(resolved, ROOT_SUBCATEGORY_ORDER.profile);
  }, [customizationCategories, badgeCategory]);

  const shopCategories = useMemo(() => {
    return [
      {
        key: "offers",
        title: "Bernstein",
        subtitle: "Pakete und Zahlungsarten (Vorbereitung)",
        optionCount: 3,
        sections: [],
      },
      {
        key: "unlocks",
        title: "Freischalten",
        subtitle: "Items mit Funken oder Bernstein",
        optionCount: 2,
        sections: [],
      },
    ];
  }, []);

  const activeSubcategories = useMemo(() => {
    if (shopRootCategory === "shop") return shopCategories;
    if (shopRootCategory === "florabot") return florabotCategories;
    if (shopRootCategory === "profile") return profileCategories;
    return [];
  }, [shopRootCategory, shopCategories, florabotCategories, profileCategories]);

  useEffect(() => {
    const nextRoot = getRootCategoryFromInitialCategory(initialCategory);
    setShopRootCategory(nextRoot);
    setIsRootCategoryLandingVisible(shouldStartOnRootCategoryLanding(initialCategory));
    setShopCategory(getInitialSubcategoryForRoot(nextRoot, initialCategory));
  }, [initialCategory]);

  useEffect(() => {
    if (isRootCategoryLandingVisible) return;
    if (!activeSubcategories.some((category) => category.key === shopCategory)) {
      setShopCategory(activeSubcategories[0]?.key || null);
    }
  }, [activeSubcategories, isRootCategoryLandingVisible, shopCategory]);

  useEffect(() => {
    setSelectedOptionForAction(null);
  }, [shopCategory, shopRootCategory, isRootCategoryLandingVisible]);

  const currentCategory = activeSubcategories.find((category) => category.key === shopCategory) || activeSubcategories[0] || null;

  const handleSelectRootCategory = (nextRootCategory) => {
    if (!nextRootCategory) return;
    setShopRootCategory(nextRootCategory);
    setShopCategory(getInitialSubcategoryForRoot(nextRootCategory, null));
    setIsRootCategoryLandingVisible(false);
    setShopMessage(null);
  };

  const handleBackToRootCategories = () => {
    setIsRootCategoryLandingVisible(true);
    setSelectedOptionForAction(null);
  };

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
      if (!resolvedAuthId) throw new Error("Nutzerkontext nicht gefunden.");

      const sparkPrice = Math.max(0, Math.round(Number(option?.sparkPrice || 0)));
      const amberPrice = Math.max(0, Math.round(Number(option?.amberPrice || 0)));
      if (!option?.isPurchasable || (sparkPrice <= 0 && amberPrice <= 0)) {
        throw new Error("Dieses Accessoire ist nicht kaufbar.");
      }

      const matchingReward = (Array.isArray(rewards) ? rewards : []).find((reward) => {
        const rewardType = String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();
        return ACCESSORY_PURCHASABLE_REWARD_TYPES.has(rewardType) && accessoryValueMatches(reward?.value, option?.value);
      });

      if (!matchingReward?.id) {
        return {
          applied: false,
          errorCode: "reward_not_configured",
        };
      }

      const eventReference = `shop-accessory:${String(option.value)}:${Date.now()}`;
      const { data, error } = await supabase.functions.invoke("purchaseAccessory", {
        body: {
          authId: resolvedAuthId,
          userEmail: resolvedUserEmail,
          rewardId: matchingReward.id,
          accessoryId: String(option.value),
          sparkPrice,
          amberPrice,
          eventReference,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (result) => {
      if (!result?.applied) {
        if (result?.errorCode === "insufficient_sparks") {
          setShopMessage(`Nicht genug Funken. Benötigt: ${result.sparkPrice}, verfügbar: ${result.sparksBalance}.`);
        } else if (result?.errorCode === "insufficient_amber") {
          setShopMessage(`Nicht genug Bernstein. Benötigt: ${result.amberPrice}, verfügbar: ${result.amberBalance}.`);
        } else if (result?.errorCode === "insufficient_both") {
          setShopMessage(`Nicht genug Funken und Bernstein. Benötigt: ${formatAccessoryPriceLabel(result.sparkPrice, result.amberPrice)}.`);
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
    if (externalActionMode) {
      if (option?.isLocked) {
        setShopMessage(option?.unlockCondition || "Dieser Hintergrund ist noch gesperrt.");
        return;
      }
      setSelectedOptionForAction({
        kind: "background",
        option,
        actionLabel: "Ausruesten",
        actionDisabled: false,
      });
      return;
    }

    setShopMessage(null);

    if (option?.isLocked) {
      setShopMessage(option?.unlockCondition || "Dieser Hintergrund ist noch gesperrt.");
      return;
    }

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

  const applyBackgroundSelection = async (option) => {
    setShopMessage(null);

    if (option?.isLocked) {
      setShopMessage(option?.unlockCondition || "Dieser Hintergrund ist noch gesperrt.");
      return;
    }

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
    if (externalActionMode) {
      setSelectedOptionForAction({
        kind: "title",
        option,
        actionLabel: "Ausruesten",
        actionDisabled: false,
      });
      return;
    }

    setShopMessage(null);
    const nextTitle = resolveTitleValue(option?.value, option?.label);
    await updateCustomizationMutation.mutateAsync({ selected_title: nextTitle || null });
  };

  const applyTitleSelection = async (option) => {
    setShopMessage(null);
    const nextTitle = resolveTitleValue(option?.value, option?.label);
    await updateCustomizationMutation.mutateAsync({ selected_title: nextTitle || null });
  };

  const handleResetTitle = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_title: null });
  };

  const handleSelectBadge = async (badgeId) => {
    const normalizedBadgeId = String(badgeId || "").trim();
    if (!normalizedBadgeId) return;

    const isAlreadySelected = selectedBadgeIds.includes(normalizedBadgeId);
    const nextSelection = isAlreadySelected
      ? selectedBadgeIds.filter((entry) => entry !== normalizedBadgeId)
      : [...selectedBadgeIds, normalizedBadgeId].slice(0, PROFILE_BADGE_MAX_SELECTED);

    if (!isAlreadySelected && selectedBadgeIds.length >= PROFILE_BADGE_MAX_SELECTED) {
      setShopMessage(`Maximal ${PROFILE_BADGE_MAX_SELECTED} Abzeichen gleichzeitig.`);
      return;
    }

    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_badge_ids: nextSelection });
  };

  const handleSelectAccessory = async (option) => {
    if (externalActionMode) {
      const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
      const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
      const canBeBought = Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);
      const isLocked = Boolean(option?.isLocked);

      if (isLocked && !canBeBought) {
        setShopMessage("Dieses Accessoire ist noch gesperrt.");
        return;
      }

      setSelectedOptionForAction({
        kind: "accessory",
        option,
        actionLabel: isLocked ? "Kaufen" : "Ausruesten",
        actionDisabled: false,
      });
      return;
    }

    if (!option?.profileField) return;
    if (option?.isLocked) {
      if (option?.isPurchasable && (Number(option?.sparkPrice || 0) > 0 || Number(option?.amberPrice || 0) > 0)) {
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

  const applyAccessorySelection = async (option) => {
    if (!option?.profileField) return;

    if (option?.isLocked) {
      if (option?.isPurchasable && (Number(option?.sparkPrice || 0) > 0 || Number(option?.amberPrice || 0) > 0)) {
        setShopMessage(null);
        await purchaseAccessoryMutation.mutateAsync(option);
      } else {
        setShopMessage("Dieses Accessoire ist noch gesperrt.");
      }
      return;
    }

    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ [option.profileField]: option.value });
  };

  const handleSelectBorderColor = async (hex) => {
    if (externalActionMode) {
      setSelectedOptionForAction({
        kind: "border-color",
        option: { value: hex || null },
        actionLabel: "Ausruesten",
        actionDisabled: false,
      });
      return;
    }

    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_border_color: hex || null });
  };

  const applyBorderColorSelection = async (hex) => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_border_color: hex || null });
  };

  const isAuthResolving = !resolvedAuthId;
  const isLoading = isAuthResolving || isDiscoveriesPending || isAchievementsPending || isUserAchievementsPending || isRewardsPending || isUserRewardsPending || isLogoAssetsPending || isUserWalletPending;
  const resolvedCurrentUser = currentUser || fallbackUser || (authId ? { id: authId } : null);
  const selectedBadgeIds = useMemo(() => {
    return sanitizeSelectedProfileBadgeIds(
      resolvedCurrentUser?.selected_badge_ids,
      PROFILE_BADGE_MAX_SELECTED,
    );
  }, [resolvedCurrentUser?.selected_badge_ids]);
  const availableSparks = Math.max(0, Number(userWallet?.sparks_balance ?? 0));
  const availableAmber = Math.max(0, Number(userWallet?.amber_balance ?? 0));
  const activeRootMeta = ROOT_CATEGORY_META[shopRootCategory] || null;

  useEffect(() => {
    if (!embedded || typeof onHeaderMetaChange !== "function") return;
    onHeaderMetaChange({
      title: isRootCategoryLandingVisible ? "Shop" : (activeRootMeta?.title || "Shop"),
      subtitle: isRootCategoryLandingVisible ? "Kategorie waehlen" : null,
      infoLabel: {
        sparks: availableSparks,
        amber: availableAmber,
      },
    });
  }, [activeRootMeta?.title, availableAmber, availableSparks, embedded, isRootCategoryLandingVisible, onHeaderMetaChange]);

  const purchaseDialogSparkPrice = Math.max(0, Number(purchaseConfirmOption?.sparkPrice ?? 0));
  const purchaseDialogAmberPrice = Math.max(0, Number(purchaseConfirmOption?.amberPrice ?? 0));
  const canAffordDialogSparks = purchaseDialogSparkPrice <= 0 || availableSparks >= purchaseDialogSparkPrice;
  const canAffordDialogAmber = purchaseDialogAmberPrice <= 0 || availableAmber >= purchaseDialogAmberPrice;
  const canAffordPurchaseDialogOption = canAffordDialogSparks && canAffordDialogAmber;
  const resolvedCurrentTitle = resolveTitleValue(resolvedCurrentUser?.selected_title, resolvedCurrentUser?.title) || "Pflanzen-Entdecker";
  const isMutationPending = updateCustomizationMutation.isPending || purchaseAccessoryMutation.isPending;
  const selectedActionRef = React.useRef(null);

  const executeSelectedAction = async () => {
    const payload = selectedOptionForAction;
    if (!payload || isMutationPending) return;

    const { kind, option } = payload;
    if (kind === "background") {
      await applyBackgroundSelection(option);
      return;
    }
    if (kind === "title") {
      await applyTitleSelection(option);
      return;
    }
    if (kind === "accessory") {
      await applyAccessorySelection(option);
      return;
    }
    if (kind === "border-color") {
      await applyBorderColorSelection(option?.value || null);
    }
  };

  selectedActionRef.current = executeSelectedAction;

  useEffect(() => {
    if (typeof onActionStateChange !== "function") return;

    const canAct = Boolean(selectedOptionForAction) && !isMutationPending;
    onActionStateChange({
      label: selectedOptionForAction?.actionLabel || "Kaufen",
      disabled: !canAct,
      isBusy: isMutationPending,
      onAction: async () => {
        if (typeof selectedActionRef.current === "function") {
          await selectedActionRef.current();
        }
      },
      selectedOption: selectedOptionForAction,
    });
  }, [selectedOptionForAction, isMutationPending, onActionStateChange]);

  const handleClosePurchaseDialog = () => {
    if (purchaseAccessoryMutation.isPending) return;
    setPurchaseConfirmOption(null);
  };

  const handleConfirmAccessoryPurchase = async () => {
    if (!purchaseConfirmOption || purchaseAccessoryMutation.isPending) return;
    if (!canAffordPurchaseDialogOption) {
      if (!canAffordDialogSparks && !canAffordDialogAmber) {
        setShopMessage("Nicht genug Funken und Bernstein.");
      } else if (!canAffordDialogSparks) {
        setShopMessage(`Nicht genug Funken. Benötigt: ${purchaseDialogSparkPrice}, verfügbar: ${availableSparks}.`);
      } else {
        setShopMessage(`Nicht genug Bernstein. Benötigt: ${purchaseDialogAmberPrice}, verfügbar: ${availableAmber}.`);
      }
      return;
    }

    try {
      await purchaseAccessoryMutation.mutateAsync(purchaseConfirmOption);
      setPurchaseConfirmOption(null);
    } catch {
      // Die Fehlermeldung wird in onError/onSuccess gesetzt.
    }
  };

  const embeddedDividerClass = isLightUi ? "border-[#b99a48]/30" : "border-[#f0e5a5]/20";
  const contentClass = embedded ? "mt-0 px-4 pb-4 flex-1 min-h-0 overflow-y-auto hide-scrollbar" : "px-4 pb-8 pt-4";
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

  const florabotOptionCount = florabotCategories.reduce((sum, category) => sum + getCategoryOptionCount(category), 0);
  const profileOptionCount = profileCategories.reduce((sum, category) => sum + getCategoryOptionCount(category), 0);
  const unlockableAccessoryCount = florabotCategories.reduce(
    (sum, category) => sum + getCategoryOptionCount(category, (option) => Boolean(option?.isLocked) && Boolean(option?.isPurchasable)),
    0,
  );

  const rootCategoryEntries = [
    {
      ...ROOT_CATEGORY_META.shop,
      count: 2,
      chips: [
        `${availableAmber} Bernstein`,
        `${availableSparks} Funken`,
      ],
    },
    {
      ...ROOT_CATEGORY_META.florabot,
      count: florabotOptionCount,
      chips: [
        `${florabotOptionCount} Anpassungen`,
        unlockableAccessoryCount > 0 ? `${unlockableAccessoryCount} kaufbar` : "Alles freigeschaltet",
      ],
    },
    {
      ...ROOT_CATEGORY_META.profile,
      count: profileOptionCount,
      chips: [
        `${profileOptionCount} Profiloptionen`,
        `${selectedBadgeIds.length}/${PROFILE_BADGE_MAX_SELECTED} Abzeichen ausgewaehlt`,
      ],
    },
  ];

  return (
    <section
      data-embedded-module="shop"
      data-theme={isLightUi ? "light" : "dark"}
      className="h-full flex-1 min-h-0 overflow-hidden flex flex-col"
    >
      <div className={contentClass} style={contentMaskStyle}>
        <div
          className="max-w-5xl mx-auto space-y-3"
          style={embedded ? { paddingTop: listTopFadePx, paddingBottom: listBottomFadePx } : undefined}
        >
          {isRootCategoryLandingVisible ? (
            <div className="space-y-2">
              {rootCategoryEntries.map((entry) => (
                <CollectionCategoryEntryCard
                  key={entry.key}
                  title={entry.title}
                  icon={entry.icon}
                  accent={entry.accent}
                  info={entry.subtitle}
                  infoClassName={isLightUi ? "text-white/90" : "text-stone-200"}
                  metaChips={entry.chips}
                  metaChipClassName={isLightUi ? "text-white border-white/35 bg-black/20" : "text-stone-100 border-white/30 bg-black/26"}
                  showChevron
                  className="max-h-[10.5rem]"
                  onClick={() => handleSelectRootCategory(entry.key)}
                />
              ))}
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
          ) : shopRootCategory === "shop" && currentCategory.key === "offers" ? (
            <div className="space-y-3">
              <SectionCard title="Bernstein kaufen" icon={Gem} isLightUi={isLightUi}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { amount: 120, price: "2,99 EUR" },
                    { amount: 350, price: "6,99 EUR" },
                    { amount: 900, price: "14,99 EUR" },
                  ].map((pack) => (
                    <div
                      key={pack.amount}
                      className={`rounded-2xl border px-3 py-3 ${isLightUi ? "border-[#c8ac62]/35 bg-white/65" : "border-[#f0e5a5]/25 bg-black/30"}`}
                    >
                      <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{pack.amount} Bernstein</div>
                      <div className={`text-xs mt-1 ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>{pack.price}</div>
                    </div>
                  ))}
                </div>
                <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                  Zahlungsarten sind vorbereitet (Apple Pay, Google Pay, PayPal, Kreditkarte), aber noch nicht aktiv.
                </div>
              </SectionCard>
            </div>
          ) : shopRootCategory === "shop" && currentCategory.key === "unlocks" ? (
            <div className="space-y-3">
              <SectionCard title="Mit Funken freischalten" icon={Sparkles} isLightUi={isLightUi}>
                <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-600" : "border-[#f0e5a5]/20 text-stone-300/80"}`}>
                  Items mit Funken werden hier gesammelt angezeigt. Bereits integrierte Florabot-Accessoires sind weiterhin im Bereich Florabot verfuegbar.
                </div>
              </SectionCard>

              <SectionCard title="Mit Bernstein freischalten" icon={Gem} isLightUi={isLightUi}>
                <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-600" : "border-[#f0e5a5]/20 text-stone-300/80"}`}>
                  Premium-Freischaltungen mit Bernstein folgen in den naechsten Shop-Designs.
                </div>
              </SectionCard>
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
                const isCollapsed = Boolean(collapsedBackgroundSections?.[section.key]);
                return (
                  <SectionCard key={section.key} title={section.title} icon={icon} isLightUi={isLightUi}>
                    <button
                      type="button"
                      onClick={() => setCollapsedBackgroundSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                      className={`mb-3 w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                        isLightUi
                          ? "border-[#c8ac62]/30 bg-white/60 hover:bg-white/75"
                          : "border-[#f0e5a5]/20 bg-black/20 hover:bg-black/35"
                      }`}
                    >
                      <span className={`text-xs font-semibold ${isLightUi ? "text-stone-700" : "text-stone-100"}`}>{section.title}</span>
                      {isCollapsed ? (
                        <ChevronDown className={`h-4 w-4 ${isLightUi ? "text-stone-600" : "text-stone-300"}`} />
                      ) : (
                        <ChevronUp className={`h-4 w-4 ${isLightUi ? "text-stone-600" : "text-stone-300"}`} />
                      )}
                    </button>

                    {!isCollapsed && (
                      section.options.length === 0 ? (
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
                              isSelected={selectedOptionForAction?.kind === "background" && selectedOptionForAction?.option?.id === option.id}
                              onSelect={handleSelectBackground}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </SectionCard>
                );
              })}
            </div>
          ) : currentCategory.key === "accessories" ? (
            <div className="space-y-3">
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
                        selectedOptionId={selectedOptionForAction?.kind === "accessory" ? selectedOptionForAction?.option?.id : null}
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
          ) : currentCategory.key === "badges" ? (
            <div className="space-y-3">
              <SectionCard title="Abzeichen auswaehlen" icon={BadgeCheck} isLightUi={isLightUi}>
                <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                  Du kannst bis zu {PROFILE_BADGE_MAX_SELECTED} Abzeichen im Profilbanner anzeigen. Aktuell ausgewaehlt: {selectedBadgeIds.length}/{PROFILE_BADGE_MAX_SELECTED}.
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(currentCategory.sections[0]?.options || []).map((badge) => {
                    const Icon = getProfileBadgeIconComponent(badge.iconKey);
                    const rankChipClass = BADGE_RANK_BADGE_STYLE[badge.rankKey] || BADGE_RANK_BADGE_STYLE.gray;
                    const iconToneClass = BADGE_RANK_ICON_STYLE[badge.rankKey] || BADGE_RANK_ICON_STYLE.gray;
                    const isSelected = selectedBadgeIds.includes(badge.id);

                    const tooltipContent = (
                      <div className="space-y-1 text-[11px] leading-snug">
                        <div className="font-semibold">{badge.label}</div>
                        <div>{badge.description}</div>
                        <div className="opacity-85">Wert: {badge.valueLabel}</div>
                        <div className="opacity-85">Rang: {badge.rankMeta?.label || "Grau"}</div>
                      </div>
                    );

                    return (
                      <LockedTooltip key={badge.id} content={tooltipContent} contentClassName={isLightUi ? "" : "text-white/90"}>
                        <button
                          type="button"
                          disabled={isMutationPending}
                          onClick={() => handleSelectBadge(badge.id)}
                          className={`relative rounded-2xl border px-3 py-3 text-left transition-all disabled:opacity-60 ${getBadgeCardSurfaceClassName(badge.rankKey, isLightUi)} ${
                            isSelected
                              ? (isLightUi ? "ring-2 ring-[#c8ac62]/70" : "ring-2 ring-[#f0e5a5]/70")
                              : ""
                          }`}
                        >
                          {isSelected ? (
                            <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border ${isLightUi ? "border-[#c8ac62]/60 bg-white/80 text-[#8f6b22]" : "border-[#f0e5a5]/45 bg-black/45 text-[#f0e5a5]"}`}>
                              <Check className="h-3 w-3" />
                            </span>
                          ) : null}

                          <div className="flex items-start gap-2">
                            <div className={`h-8 w-8 rounded-lg border flex items-center justify-center ${isLightUi ? "border-[#c8ac62]/35 bg-white/70" : "border-[#f0e5a5]/30 bg-black/35"} ${iconToneClass}`}>
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className={`truncate text-xs font-semibold ${isLightUi ? "text-[#8f6b22]" : "text-stone-100"}`}>{badge.label}</div>
                              <div className={`mt-1 text-[11px] ${isLightUi ? "text-[#b08a3a]" : "text-stone-300/80"}`}>{badge.valueLabel}</div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rankChipClass}`}>
                              {badge.rankMeta?.label || "Grau"}
                            </span>
                            <span className={`text-[10px] ${isLightUi ? "text-[#9a7a33]" : "text-stone-300/75"}`}>
                              Tippen zum {isSelected ? "Abwaehlen" : "Auswaehlen"}
                            </span>
                          </div>
                        </button>
                      </LockedTooltip>
                    );
                  })}
                </div>

                <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                  Verfuegbare Abzeichen: {PROFILE_BADGE_DEFINITIONS.length}. Ausgewaehlte Abzeichen erscheinen neben Florabot im Home-Banner.
                </div>
              </SectionCard>
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
                        isSelected={selectedOptionForAction?.kind === "title" && selectedOptionForAction?.option?.id === option.id}
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

      {embedded && showEmbeddedBottomDivider ? <div className={`w-full shrink-0 border-t ${embeddedDividerClass}`} aria-hidden="true" /> : null}

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
              Möchtest du <span className="font-semibold">{purchaseConfirmOption?.label || "dieses Accessoire"}</span> für <span className="font-semibold">{formatAccessoryPriceLabel(purchaseDialogSparkPrice, purchaseDialogAmberPrice)}</span> kaufen?
            </p>

            <div className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
              {purchaseDialogSparkPrice > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 opacity-80" /> Funken</span>
                  <span className={`font-semibold ${!canAffordDialogSparks ? (isLightUi ? "text-red-600" : "text-red-400") : ""}`}>{availableSparks} / {purchaseDialogSparkPrice}</span>
                </div>
              )}
              {purchaseDialogAmberPrice > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1"><span className="text-[11px]">🔸</span> Bernstein</span>
                  <span className={`font-semibold ${!canAffordDialogAmber ? (isLightUi ? "text-red-600" : "text-red-400") : ""}`}>{availableAmber} / {purchaseDialogAmberPrice}</span>
                </div>
              )}
            </div>

            {!canAffordPurchaseDialogOption && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/35 bg-red-900/25 text-red-200"}`}>
                {!canAffordDialogSparks && !canAffordDialogAmber
                  ? "Du hast nicht genug Funken und Bernstein für diesen Kauf."
                  : !canAffordDialogSparks
                  ? "Du hast nicht genug Funken für diesen Kauf."
                  : "Du hast nicht genug Bernstein für diesen Kauf."}
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

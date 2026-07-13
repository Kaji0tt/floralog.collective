import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  BadgeCheck,
  PaintBucket,
  Lock,
  ChevronDown,
  ChevronUp,
  Gem,
  Bot,
  User,
  Check,
  Smile,
  ScanSearch,
  Leaf,
  Frame,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { getUserWallet } from "@/api/walletService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
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
import { resolveOwnedUniqueBadges } from "@/lib/profileUniqueBadges";

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
    title: "Hintergründe",
    subtitle: "Alle freigeschalteten Hintergründe für dein Profil",
    emptyLabel: "Noch keine Hintergrundoptionen freigeschaltet.",
  },
  face: {
    title: "Gesicht",
    subtitle: "Freigeschaltete Gesichts-Assets für dein Home-Logo",
    emptyLabel: "Noch keine Gesichtsoptionen verfügbar.",
  },
  plant: {
    title: "Pflanze",
    subtitle: "Kaufbare, noch gesperrte Pflanzen-Accessoires",
    emptyLabel: "Noch keine Pflanzen-Optionen verfügbar.",
  },
  border: {
    title: "Rahmen",
    subtitle: "Kaufbare, noch gesperrte Rahmen-Accessoires",
    emptyLabel: "Noch keine Rahmen-Optionen verfügbar.",
  },
  effects: {
    title: "Effekte",
    subtitle: "Freischaltbare visuelle Effekte für dein Profil",
    emptyLabel: "Noch keine Effekte verfügbar.",
  },
  scans: {
    title: "Scans",
    subtitle: "Scan-basierte Inhalte folgen bald",
    emptyLabel: "Diese Kategorie ist aktuell ein Platzhalter.",
  },
  titles: {
    title: "Titel",
    subtitle: "Alle freigeschalteten Titel für dein Profil",
    emptyLabel: "Noch keine Titel freigeschaltet.",
  },
  accessories: {
    title: "Accessoires",
    subtitle: "Austauschbare Teile für dein Home-Logo",
    emptyLabel: "Noch keine Accessoires verfügbar.",
  },
  bernstein: {
    title: "Bernstein",
    subtitle: "Bernstein-Pakete kaufen",
    emptyLabel: "Keine Bernstein-Pakete verfügbar.",
  },
};

const ROOT_CATEGORY_META = {
  shop: {
    key: "shop",
    title: "Shop",
    subtitle: "Bernstein kaufen und Gegenstände mit Bernstein oder Funken freischalten.",
    accent: "global",
    icon: Gem,
  },
  florabot: {
    key: "florabot",
    title: "Florabot",
    subtitle: "Freigeschaltete Anpassungen für Rahmen, Pflanze und Gesicht.",
    accent: "themes",
    icon: Bot,
  },
  profile: {
    key: "profile",
    title: "Profil",
    subtitle: "Abzeichen, Hintergründe und Titel für dein Profil.",
    accent: "shared",
    icon: User,
  },
};

const ROOT_DEFAULT_SUBCATEGORY = {
  shop: "backgrounds",
  florabot: "accessories",
  profile: "backgrounds",
};

const ROOT_SUBCATEGORY_ORDER = {
  shop: ["backgrounds", "face", "plant", "border", "effects", "scans", "bernstein"],
  florabot: ["accessories", "effects"],
  profile: ["badges", "backgrounds", "titles", "effects"],
};

const ROOT_SHOP_CATEGORY_MAP = {
  accessories: "florabot",
  backgrounds: "shop",
  face: "shop",
  effects: "shop",
  scans: "shop",
  bernstein: "shop",
  titles: "profile",
  badges: "profile",
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

const isOptionLockedAndPurchasable = (option) => {
  if (!option?.isLocked || !option?.isPurchasable) return false;
  const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
  const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
  return sparkPrice > 0 || amberPrice > 0;
};

const isOptionUnlocked = (option) => !Boolean(option?.isLocked);

const mapSectionsWithOptionFilter = (sections, predicate) => {
  const safeSections = Array.isArray(sections) ? sections : [];
  if (typeof predicate !== "function") return safeSections;

  return safeSections.map((section) => ({
    ...section,
    options: (Array.isArray(section?.options) ? section.options : []).filter(predicate),
  }));
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
const PROFILE_NAV_CHIP_WIDTH = 136;
const PROFILE_NAV_CHIP_GAP = 12;
const PROFILE_NAV_SNAP_STEP = PROFILE_NAV_CHIP_WIDTH + PROFILE_NAV_CHIP_GAP;

const normalizeAccessoryId = (value) => String(value || "").trim().toLowerCase();

const normalizeRewardAccessoryValue = (value) => {
  const raw = normalizeAccessoryId(value);
  if (!raw) return "";

  const withoutQuery = raw.split("?")[0].split("#")[0];
  const lastPathSegment = withoutQuery.split("/").pop() || withoutQuery;
  const withoutExtension = lastPathSegment.replace(/\.(png|jpe?g|gif|webp|svg)$/i, "");
  if (!withoutExtension) return "";

  if (withoutExtension.startsWith("reward_logo_accessory_")) return withoutExtension.replace(/^reward_logo_accessory_/, "");
  if (withoutExtension.startsWith("reward_accessory_")) return withoutExtension.replace(/^reward_accessory_/, "");
  if (withoutExtension.startsWith("logo_accessory_")) return withoutExtension.replace(/^logo_accessory_/, "");
  if (withoutExtension.startsWith("accessory_")) return withoutExtension.replace(/^accessory_/, "");

  const embeddedMatch = withoutExtension.match(/(face_[a-z0-9_]+|plant_[a-z0-9_]+|border_[a-z0-9_]+)/i);
  if (embeddedMatch?.[1]) return embeddedMatch[1].toLowerCase();

  if (withoutExtension.startsWith("face_") || withoutExtension.startsWith("plant_") || withoutExtension.startsWith("border_")) {
    return withoutExtension;
  }

  // Backward-compatible shorthand support, e.g. "v" -> "face_v".
  return `face_${withoutExtension}`;
};

const accessoryValueMatches = (rewardValue, accessoryId) => {
  const normalizedReward = normalizeRewardAccessoryValue(rewardValue);
  const normalizedAccessory = normalizeAccessoryId(accessoryId);
  return Boolean(normalizedReward) && Boolean(normalizedAccessory) && normalizedReward === normalizedAccessory;
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
  const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
  const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
  const isPurchasable = isLocked && Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);

  const buttonContent = (
    <button
      type="button"
      disabled={isPending || (isLocked && !isPurchasable)}
      onClick={() => onSelect(option)}
      className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-200 disabled:opacity-60 ${isLocked && !isPurchasable ? "cursor-help" : ""} ${getBackgroundButtonStyle({ isActive, isLightUi })} ${
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
            <div className={`mt-1 text-[10px] ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
              {isPurchasable ? formatAccessoryPriceLabel(sparkPrice, amberPrice) : (option.unlockCondition || "Noch gesperrt")}
            </div>
          )}
        </div>
      </div>
    </button>
  );

  const tooltipContent = isLocked
    ? (isPurchasable ? formatAccessoryPriceLabel(sparkPrice, amberPrice) : (option.unlockCondition || "Noch nicht freigeschaltet"))
    : null;

  return (
    <LockedTooltip
      content={tooltipContent}
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

const getProfileEffectSelectionState = (user, option) => {
  const profileField = option?.profileField || "selected_profile_effect";
  const activeValue = String(user?.[profileField] || "").trim().toLowerCase();
  const optionValue = String(option?.value || "").trim().toLowerCase();
  return Boolean(optionValue) && activeValue === optionValue;
};

const formatAccessoryPriceLabel = (sparkPrice, amberPrice) => {
  const parts = [];
  if (sparkPrice > 0) parts.push(`${sparkPrice} Funken`);
  if (amberPrice > 0) parts.push(`${amberPrice} Bernstein`);
  return parts.join(" oder ");
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

const ProfileEffectOptionCard = ({ option, user, isLightUi, isPending, isSelected = false, onSelect }) => {
  const isActive = getProfileEffectSelectionState(user, option);
  const isLocked = Boolean(option?.isLocked);
  const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
  const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
  const isPurchasable = isLocked && Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);
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
      <div className="relative aspect-[1.1/1] w-full p-3">
        <div
          className={`absolute inset-0 ${
            isLightUi
              ? "bg-[radial-gradient(circle_at_center,rgba(240,229,165,0.35)_0%,rgba(240,229,165,0.12)_45%,rgba(0,0,0,0)_80%)]"
              : "bg-[radial-gradient(circle_at_center,rgba(240,229,165,0.48)_0%,rgba(240,229,165,0.2)_45%,rgba(0,0,0,0)_80%)]"
          }`}
        />
        <div className={`absolute inset-[16%] rounded-full border ${isLightUi ? "border-[#c8ac62]/55" : "border-[#f0e5a5]/60"}`} />
        <div className="absolute inset-0 flex items-end justify-center pb-3">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isLightUi
              ? "border-[#c8ac62]/45 bg-[#f4e7bf]/70 text-stone-700"
              : "border-[#f0e5a5]/45 bg-[#4f4826]/55 text-stone-100"
          }`}>
            Effekt
          </span>
        </div>
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
          {isLocked ? (
            <div className={`mt-1 text-[10px] ${isLightUi ? "text-stone-600" : "text-stone-300/80"}`}>
              {isPurchasable ? formatAccessoryPriceLabel(sparkPrice, amberPrice) : (unlockCondition || "Noch gesperrt")}
            </div>
          ) : (
            <div className={`mt-1 text-[10px] ${isLightUi ? "text-stone-600" : "text-stone-300/80"}`}>
              {isActive ? "Aktiv" : "Tippen zum Ausrüsten"}
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

const ProfileCategorySnapCarousel = ({ categories, activeKey, isLightUi, onSelect }) => {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const activeIndex = Math.max(0, safeCategories.findIndex((category) => category?.key === activeKey));
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [snapStep, setSnapStep] = React.useState(PROFILE_NAV_SNAP_STEP);
  const chipRefs = React.useRef([]);
  const dragStateRef = React.useRef({
    pointerId: null,
    startX: 0,
    startIndex: 0,
    snapStep: PROFILE_NAV_SNAP_STEP,
  });

  React.useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
  }, [activeKey]);

  React.useEffect(() => {
    const firstChip = chipRefs.current[0];
    const secondChip = chipRefs.current[1];
    if (!firstChip || !secondChip) return;

    const firstRect = firstChip.getBoundingClientRect();
    const secondRect = secondChip.getBoundingClientRect();
    const firstCenter = firstRect.left + (firstRect.width / 2);
    const secondCenter = secondRect.left + (secondRect.width / 2);
    const measuredStep = Math.abs(secondCenter - firstCenter);

    if (Number.isFinite(measuredStep) && measuredStep > 0) {
      setSnapStep(measuredStep);
    }
  }, [safeCategories.length, activeKey]);

  React.useEffect(() => {
    const handleResize = () => {
      const firstChip = chipRefs.current[0];
      const secondChip = chipRefs.current[1];
      if (!firstChip || !secondChip) return;

      const firstRect = firstChip.getBoundingClientRect();
      const secondRect = secondChip.getBoundingClientRect();
      const firstCenter = firstRect.left + (firstRect.width / 2);
      const secondCenter = secondRect.left + (secondRect.width / 2);
      const measuredStep = Math.abs(secondCenter - firstCenter);

      if (Number.isFinite(measuredStep) && measuredStep > 0) {
        setSnapStep(measuredStep);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (safeCategories.length <= 1) return null;

  const clampIndex = (value) => {
    if (safeCategories.length <= 1) return 0;
    return Math.min(Math.max(value, 0), safeCategories.length - 1);
  };

  const completeDrag = (clientX) => {
    const step = dragStateRef.current.snapStep > 0 ? dragStateRef.current.snapStep : PROFILE_NAV_SNAP_STEP;
    const deltaX = clientX - dragStateRef.current.startX;
    const floatIndex = dragStateRef.current.startIndex - (deltaX / step);
    const nextIndex = clampIndex(Math.round(floatIndex));
    const nextKey = safeCategories[nextIndex]?.key;

    setIsDragging(false);
    setDragOffset(0);

    if (nextKey && nextKey !== activeKey) {
      onSelect(nextKey);
    }
  };

  const handlePointerDown = (event) => {
    if (!event.isPrimary) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: activeIndex,
      snapStep: snapStep > 0 ? snapStep : PROFILE_NAV_SNAP_STEP,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    if (dragStateRef.current.pointerId !== event.pointerId) return;

    const step = dragStateRef.current.snapStep > 0 ? dragStateRef.current.snapStep : PROFILE_NAV_SNAP_STEP;
    const deltaX = event.clientX - dragStateRef.current.startX;
    const minOffset = -(safeCategories.length - 1 - dragStateRef.current.startIndex) * step;
    const maxOffset = dragStateRef.current.startIndex * step;
    const clampedOffset = Math.min(Math.max(deltaX, minOffset), maxOffset);
    setDragOffset(clampedOffset);
  };

  const handlePointerUp = (event) => {
    if (!isDragging) return;
    if (dragStateRef.current.pointerId !== event.pointerId) return;

    completeDrag(event.clientX);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handlePointerCancel = (event) => {
    if (!isDragging) return;
    if (dragStateRef.current.pointerId !== event.pointerId) return;

    setIsDragging(false);
    setDragOffset(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const visualCenterIndex = (safeCategories.length - 1) / 2;
  const translateX = dragOffset + ((visualCenterIndex - activeIndex) * snapStep);

  return (
    <div className="relative h-full w-full min-w-0 flex items-center justify-center" style={{ touchAction: "pan-y" }}>
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 h-10 w-[8.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border ${
          isLightUi ? "border-[#b99a48]/70" : "border-[#f0e5a5]/65"
        }`}
        aria-hidden="true"
      />

      <div
        className="w-full min-w-0 overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="w-full flex items-center justify-center gap-3 select-none"
          style={{
            transform: `translate3d(${translateX}px, 0, 0)`,
            transition: isDragging ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {safeCategories.map((category, categoryIndex) => {
            const isActive = category?.key === activeKey;
            return (
              <button
                key={category.key}
                ref={(node) => {
                  chipRefs.current[categoryIndex] = node;
                }}
                type="button"
                onClick={() => onSelect(category.key)}
                className={`inline-flex h-10 w-[8.5rem] shrink-0 items-center justify-center truncate px-2 text-center text-sm font-semibold transition-colors ${
                  isActive
                    ? (isLightUi ? "text-[#6f5314]" : "text-[#f8efbe]")
                    : (isLightUi ? "text-stone-500" : "text-stone-300/80")
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {category.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AccessoryOptionGrid = ({ options, user, isLightUi, isPending, onSelect, selectedOptionId = null }) => {
  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3">
      {(Array.isArray(options) ? options : []).map((option) => (
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
    </div>
  );
};

const AMBER_PACKAGES = [
  { id: "amber-30", price: 1.30, amber: 30, label: "30 Bernstein" },
  { id: "amber-100", price: 3.90, amber: 100, label: "100 Bernstein" },
  { id: "amber-240", price: 7.90, amber: 240, label: "240 Bernstein" },
];

const BernsteinShopSection = ({ isLightUi }) => {
  const [selectedPackage, setSelectedPackage] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState(null);
  const paypalButtonsRendered = React.useRef(false);
  const paypalClientId = (typeof import.meta !== "undefined" && import.meta.env?.VITE_PAYPAL_CLIENT_ID || "").trim();

  React.useEffect(() => {
    if (!paypalClientId) return;
    if (!document.getElementById("paypal-sdk")) {
      const script = document.createElement("script");
      script.id = "paypal-sdk";
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=EUR`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, [paypalClientId]);

  const handleBuyPackage = (pkg) => {
    setSelectedPackage(pkg);
    setMessage(null);

    setTimeout(() => {
      const container = document.getElementById("paypal-amber-button-container");
      if (container && window.paypal && !paypalButtonsRendered.current) {
        container.innerHTML = "";

        window.paypal.Buttons({
          createOrder: async () => {
            setLoading(true);
            try {
              const response = await supabase.functions.invoke("createPayPalAmberOrder", {
                body: { price: pkg.price },
              });

              if (response.error) {
                let detailedMessage = response.error.message || "Bestellung fehlgeschlagen.";
                try {
                  const errorPayload = await response.error.context?.json?.();
                  const parts = [errorPayload?.error, errorPayload?.details?.error].filter(Boolean);
                  if (parts.length > 0) detailedMessage = parts.join(": ");
                } catch (_) {}
                throw new Error(detailedMessage);
              }

              if (!response.data?.orderID) {
                throw new Error("Keine OrderID erhalten.");
              }

              return response.data.orderID;
            } catch (error) {
              setMessage(`Fehler: ${error.message}`);
              setLoading(false);
              throw error;
            }
          },
          onApprove: async (data) => {
            try {
              const response = await supabase.functions.invoke("capturePayPalAmberPayment", {
                body: { orderID: data.orderID, amber: pkg.amber },
              });

              if (response.error) {
                let detailedMessage = response.error.message || "Zahlung fehlgeschlagen.";
                try {
                  const errorPayload = await response.error.context?.json?.();
                  const parts = [errorPayload?.error, errorPayload?.details?.error].filter(Boolean);
                  if (parts.length > 0) detailedMessage = parts.join(": ");
                } catch (_) {}
                throw new Error(detailedMessage);
              }

              if (response.data?.success) {
                setMessage(`✅ ${response.data.message}`);
                setSelectedPackage(null);
                paypalButtonsRendered.current = false;
              }
            } catch (error) {
              setMessage(`Fehler: ${error.message}`);
            } finally {
              setLoading(false);
            }
          },
          onCancel: () => {
            setLoading(false);
            setSelectedPackage(null);
            paypalButtonsRendered.current = false;
            setMessage("Kauf abgebrochen.");
          },
          onError: (err) => {
            setLoading(false);
            setSelectedPackage(null);
            paypalButtonsRendered.current = false;
            setMessage(`PayPal Fehler: ${String(err)}`);
          },
        }).render("#paypal-amber-button-container");

        paypalButtonsRendered.current = true;
      }
    }, 100);
  };

  return (
    <div className="space-y-3">
      <SectionCard title="Bernstein kaufen" icon={Gem} isLightUi={isLightUi}>
        {message && (
          <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
            {message}
          </div>
        )}

        {selectedPackage ? (
          <div className="space-y-3">
            <div className={`rounded-xl border px-3 py-3 text-center ${isLightUi ? "border-[#c8ac62]/45 bg-white/80" : "border-[#f0e5a5]/35 bg-black/35"}`}>
              <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
                {selectedPackage.label}
              </div>
              <div className={`mt-1 text-lg font-bold ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                {selectedPackage.price.toFixed(2).replace(".", ",")} €
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-3">
                <RefreshCw className={`w-5 h-5 animate-spin ${isLightUi ? "text-stone-600" : "text-stone-300"}`} />
              </div>
            )}

            <div id="paypal-amber-button-container" className={loading ? "opacity-50 pointer-events-none" : ""} />

            <button
              type="button"
              onClick={() => {
                setSelectedPackage(null);
                paypalButtonsRendered.current = false;
              }}
              className={`w-full h-9 rounded-xl border px-3 text-xs font-semibold ${isLightUi ? "border-[#c8ac62]/40 bg-white/75 text-stone-700 hover:bg-white" : "border-[#f0e5a5]/25 bg-black/35 text-stone-100 hover:bg-black/50"}`}
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {AMBER_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handleBuyPackage(pkg)}
                className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                  isLightUi
                    ? "border-[#c8ac62]/35 bg-white/70 hover:border-[#c8ac62]/60 hover:shadow-[0_6px_16px_rgba(162,129,48,0.12)]"
                    : "border-[#f0e5a5]/25 bg-black/25 hover:border-[#f0e5a5]/50 hover:shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLightUi ? "bg-amber-100 text-amber-700" : "bg-amber-500/20 text-amber-300"}`}>
                    <Gem className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
                      {pkg.amber} Bernstein
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>
                    {pkg.price.toFixed(2).replace(".", ",")} €
                  </span>
                  <span className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold ${
                    isLightUi
                      ? "border-[#c8ac62]/50 bg-[#f4e7bf] text-stone-800"
                      : "border-[#f0e5a5]/40 bg-[#4f4826] text-[#f7f0c1]"
                  }`}>
                    Kaufen
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
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
 *   ownedUniqueBadgeIds?: string[] | null,
 *   onHeaderMetaChange?: any,
 *   onUserUpdated?: (user: any) => void,
 *   externalActionMode?: boolean,
 *   onActionStateChange?: any,
 *   onBackStateChange?: any,
 * }} props
 */
export default function ShopFeatureRoot({
  embedded = true,
  showEmbeddedBottomDivider = true,
  initialCategory = "accessories",
  authId = null,
  currentUser = null,
  badgeMetrics = null,
  ownedUniqueBadgeIds = null,
  onHeaderMetaChange,
  onUserUpdated,
  externalActionMode = false,
  onActionStateChange,
  onBackStateChange,
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
  const { toast } = useToast();
  const [purchaseConfirmOption, setPurchaseConfirmOption] = useState(null);
  const [purchaseCurrency, setPurchaseCurrency] = useState(null); // "sparks" | "amber" | null
  const [purchaseDialogStep, setPurchaseDialogStep] = useState("select"); // "select" | "confirm"
  const [selectedOptionForAction, setSelectedOptionForAction] = useState(null);
  const [activeFlorabotSectionKey, setActiveFlorabotSectionKey] = useState(null);
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
    staleTime: 60 * 1000,
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
    staleTime: 60 * 1000,
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

  const ownedUniqueBadges = useMemo(() => {
    return resolveOwnedUniqueBadges(ownedUniqueBadgeIds || []);
  }, [ownedUniqueBadgeIds]);

  const badgeCategory = useMemo(() => {
    const sections = [
      {
        key: "metric_badges",
        title: "Metrik-Abzeichen",
        emptyLabel: "Noch keine Abzeichen verfügbar.",
        options: evaluatedBadges,
      },
    ];
    if (ownedUniqueBadges.length > 0) {
      sections.unshift({
        key: "unique_badges",
        title: "Einzigartige Abzeichen",
        emptyLabel: "",
        options: ownedUniqueBadges,
      });
    }
    const totalCount = evaluatedBadges.length + ownedUniqueBadges.length;
    return {
      key: "badges",
      title: "Abzeichen",
      subtitle: "Metrik-Abzeichen mit 5 Rängen (Grau, Weiß, Bronze, Silber, Gold)",
      sections,
      optionCount: totalCount,
    };
  }, [evaluatedBadges, ownedUniqueBadges]);

  const accessoriesCategory = useMemo(() => {
    return customizationCategories.find((category) => category.key === "accessories") || null;
  }, [customizationCategories]);

  const faceSection = useMemo(() => {
    if (!accessoriesCategory) return null;
    return (accessoriesCategory.sections || []).find((section) => section?.key === "face") || null;
  }, [accessoriesCategory]);

  const plantSection = useMemo(() => {
    if (!accessoriesCategory) return null;
    return (accessoriesCategory.sections || []).find((section) => section?.key === "plant") || null;
  }, [accessoriesCategory]);

  const borderSection = useMemo(() => {
    if (!accessoriesCategory) return null;
    return (accessoriesCategory.sections || []).find((section) => section?.key === "border") || null;
  }, [accessoriesCategory]);

  const effectsCategory = useMemo(() => {
    return customizationCategories.find((category) => category.key === "effects") || null;
  }, [customizationCategories]);

  const profileEffectsSection = useMemo(() => {
    if (!effectsCategory) return null;
    return (effectsCategory.sections || []).find((section) => section?.key === "profile_effects") || null;
  }, [effectsCategory]);

  const logoEffectsSection = useMemo(() => {
    if (!effectsCategory) return null;
    return (effectsCategory.sections || []).find((section) => section?.key === "logo_effects") || null;
  }, [effectsCategory]);

  const florabotCategories = useMemo(() => {
    const unlockedLogoEffects = mapSectionsWithOptionFilter(
      logoEffectsSection ? [logoEffectsSection] : [],
      isOptionUnlocked,
    );

    const florabotEffectsCategory = {
      key: "effects",
      title: "Effekte",
      subtitle: "Freigeschaltete Florabot-Effekte",
      sections: unlockedLogoEffects.length > 0
        ? unlockedLogoEffects
        : [
            {
              key: "logo_effects",
              title: "Florabot-Effekte",
              emptyLabel: "Noch keine Florabot-Effekte freigeschaltet.",
              options: [],
            },
          ],
      optionCount: unlockedLogoEffects.reduce((sum, section) => sum + (section?.options?.length || 0), 0),
    };

    const resolved = [
      ...customizationCategories.filter((category) => category.key === "accessories"),
      florabotEffectsCategory,
    ].map((category) => ({
      ...category,
      optionCount: typeof category.optionCount === "number" ? category.optionCount : getCategoryOptionCount(category),
    }));

    return orderByCategoryList(resolved, ROOT_SUBCATEGORY_ORDER.florabot);
  }, [customizationCategories, logoEffectsSection]);

  const backgroundsCategory = useMemo(() => {
    return customizationCategories.find((category) => category.key === "backgrounds") || null;
  }, [customizationCategories]);

  const profileCategories = useMemo(() => {
    const unlockedProfileEffects = mapSectionsWithOptionFilter(
      profileEffectsSection ? [profileEffectsSection] : [],
      isOptionUnlocked,
    );

    const profileEffectsCategory = {
      key: "effects",
      title: "Effekte",
      subtitle: "Freigeschaltete Profileffekte",
      sections: unlockedProfileEffects.length > 0
        ? unlockedProfileEffects
        : [
            {
              key: "profile_effects",
              title: "Profileffekte",
              emptyLabel: "Noch keine Effekte freigeschaltet.",
              options: [],
            },
          ],
      optionCount: unlockedProfileEffects.reduce((sum, section) => sum + (section?.options?.length || 0), 0),
    };

    // Profile view: show only already-unlocked backgrounds (purchasable/locked ones are shop-only)
    const unlockedBackgroundsCategory = backgroundsCategory
      ? {
          ...backgroundsCategory,
          sections: mapSectionsWithOptionFilter(backgroundsCategory.sections, isOptionUnlocked),
        }
      : null;

    const resolved = [
      ...(unlockedBackgroundsCategory ? [unlockedBackgroundsCategory] : []),
      ...customizationCategories.filter((category) => category.key === "titles"),
      badgeCategory,
      profileEffectsCategory,
    ].map((category) => ({
      ...category,
      optionCount: typeof category.optionCount === "number" ? category.optionCount : getCategoryOptionCount(category),
    }));

    return orderByCategoryList(resolved, ROOT_SUBCATEGORY_ORDER.profile);
  }, [customizationCategories, backgroundsCategory, badgeCategory, profileEffectsSection]);

  const shopCategories = useMemo(() => {
    const resolved = [];

    if (backgroundsCategory) {
      const lockedPurchasableBackgroundSections = mapSectionsWithOptionFilter(
        backgroundsCategory.sections,
        isOptionLockedAndPurchasable,
      );

      resolved.push({
        ...backgroundsCategory,
        key: "backgrounds",
        title: "Hintergründe",
        subtitle: "Kaufbare, noch gesperrte Hintergründe",
        sections: lockedPurchasableBackgroundSections,
        optionCount: getCategoryOptionCount({
          ...backgroundsCategory,
          sections: lockedPurchasableBackgroundSections,
        }),
      });
    }

    const lockedPurchasableFaceOptions = mapSectionsWithOptionFilter(
      faceSection
        ? [
            {
              ...faceSection,
              key: "face",
              title: "Gesicht",
            },
          ]
        : [],
      isOptionLockedAndPurchasable,
    );

    resolved.push({
      key: "face",
      title: "Gesicht",
      subtitle: "Kaufbare, noch gesperrte Gesichts-Assets",
      sections: lockedPurchasableFaceOptions,
      optionCount: lockedPurchasableFaceOptions.reduce((sum, section) => sum + (section?.options?.length || 0), 0),
    });

    const lockedPurchasablePlantOptions = mapSectionsWithOptionFilter(
      plantSection
        ? [
            {
              ...plantSection,
              key: "plant",
              title: "Pflanze",
            },
          ]
        : [],
      isOptionLockedAndPurchasable,
    );

    resolved.push({
      key: "plant",
      title: "Pflanze",
      subtitle: "Kaufbare, noch gesperrte Pflanzen-Accessoires",
      sections: lockedPurchasablePlantOptions,
      optionCount: lockedPurchasablePlantOptions.reduce((sum, section) => sum + (section?.options?.length || 0), 0),
    });

    const lockedPurchasableBorderOptions = mapSectionsWithOptionFilter(
      borderSection
        ? [
            {
              ...borderSection,
              key: "border",
              title: "Rahmen",
            },
          ]
        : [],
      isOptionLockedAndPurchasable,
    );

    resolved.push({
      key: "border",
      title: "Rahmen",
      subtitle: "Kaufbare, noch gesperrte Rahmen-Accessoires",
      sections: lockedPurchasableBorderOptions,
      optionCount: lockedPurchasableBorderOptions.reduce((sum, section) => sum + (section?.options?.length || 0), 0),
    });

    if (effectsCategory) {
      const lockedPurchasableEffectSections = mapSectionsWithOptionFilter(
        effectsCategory.sections,
        isOptionLockedAndPurchasable,
      );

      resolved.push({
        ...effectsCategory,
        key: "effects",
        title: "Effekte",
        subtitle: "Kaufbare, noch gesperrte Effekte",
        sections: lockedPurchasableEffectSections,
        optionCount: getCategoryOptionCount({
          ...effectsCategory,
          sections: lockedPurchasableEffectSections,
        }),
      });
    }

    resolved.push({
      key: "scans",
      title: "Scans",
      subtitle: "Scan-basierte Inhalte folgen bald",
      sections: [],
      optionCount: 0,
      isPlaceholder: true,
    });

    resolved.push({
      key: "bernstein",
      title: "Bernstein",
      subtitle: "Bernstein-Pakete kaufen",
      sections: [],
      optionCount: 0,
    });

    return orderByCategoryList(resolved, ROOT_SUBCATEGORY_ORDER.shop);
  }, [backgroundsCategory, effectsCategory, faceSection, plantSection, borderSection]);

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
  const florabotAccessorySections = useMemo(() => {
    if (shopRootCategory !== "florabot" || currentCategory?.key !== "accessories") return [];
    return Array.isArray(currentCategory?.sections) ? currentCategory.sections : [];
  }, [shopRootCategory, currentCategory?.key, currentCategory?.sections]);

  useEffect(() => {
    if (florabotAccessorySections.length === 0) {
      if (activeFlorabotSectionKey !== null) {
        setActiveFlorabotSectionKey(null);
      }
      return;
    }

    const hasActiveSection = florabotAccessorySections.some((section) => section?.key === activeFlorabotSectionKey);
    if (!hasActiveSection) {
      setActiveFlorabotSectionKey(florabotAccessorySections[0]?.key || null);
    }
  }, [florabotAccessorySections, activeFlorabotSectionKey]);

  const activeFlorabotSection = florabotAccessorySections.find((section) => section?.key === activeFlorabotSectionKey)
    || florabotAccessorySections[0]
    || null;

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
      const purchaseKind = String(option?.purchaseKind || "accessory").trim().toLowerCase();
      if (!option?.isPurchasable || (sparkPrice <= 0 && amberPrice <= 0)) {
        throw new Error("Diese Belohnung ist nicht kaufbar.");
      }

      const normalizedOptionValue = String(option?.value || "").trim().toLowerCase();
      const normalizedOptionRewardId = String(option?.rewardId || "").trim();

      const matchingReward = (Array.isArray(rewards) ? rewards : []).find((reward) => {
        const rewardType = String(reward?.type || reward?.reward_type || reward?.kind || "").trim().toLowerCase();
        const rewardId = String(reward?.id || "").trim();

        if (normalizedOptionRewardId && rewardId === normalizedOptionRewardId) {
          if (purchaseKind === "profile_effect") return rewardType === "profile_effect";
          if (purchaseKind === "logo_effect") return rewardType === "logo_effect";
          if (purchaseKind === "background") return rewardType === "background";
          return ACCESSORY_PURCHASABLE_REWARD_TYPES.has(rewardType);
        }

        if (purchaseKind === "profile_effect") {
          return rewardType === "profile_effect" && String(reward?.value || "").trim().toLowerCase() === normalizedOptionValue;
        }

        if (purchaseKind === "logo_effect") {
          return rewardType === "logo_effect" && String(reward?.value || "").trim().toLowerCase() === normalizedOptionValue;
        }

        return ACCESSORY_PURCHASABLE_REWARD_TYPES.has(rewardType) && accessoryValueMatches(reward?.value, option?.value);
      });

      if (!matchingReward?.id) {
        return {
          applied: false,
          errorCode: "reward_not_configured",
        };
      }

      const eventReference = `shop-${purchaseKind}:${String(option.value || matchingReward.id)}:${Date.now()}`;
      const { data, error } = await supabase.functions.invoke("purchaseAccessory", {
        body: {
          authId: resolvedAuthId,
          userEmail: resolvedUserEmail,
          rewardId: matchingReward.id,
          accessoryId: (purchaseKind === "profile_effect" || purchaseKind === "logo_effect" || purchaseKind === "background") ? null : String(option.value),
          purchaseKind,
          rewardType: String(matchingReward?.type || "").trim().toLowerCase(),
          rewardValue: String(option?.value || matchingReward?.value || ""),
          sparkPrice,
          amberPrice,
          paymentCurrency: option.paymentCurrency || "sparks",
          eventReference,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (result) => {
      if (!result?.applied) {
        if (result?.errorCode === "insufficient_sparks") {
          toast({ title: "Nicht genug Funken", description: `Benötigt: ${result.sparkPrice}, verfügbar: ${result.sparksBalance}.`, variant: "destructive" });
        } else if (result?.errorCode === "insufficient_amber") {
          toast({ title: "Nicht genug Bernstein", description: `Benötigt: ${result.amberPrice}, verfügbar: ${result.amberBalance}.`, variant: "destructive" });
        } else if (result?.errorCode === "reward_not_configured") {
          toast({ title: "Kauf nicht möglich", description: "Diese Belohnung kann aktuell nicht gekauft werden.", variant: "destructive" });
        } else if (result?.errorCode === "price_mismatch") {
          toast({ title: "Preisfehler", description: "Die Preise stimmen nicht überein. Bitte lade die Seite neu und versuche es erneut.", variant: "destructive" });
        } else if (result?.errorCode === "asset_legacy") {
          toast({ title: "Nicht verfügbar", description: "Dieses Item ist nicht mehr im Shop erhältlich.", variant: "destructive" });
        } else {
          toast({ title: "Kauf fehlgeschlagen", description: result?.errorCode ? `Fehlercode: ${result.errorCode}` : "Kauf konnte nicht abgeschlossen werden.", variant: "destructive" });
        }
      } else if (result?.alreadyOwned) {
        toast({ title: "Bereits freigeschaltet", description: "Du besitzt diese Belohnung bereits." });
      } else {
        toast({ title: "Belohnung gekauft", description: "Du kannst sie jetzt unter deinen Accessoires ausrüsten." });
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
      toast({ title: "Kauf fehlgeschlagen", description: message || "Ein unbekannter Fehler ist aufgetreten.", variant: "destructive" });
    },
  });

  const handleSelectBackground = async (option) => {
    if (externalActionMode) {
      if (option?.isLocked) {
        const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
        const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
        const canBeBought = Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);
        if (!canBeBought) {
          setShopMessage(option?.unlockCondition || "Dieser Hintergrund ist noch gesperrt.");
          return;
        }
        setSelectedOptionForAction({
          kind: "background",
          option,
          actionLabel: "Kaufen",
          actionDisabled: false,
        });
        return;
      }
      setSelectedOptionForAction({
        kind: "background",
        option,
        actionLabel: "Ausrüsten",
        actionDisabled: false,
      });
      return;
    }

    setShopMessage(null);

    if (option?.isLocked) {
      if (option?.isPurchasable && (Number(option?.sparkPrice || 0) > 0 || Number(option?.amberPrice || 0) > 0)) {
        setPurchaseConfirmOption(option);
        setPurchaseCurrency(null);
        setPurchaseDialogStep("select");
      } else {
        setShopMessage(option?.unlockCondition || "Dieser Hintergrund ist noch gesperrt.");
      }
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
      if (option?.isPurchasable && (Number(option?.sparkPrice || 0) > 0 || Number(option?.amberPrice || 0) > 0)) {
        setPurchaseConfirmOption(option);
        setPurchaseCurrency(null);
        setPurchaseDialogStep("select");
      } else {
        setShopMessage(option?.unlockCondition || "Dieser Hintergrund ist noch gesperrt.");
      }
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
        actionLabel: "Ausrüsten",
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

  const handleSelectProfileEffect = async (option) => {
    const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
    const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
    const canBeBought = Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);
    const isLocked = Boolean(option?.isLocked);

    if (externalActionMode) {
      if (isLocked && !canBeBought) {
        setShopMessage(option?.unlockCondition || "Dieser Effekt ist noch gesperrt.");
        return;
      }

      setSelectedOptionForAction({
        kind: "profile-effect",
        option,
        actionLabel: isLocked ? "Kaufen" : "Ausrüsten",
        actionDisabled: false,
      });
      return;
    }

    if (isLocked) {
      if (canBeBought) {
        setShopMessage(null);
        setPurchaseConfirmOption(option);
        setPurchaseCurrency(null);
        setPurchaseDialogStep("select");
      } else {
        setShopMessage(option?.unlockCondition || "Dieser Effekt ist noch gesperrt.");
      }
      return;
    }

    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_profile_effect: option?.value || null });
  };

  const applyProfileEffectSelection = async (option) => {
    const sparkPrice = Math.max(0, Number(option?.sparkPrice || 0));
    const amberPrice = Math.max(0, Number(option?.amberPrice || 0));
    const canBeBought = Boolean(option?.isPurchasable) && (sparkPrice > 0 || amberPrice > 0);
    const isLocked = Boolean(option?.isLocked);

    if (isLocked) {
      if (canBeBought) {
        setShopMessage(null);
        setPurchaseConfirmOption(option);
        setPurchaseCurrency(null);
        setPurchaseDialogStep("select");
      } else {
        setShopMessage(option?.unlockCondition || "Dieser Effekt ist noch gesperrt.");
      }
      return;
    }

    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_profile_effect: option?.value || null });
  };

  const handleResetProfileEffect = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_profile_effect: null });
  };

  const handleResetLogoEffect = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_logo_effect: null });
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
        actionLabel: isLocked ? "Kaufen" : "Ausrüsten",
        actionDisabled: false,
      });
      return;
    }

    if (!option?.profileField) return;
    if (option?.isLocked) {
      if (option?.isPurchasable && (Number(option?.sparkPrice || 0) > 0 || Number(option?.amberPrice || 0) > 0)) {
        setShopMessage(null);
        setPurchaseConfirmOption(option);
        setPurchaseCurrency(null);
        setPurchaseDialogStep("select");
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
        setPurchaseConfirmOption(option);
        setPurchaseCurrency(null);
        setPurchaseDialogStep("select");
      } else {
        setShopMessage("Dieses Accessoire ist noch gesperrt.");
      }
      return;
    }

    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ [option.profileField]: option.value });
  };

  const handleSelectBorderColor = async (hex) => {
    // Der BorderColorPicker hat bereits einen eigenen Bestätigungs-Dialog ("Festlegen"),
    // daher wird hier immer direkt gespeichert – unabhängig von externalActionMode.
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
      subtitle: isRootCategoryLandingVisible ? "Kategorie wählen" : null,
      infoLabel: {
        sparks: availableSparks,
        amber: availableAmber,
      },
    });
  }, [activeRootMeta?.title, availableAmber, availableSparks, embedded, isRootCategoryLandingVisible, onHeaderMetaChange]);

  const purchaseDialogSparkPrice = Math.max(0, Number(purchaseConfirmOption?.sparkPrice ?? 0));
  const purchaseDialogAmberPrice = Math.max(0, Number(purchaseConfirmOption?.amberPrice ?? 0));
  const purchaseDialogHasBothPrices = purchaseDialogSparkPrice > 0 && purchaseDialogAmberPrice > 0;
  // Keep currency unset when both prices exist to force an explicit user choice.
  const effectivePurchaseCurrency = purchaseDialogHasBothPrices
    ? purchaseCurrency
    : (purchaseDialogSparkPrice > 0 ? "sparks" : "amber");
  const hasSelectedPurchaseCurrency = Boolean(effectivePurchaseCurrency);
  const canAffordDialogSparks = availableSparks >= purchaseDialogSparkPrice;
  const canAffordDialogAmber = availableAmber >= purchaseDialogAmberPrice;
  const canAffordPurchaseDialogOption = !effectivePurchaseCurrency
    ? false
    : (effectivePurchaseCurrency === "sparks" ? canAffordDialogSparks : canAffordDialogAmber);
  const projectedSparksBalance = effectivePurchaseCurrency === "sparks"
    ? Math.max(0, availableSparks - purchaseDialogSparkPrice)
    : availableSparks;
  const projectedAmberBalance = effectivePurchaseCurrency === "amber"
    ? Math.max(0, availableAmber - purchaseDialogAmberPrice)
    : availableAmber;
  const selectedCurrencyLabel = effectivePurchaseCurrency === "amber" ? "Bernstein" : "Funken";
  const selectedCurrencyPrice = effectivePurchaseCurrency === "amber" ? purchaseDialogAmberPrice : purchaseDialogSparkPrice;
  const isPurchaseSafetyStep = purchaseDialogStep === "confirm";
  const resolvedCurrentTitle = resolveTitleValue(resolvedCurrentUser?.selected_title, resolvedCurrentUser?.title) || "Pflanzen-Entdecker";
  const isMutationPending = updateCustomizationMutation.isPending || purchaseAccessoryMutation.isPending;
  const selectedActionRef = React.useRef(null);
  const backActionRef = React.useRef(null);

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
    if (kind === "profile-effect") {
      await applyProfileEffectSelection(option);
      return;
    }
    if (kind === "border-color") {
      await applyBorderColorSelection(option?.value || null);
    }
  };

  selectedActionRef.current = executeSelectedAction;
  backActionRef.current = () => {
    if (!isRootCategoryLandingVisible) {
      handleBackToRootCategories();
    }
  };

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

  useEffect(() => {
    if (typeof onBackStateChange !== "function") return;

    const canGoBack = !isRootCategoryLandingVisible;
    onBackStateChange({
      canGoBack,
      onBack: () => {
        if (typeof backActionRef.current === "function") {
          backActionRef.current();
        }
      },
    });
  }, [isRootCategoryLandingVisible, onBackStateChange]);

  const handleClosePurchaseDialog = () => {
    if (purchaseAccessoryMutation.isPending) return;
    setPurchaseConfirmOption(null);
    setPurchaseCurrency(null);
    setPurchaseDialogStep("select");
  };

  const handleProceedToPurchaseSafetyStep = () => {
    if (!purchaseConfirmOption || purchaseAccessoryMutation.isPending) return;
    if (purchaseDialogHasBothPrices && !purchaseCurrency) {
      setShopMessage("Bitte wähle zuerst, ob du mit Funken oder Bernstein kaufen möchtest.");
      return;
    }
    if (!canAffordPurchaseDialogOption) {
      if (effectivePurchaseCurrency === "sparks") {
        setShopMessage(`Nicht genug Funken. Benötigt: ${purchaseDialogSparkPrice}, verfügbar: ${availableSparks}.`);
      } else {
        setShopMessage(`Nicht genug Bernstein. Benötigt: ${purchaseDialogAmberPrice}, verfügbar: ${availableAmber}.`);
      }
      return;
    }
    setShopMessage(null);
    setPurchaseDialogStep("confirm");
  };

  const handleBackToPurchaseSelectionStep = () => {
    if (purchaseAccessoryMutation.isPending) return;
    setPurchaseDialogStep("select");
  };

  const handleConfirmAccessoryPurchase = async () => {
    if (!purchaseConfirmOption || purchaseAccessoryMutation.isPending) return;
    if (purchaseDialogHasBothPrices && !purchaseCurrency) {
      setShopMessage("Bitte wähle zuerst, ob du mit Funken oder Bernstein kaufen möchtest.");
      return;
    }
    if (!canAffordPurchaseDialogOption) {
      if (effectivePurchaseCurrency === "sparks") {
        setShopMessage(`Nicht genug Funken. Benötigt: ${purchaseDialogSparkPrice}, verfügbar: ${availableSparks}.`);
      } else {
        setShopMessage(`Nicht genug Bernstein. Benötigt: ${purchaseDialogAmberPrice}, verfügbar: ${availableAmber}.`);
      }
      return;
    }

    try {
      await purchaseAccessoryMutation.mutateAsync({ ...purchaseConfirmOption, paymentCurrency: effectivePurchaseCurrency });
      setPurchaseConfirmOption(null);
      setPurchaseCurrency(null);
      setPurchaseDialogStep("select");
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

  const rootCategoryEntries = [
    {
      ...ROOT_CATEGORY_META.shop,
    },
    {
      ...ROOT_CATEGORY_META.florabot,
    },
    {
      ...ROOT_CATEGORY_META.profile,
    },
  ];

  const shouldShowProfileCarousel = !isRootCategoryLandingVisible && shopRootCategory === "profile" && profileCategories.length > 0;
  const shouldShowFlorabotCarousel = !isRootCategoryLandingVisible && shopRootCategory === "florabot" && florabotCategories.length > 1;
  const shouldShowShopCarousel = !isRootCategoryLandingVisible && shopRootCategory === "shop" && shopCategories.length > 1;
  const florabotCarouselItems = florabotCategories.map((category) => ({ key: category.key, title: category.title }));

  const shopCarouselBlock = shouldShowShopCarousel ? (
    <ProfileCategorySnapCarousel
      categories={shopCategories}
      activeKey={shopCategory}
      isLightUi={isLightUi}
      onSelect={setShopCategory}
    />
  ) : null;

  const profileCarouselBlock = shouldShowProfileCarousel ? (
    <ProfileCategorySnapCarousel
      categories={profileCategories}
      activeKey={shopCategory}
      isLightUi={isLightUi}
      onSelect={setShopCategory}
    />
  ) : null;

  const florabotCarouselBlock = shouldShowFlorabotCarousel ? (
    <ProfileCategorySnapCarousel
      categories={florabotCarouselItems}
      activeKey={shopCategory}
      isLightUi={isLightUi}
      onSelect={setShopCategory}
    />
  ) : null;

  const shouldShowFixedTopNav = shouldShowProfileCarousel || shouldShowFlorabotCarousel || shouldShowShopCarousel;
  const fixedTopNavBar = shouldShowFixedTopNav ? (
    <div className={`shrink-0 px-4 ${embedded ? "h-20" : "h-24"} flex items-center`}>
      <div className="max-w-5xl mx-auto w-full min-w-0 h-full flex items-center justify-center">
        {shouldShowShopCarousel ? shopCarouselBlock : (shouldShowProfileCarousel ? profileCarouselBlock : florabotCarouselBlock)}
      </div>
    </div>
  ) : null;

  const topNavDivider = shouldShowFixedTopNav
    ? <div className={`relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen shrink-0 border-t-2 ${embeddedDividerClass}`} aria-hidden="true" />
    : null;

  return (
    <section
      data-embedded-module="shop"
      data-theme={isLightUi ? "light" : "dark"}
      className="h-full flex-1 min-h-0 overflow-hidden flex flex-col"
    >
      {fixedTopNavBar}
      {topNavDivider}

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
                  descriptionScrollable={false}
                  descriptionMaxHeightClass="max-h-none"
                  showChevron
                  onClick={() => handleSelectRootCategory(entry.key)}
                />
              ))}
            </div>
          ) : !currentCategory ? (
            <div className="px-1 py-6 flex flex-col items-center justify-center gap-3 text-center">
              <Sparkles className={`w-6 h-6 ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`} />
              <div className={`text-sm font-medium ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Noch keine Anpassungskategorien verfügbar</div>
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
          ) : currentCategory.key === "backgrounds" && shopRootCategory === "shop" ? (
            <div className="space-y-3">
              {currentCategory.sections.every((section) => section.options.length === 0) ? (
                <SectionCard title="Kaufbare Hintergründe" icon={ImageIcon} isLightUi={isLightUi}>
                  <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                    Keine kaufbaren Hintergründe verfügbar.
                  </div>
                </SectionCard>
              ) : (
                currentCategory.sections.map((section) =>
                  section.options.length === 0 ? null : (
                    <SectionCard key={section.key} title={section.title} icon={ImageIcon} isLightUi={isLightUi}>
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
                    </SectionCard>
                  )
                )
              )}
            </div>
          ) : currentCategory.key === "backgrounds" ? (
            <div className="space-y-3">
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
          ) : shopRootCategory === "shop" && ["face", "plant", "border"].includes(currentCategory.key) ? (
            <div className="space-y-3">
              <SectionCard
                title={
                  currentCategory.key === "face"
                    ? "Gesicht auswählen"
                    : currentCategory.key === "plant"
                    ? "Pflanze auswählen"
                    : "Rahmen auswählen"
                }
                icon={
                  currentCategory.key === "face"
                    ? Smile
                    : currentCategory.key === "plant"
                    ? Leaf
                    : Frame
                }
                isLightUi={isLightUi}
              >
                {(currentCategory.sections?.[0]?.options || []).length ? (
                  <AccessoryOptionGrid
                    options={currentCategory.sections[0].options}
                    user={resolvedCurrentUser}
                    isLightUi={isLightUi}
                    isPending={isMutationPending}
                    onSelect={handleSelectAccessory}
                    selectedOptionId={selectedOptionForAction?.kind === "accessory" ? selectedOptionForAction?.option?.id : null}
                  />
                ) : (
                  <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                    {CATEGORY_META[currentCategory.key]?.emptyLabel || CATEGORY_META.face.emptyLabel}
                  </div>
                )}
              </SectionCard>
            </div>
          ) : currentCategory.key === "effects" ? (
            <div className="space-y-3">
              {shopRootCategory !== "shop" && (
                <div className={`rounded-[1.5rem] border px-3 py-3 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-[#f0e5a5]/20 bg-black/28"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Aktiver Effekt</div>
                      <div className={`mt-1 text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
                        {shopRootCategory === "florabot"
                          ? (resolvedCurrentUser?.selected_logo_effect ? "Ein Florabot-Effekt ist aktiv." : "Kein Florabot-Effekt aktiv.")
                          : (resolvedCurrentUser?.selected_profile_effect ? "Ein Profileffekt ist aktiv." : "Kein Profileffekt aktiv.")}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isMutationPending}
                      onClick={shopRootCategory === "florabot" ? handleResetLogoEffect : handleResetProfileEffect}
                      className={`h-9 rounded-xl border px-3 text-xs font-semibold disabled:opacity-60 ${
                        isLightUi
                          ? "border-[#c8ac62]/40 bg-white/75 text-stone-700 hover:bg-white"
                          : "border-[#f0e5a5]/25 bg-black/35 text-stone-100 hover:bg-black/50"
                      }`}
                    >
                      Effekt entfernen
                    </button>
                  </div>
                </div>
              )}

              {(currentCategory.sections || []).map((section) => (
                <SectionCard key={section.key} title={section.title} icon={Sparkles} isLightUi={isLightUi}>
                  {section.options?.length ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {section.options.map((option) => {
                        const isLogoEffectOption = section.key === "logo_effects" || option?.profileField === "selected_logo_effect";
                        const isSelected = selectedOptionForAction?.option?.id === option.id
                          && (isLogoEffectOption ? selectedOptionForAction?.kind === "accessory" : selectedOptionForAction?.kind === "profile-effect");

                        return (
                          <ProfileEffectOptionCard
                            key={option.id}
                            option={option}
                            user={resolvedCurrentUser}
                            isLightUi={isLightUi}
                            isPending={isMutationPending}
                            isSelected={isSelected}
                            onSelect={isLogoEffectOption ? handleSelectAccessory : handleSelectProfileEffect}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                      {section.emptyLabel || CATEGORY_META.effects.emptyLabel}
                    </div>
                  )}
                </SectionCard>
              ))}
            </div>
          ) : shopRootCategory === "shop" && currentCategory.key === "scans" ? (
            <div className="space-y-3">
              <SectionCard title="Scans" icon={ScanSearch} isLightUi={isLightUi}>
                <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-600" : "border-[#f0e5a5]/20 text-stone-300/80"}`}>
                  Scan-Angebote folgen bald. Hier entsteht die nächste Shop-Kategorie.
                </div>
              </SectionCard>
            </div>
          ) : shopRootCategory === "shop" && currentCategory.key === "bernstein" ? (
            <BernsteinShopSection isLightUi={isLightUi} />
          ) : currentCategory.key === "accessories" ? (
            <div className="space-y-3">
              {florabotAccessorySections.length > 1 && (
                <ProfileCategorySnapCarousel
                  categories={florabotAccessorySections.map((section) => ({ key: section.key, title: section.title }))}
                  activeKey={activeFlorabotSection?.key || florabotAccessorySections[0]?.key || null}
                  isLightUi={isLightUi}
                  onSelect={setActiveFlorabotSectionKey}
                />
              )}

              {activeFlorabotSection ? (
                activeFlorabotSection.options.length === 0 ? (
                  <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                    {activeFlorabotSection.emptyLabel}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AccessoryOptionGrid
                      options={activeFlorabotSection.options}
                      user={resolvedCurrentUser}
                      isLightUi={isLightUi}
                      isPending={isMutationPending}
                      onSelect={handleSelectAccessory}
                      selectedOptionId={selectedOptionForAction?.kind === "accessory" ? selectedOptionForAction?.option?.id : null}
                    />
                    {activeFlorabotSection.key === "border" && (
                      <BorderColorPicker
                        currentColor={resolvedCurrentUser?.selected_border_color || null}
                        isLightUi={isLightUi}
                        isPending={isMutationPending}
                        onSelectColor={handleSelectBorderColor}
                      />
                    )}
                  </div>
                )
              ) : (
                <div className={`rounded-2xl border border-dashed px-3 py-4 text-xs ${isLightUi ? "border-[#c8ac62]/30 text-stone-500" : "border-[#f0e5a5]/20 text-stone-300/75"}`}>
                  {CATEGORY_META.accessories.emptyLabel}
                </div>
              )}
            </div>
          ) : currentCategory.key === "badges" ? (
            <div className="space-y-3">
              <SectionCard title="Abzeichen auswählen" icon={BadgeCheck} isLightUi={isLightUi}>
                <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                  Du kannst bis zu {PROFILE_BADGE_MAX_SELECTED} Abzeichen im Profilbanner anzeigen. Aktuell ausgewählt: {selectedBadgeIds.length}/{PROFILE_BADGE_MAX_SELECTED}.
                </div>

                {(currentCategory.sections || []).map((section) => (
                  <div key={section.key} className="mb-4 last:mb-0">
                    {currentCategory.sections.length > 1 && (
                      <div className={`mb-2 text-xs font-semibold ${isLightUi ? "text-[#8f6b22]" : "text-stone-200/90"}`}>
                        {section.title}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {(section.options || []).map((badge) => {
                    const Icon = getProfileBadgeIconComponent(badge.iconKey);
                    const rankChipClass = BADGE_RANK_BADGE_STYLE[badge.rankKey] || BADGE_RANK_BADGE_STYLE.gray;
                    const iconToneClass = BADGE_RANK_ICON_STYLE[badge.rankKey] || BADGE_RANK_ICON_STYLE.gray;
                    const isSelected = selectedBadgeIds.includes(badge.id);

                    const tooltipContent = (
                      <div className="space-y-1 text-[11px] leading-snug">
                        <div className="font-semibold">{badge.label}</div>
                        <div>{badge.description}</div>
                        {!badge.isUnique && <div className="opacity-85">Wert: {badge.valueLabel}</div>}
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
                              Tippen zum {isSelected ? "Abwählen" : "Auswählen"}
                            </span>
                          </div>
                        </button>
                      </LockedTooltip>
                    );
                  })}
                    </div>
                  </div>
                ))}

                <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                  Verfügbare Abzeichen: {currentCategory.optionCount}. Ausgewählte Abzeichen erscheinen neben Florabot im Home-Banner.
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

      {embedded && showEmbeddedBottomDivider ? <div className={`relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen shrink-0 border-t-2 ${embeddedDividerClass}`} aria-hidden="true" /> : null}

      <Dialog open={Boolean(purchaseConfirmOption)} onOpenChange={(open) => {
        if (!open) handleClosePurchaseDialog();
      }}>
        <DialogContent className={`max-w-[min(92vw,25rem)] rounded-2xl ${isLightUi ? "border-[#c8ac62]/45 bg-white" : "border-[#f0e5a5]/35 bg-[#1a1d1a]"}`}>
          <DialogHeader>
            <DialogTitle className={`${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
              {isPurchaseSafetyStep ? "Kauf bestätigen" : "Belohnung freischalten"}
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
              {isPurchaseSafetyStep ? (
                <>
                  Möchtest du <span className="font-semibold">{purchaseConfirmOption?.label || "diese Belohnung"}</span> wirklich mit {" "}
                  <span className="font-semibold">{selectedCurrencyPrice} {selectedCurrencyLabel}</span> kaufen?
                </>
              ) : (
                <>
                  Möchtest du <span className="font-semibold">{purchaseConfirmOption?.label || "diese Belohnung"}</span> freischalten?
                </>
              )}
            </p>

            {purchaseDialogHasBothPrices ? (
              <div className={`rounded-lg border px-3 py-2 text-xs space-y-2 ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                <p className="font-medium text-[11px] uppercase tracking-wide opacity-70">Bezahlen mit:</p>
                <label className={`flex items-center justify-between gap-2 cursor-pointer rounded-md px-2 py-1.5 transition-colors ${effectivePurchaseCurrency === "sparks" ? (isLightUi ? "bg-amber-100/70 ring-1 ring-amber-300" : "bg-amber-900/30 ring-1 ring-amber-500/50") : ""}`}>
                  <span className="flex items-center gap-1.5">
                    <input type="radio" name="purchaseCurrency" value="sparks" checked={effectivePurchaseCurrency === "sparks"} onChange={() => setPurchaseCurrency("sparks")} className="accent-amber-500" />
                    <Sparkles className="w-3 h-3 opacity-80" /> {purchaseDialogSparkPrice} Funken
                  </span>
                  <span className={`font-semibold ${!canAffordDialogSparks ? (isLightUi ? "text-red-600" : "text-red-400") : ""}`}>
                    (Guthaben: {availableSparks})
                  </span>
                </label>
                <label className={`flex items-center justify-between gap-2 cursor-pointer rounded-md px-2 py-1.5 transition-colors ${effectivePurchaseCurrency === "amber" ? (isLightUi ? "bg-amber-100/70 ring-1 ring-amber-300" : "bg-amber-900/30 ring-1 ring-amber-500/50") : ""}`}>
                  <span className="flex items-center gap-1.5">
                    <input type="radio" name="purchaseCurrency" value="amber" checked={effectivePurchaseCurrency === "amber"} onChange={() => setPurchaseCurrency("amber")} className="accent-amber-500" />
                    <span className="text-[11px]">🔸</span> {purchaseDialogAmberPrice} Bernstein
                  </span>
                  <span className={`font-semibold ${!canAffordDialogAmber ? (isLightUi ? "text-red-600" : "text-red-400") : ""}`}>
                    (Guthaben: {availableAmber})
                  </span>
                </label>
              </div>
            ) : (
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
            )}

            {hasSelectedPurchaseCurrency && !canAffordPurchaseDialogOption && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/35 bg-red-900/25 text-red-200"}`}>
                {(effectivePurchaseCurrency || "sparks") === "sparks"
                  ? "Du hast nicht genug Funken für diesen Kauf."
                  : "Du hast nicht genug Bernstein für diesen Kauf."}
              </div>
            )}

            {isPurchaseSafetyStep && hasSelectedPurchaseCurrency && (
              <div className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${isLightUi ? "border-[#c8ac62]/35 bg-stone-50 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
                <p className="font-medium text-[11px] uppercase tracking-wide opacity-70">Kontostand nach dem Kauf</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 opacity-80" /> Funken</span>
                  <span className="font-semibold">{projectedSparksBalance}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1"><span className="text-[11px]">🔸</span> Bernstein</span>
                  <span className="font-semibold">{projectedAmberBalance}</span>
                </div>
              </div>
            )}

            {shopMessage && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/35 bg-amber-900/25 text-amber-200"}`}>
                {shopMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={purchaseAccessoryMutation.isPending}
                onClick={isPurchaseSafetyStep ? handleBackToPurchaseSelectionStep : handleClosePurchaseDialog}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${isLightUi ? "border-[#c8ac62]/45 bg-white/70 text-stone-700 hover:bg-white" : "border-[#f0e5a5]/25 bg-black/30 text-stone-200 hover:bg-black/50"}`}
              >
                {isPurchaseSafetyStep ? "Zurück" : "Abbrechen"}
              </button>
              <button
                type="button"
                disabled={purchaseAccessoryMutation.isPending || (isPurchaseSafetyStep ? !canAffordPurchaseDialogOption : (!hasSelectedPurchaseCurrency || !canAffordPurchaseDialogOption))}
                onClick={isPurchaseSafetyStep ? handleConfirmAccessoryPurchase : handleProceedToPurchaseSafetyStep}
                className={`h-9 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${isLightUi ? "border-[#c8ac62]/50 bg-[#f4e7bf] text-stone-800 hover:bg-[#f7edd0]" : "border-[#f0e5a5]/40 bg-[#4f4826] text-[#f7f0c1] hover:bg-[#5a512b]"}`}
              >
                {purchaseAccessoryMutation.isPending
                  ? "Kaufe..."
                  : (isPurchaseSafetyStep ? "Jetzt kaufen" : "Weiter")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

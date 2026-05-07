import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, RefreshCw, Image as ImageIcon, BadgeCheck, PaintBucket } from "lucide-react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { useUiTheme } from "@/lib/UiThemeContext";
import {
  getUnlockedProfileCustomizationCatalog,
  profileCustomizationCategoryComparator,
} from "@/lib/profileCustomizationOptions";

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
  const isActive = user?.selected_title === option.value;

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

  const catalog = useMemo(() => {
    return getUnlockedProfileCustomizationCatalog({
      achievements,
      userAchievements,
      rewards,
      userRewards,
      userDiscoveries,
    });
  }, [achievements, rewards, userAchievements, userDiscoveries, userRewards]);

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
    await updateCustomizationMutation.mutateAsync({ selected_title: option?.value || null });
  };

  const handleResetTitle = async () => {
    setShopMessage(null);
    await updateCustomizationMutation.mutateAsync({ selected_title: null });
  };

  const isAuthResolving = !resolvedAuthId;
  const isLoading = isAuthResolving || isDiscoveriesPending || isAchievementsPending || isUserAchievementsPending || isRewardsPending || isUserRewardsPending;
  const resolvedCurrentUser = currentUser || fallbackUser || (authId ? { id: authId } : null);
  const isMutationPending = updateCustomizationMutation.isPending;

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
          ) : (
            <div className="space-y-3">
              <div className={`rounded-[1.5rem] border px-3 py-3 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-[#f0e5a5]/20 bg-black/28"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>Aktiver Titel</div>
                    <div className={`mt-1 text-xs ${isLightUi ? "text-stone-500" : "text-stone-300/75"}`}>
                      Aktuell: {resolvedCurrentUser?.selected_title || resolvedCurrentUser?.title || "Pflanzen-Entdecker"}
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
    </section>
  );
}

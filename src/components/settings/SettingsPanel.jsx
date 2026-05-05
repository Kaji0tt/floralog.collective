import { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { updateCurrentUserProfile, getCurrentUser } from "@/api/userApi";
import { upsertUserProfile } from "@/api/authService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LogOut, Mail, Heart, FileText,
  Star, Image as ImageIcon, Edit2, CheckCircle, X,
  ChevronDown, ChevronUp, Lock, Sun,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LockedTooltip } from "@/components/ui/locked-tooltip";
import NotificationManager from "@/components/notifications/NotificationManager";
import LocationManager from "@/components/notifications/LocationManager";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useAuth } from "@/lib/AuthContext";

export default function SettingsPanel({ user, onUserUpdated }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { uiTheme, setUiTheme } = useUiTheme();
  const { logout } = useAuth();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.display_name || user?.full_name || "");
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    colors: false,
    presets: false,
    scans: false,
  });

  useEffect(() => {
    if (!isEditingName) {
      setEditedName(user?.display_name || user?.full_name || "");
    }
  }, [user?.display_name, user?.full_name, isEditingName]);

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ["userDiscoveries", user?.id],
    queryFn: () => Query.UserPlantDiscovery.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => Query.Achievement.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ["userAchievements", user?.id],
    queryFn: () => Query.UserAchievement.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const { data: allRewards = [] } = useQuery({
    queryKey: ["rewards"],
    queryFn: () => Query.Reward.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: userRewards = [] } = useQuery({
    queryKey: ["userRewards", user?.id],
    queryFn: () => Query.UserReward.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const { data: quests = [] } = useQuery({
    queryKey: ["quests"],
    queryFn: () => Query.Quest.list("quest_number"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: userWeeklyQuests = [] } = useQuery({
    queryKey: ["userWeeklyQuests", user?.id],
    queryFn: () => Query.UserWeeklyQuest.filter({ auth_id: user?.id }),
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const scannedPlantsCount = userDiscoveries.length;
  const uniqueSpeciesCount = new Set(userDiscoveries.map((d) => d.plant_id)).size;
  const weeklyQuestParticipations = new Set(userWeeklyQuests.map((q) => q.active_week)).size;

  const updateUserMutation = useMutation({
    mutationFn: (data) => updateCurrentUserProfile(data),
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const freshUser = await getCurrentUser();
      onUserUpdated?.(freshUser);
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      await updatePublicProfile(freshUser);
    },
    onError: (error) => {
      console.error("Fehler beim Update:", error);
      alert(`Fehler beim Speichern: ${error.message}`);
      setIsEditingName(false);
    },
  });

  const updateUiThemeMutation = useMutation({
    mutationFn: (theme) => upsertUserProfile(user?.id, { ui_theme: theme }),
  });

  const updatePublicProfile = async (userData) => {
    try {
      await upsertUserProfile(userData.id, {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
        title: userData.title,
        selected_title: userData.selected_title,
        background_image_url: userData.background_image_url,
        background_color: userData.background_color,
      });
    } catch (error) {
      console.error("Fehler beim PublicProfile Update:", error);
    }
  };

  const getAverageColor = (imageUrl) =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          canvas.width = 50;
          canvas.height = 50;
          ctx.drawImage(img, 0, 0, 50, 50);
          const d = ctx.getImageData(0, 0, 50, 50).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          for (let i = 0; i < d.length; i += 16) {
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            n += 1;
          }
          resolve(`rgb(${Math.floor(r / n)}, ${Math.floor(g / n)}, ${Math.floor(b / n)})`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      alert("Bitte gib einen Namen ein.");
      return;
    }
    const current = user?.display_name || user?.full_name;
    if (trimmed === current) {
      setIsEditingName(false);
      return;
    }
    await updateUserMutation.mutateAsync({ display_name: trimmed });
  };

  const handleSetBackground = async (imageUrl, precomputedColor = null) => {
    const color = precomputedColor || (await getAverageColor(imageUrl));
    await updateUserMutation.mutateAsync({ background_image_url: imageUrl, background_color: color });
    setShowBackgroundSelector(false);
    localStorage.setItem("hasChangedBackground", "true");
  };

  const handleRemoveBackground = async () => {
    await updateUserMutation.mutateAsync({ background_image_url: null });
    setShowBackgroundSelector(false);
  };

  const handleSetColor = async (color) => {
    await updateUserMutation.mutateAsync({ background_image_url: null, background_color: color });
    setShowBackgroundSelector(false);
    localStorage.setItem("hasChangedBackground", "true");
  };

  const handleRemoveColor = async () => {
    await updateUserMutation.mutateAsync({ background_color: null });
    setShowBackgroundSelector(false);
  };

  const getDisplayName = () => user?.display_name || user?.full_name || "Spieler";

  const achievementTitleOptions = userAchievements
    .map((ua) => achievements.find((a) => a.id === ua.achievement_id)?.title_reward)
    .filter(Boolean);

  const rewardTitleOptions = userRewards
    .map((ur) => {
      const reward = allRewards.find((r) => r.id === ur.reward_id);
      if (!reward || reward.type !== "title") return null;
      const value = reward.value || reward.display_name;
      const label = reward.display_name || reward.value;
      if (!value) return null;
      return { value, label };
    })
    .filter(Boolean);

  const titleMap = new Map();
  achievementTitleOptions.forEach((t) => titleMap.set(t, { value: t, label: t }));
  rewardTitleOptions.forEach((o) => {
    if (!titleMap.has(o.value)) titleMap.set(o.value, o);
  });
  const titleOptions = Array.from(titleMap.values());

  const colorRows = [
    {
      threshold: 5,
      colors: ["rgb(199, 209, 163)", "rgb(196, 178, 143)", "rgb(143, 196, 178)", "rgb(196, 143, 143)"],
      label: "ab 5 Scans",
    },
    {
      threshold: 10,
      colors: ["rgb(176, 72, 72)", "rgb(176, 159, 72)", "rgb(115, 158, 63)", "rgb(227, 197, 84)"],
      label: "ab 10 Scans",
    },
    {
      threshold: 20,
      colors: ["rgb(97, 36, 31)", "rgb(31, 92, 97)", "rgb(74, 55, 21)", "rgb(30, 54, 8)"],
      label: "ab 20 Scans",
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Dialog open={showBackgroundSelector} onOpenChange={setShowBackgroundSelector}>
        <DialogContent className={`max-w-4xl max-h-[80vh] overflow-y-auto border ${
          uiTheme === 'light'
            ? 'bg-white text-stone-800 border-[#c8ac62]/40'
            : 'bg-[#121b16] border-[#f0e5a5]/35 text-stone-100'
        }`}>
          <DialogHeader>
            <DialogTitle className={uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}>Hintergrund auswaehlen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <button
              className={`w-full py-2 text-sm border rounded-lg ${
                uiTheme === 'light'
                  ? 'border-[#c8ac62]/30 text-stone-700 hover:bg-stone-100/50'
                  : 'border-[#f0e5a5]/30 text-stone-200 hover:bg-white/5'
              }`}
              onClick={() => {
                handleRemoveBackground();
                handleRemoveColor();
              }}
            >
              Hintergrund entfernen
            </button>

            <div>
              <button
                onClick={() => setCollapsedSections((p) => ({ ...p, colors: !p.colors }))}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors mb-3 ${
                  uiTheme === 'light'
                    ? 'bg-stone-100/30 border-[#c8ac62]/20 hover:bg-stone-100/50'
                    : 'bg-black/25 border-[#f0e5a5]/20 hover:bg-black/35'
                }`}
              >
                <h3 className={`text-sm font-semibold ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Einfarbiger Hintergrund</h3>
                {collapsedSections.colors ? (
                  <ChevronDown className={`w-5 h-5 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-300'}`} />
                ) : (
                  <ChevronUp className={`w-5 h-5 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-300'}`} />
                )}
              </button>
              {!collapsedSections.colors && (
                <div className="space-y-4">
                  {colorRows.map((row) => {
                    const isUnlocked = scannedPlantsCount >= row.threshold;
                    return (
                      <div key={row.threshold}>
                        <p className="text-xs text-stone-400 mb-2">Freischaltung {row.label}</p>
                        <div className="grid grid-cols-4 gap-3">
                          {row.colors.map((color) => (
                            <LockedTooltip
                              key={color}
                              content={!isUnlocked && (
                                <p>Scanne {row.threshold} Pflanzen ({scannedPlantsCount}/{row.threshold})</p>
                              )}
                            >
                              <button
                                onClick={() => isUnlocked && handleSetColor(color)}
                                className={`aspect-square rounded-lg border-2 relative ${
                                  isUnlocked
                                    ? "border-stone-300/40 hover:border-[#f0e5a5]/60 hover:scale-110"
                                    : "border-stone-500 cursor-not-allowed"
                                } transition-all`}
                                style={{ backgroundColor: color }}
                              >
                                {!isUnlocked && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/35">
                                    <Lock className="w-8 h-8 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                                  </div>
                                )}
                              </button>
                            </LockedTooltip>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {allRewards.filter((r) => r.type === "background").length > 0 && (
              <div>
                <button
                  onClick={() => setCollapsedSections((p) => ({ ...p, presets: !p.presets }))}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors mb-3 ${
                    uiTheme === 'light'
                      ? 'bg-stone-100/30 border-[#c8ac62]/20 hover:bg-stone-100/50'
                      : 'bg-black/25 border-[#f0e5a5]/20 hover:bg-black/35'
                  }`}
                >
                  <h3 className={`text-sm font-semibold ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Vorgefertigte Hintergruende</h3>
                  {collapsedSections.presets ? (
                    <ChevronDown className={`w-5 h-5 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-300'}`} />
                  ) : (
                    <ChevronUp className={`w-5 h-5 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-300'}`} />
                  )}
                </button>
                {!collapsedSections.presets && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {allRewards
                      .filter((r) => r.type === "background")
                      .map((reward) => {
                        const isUnlocked = userRewards.some((ur) => ur.reward_id === reward.id);
                        let tooltipText = "";
                        if (reward.requires_donor) tooltipText = "Nur fuer Unterstuetzer freischaltbar.";
                        else if (reward.requires_referrals) tooltipText = `Werbe ${reward.requires_referrals} Freund${reward.requires_referrals > 1 ? "e" : ""}.`;
                        else if (reward.requires_rare_plants) tooltipText = `Entdecke ${reward.requires_rare_plants} seltene Pflanze${reward.requires_rare_plants > 1 ? "n" : ""}.`;
                        else if (reward.requires_weekly_quests) tooltipText = `Nimm an ${reward.requires_weekly_quests} Wochenquests teil (${weeklyQuestParticipations}/${reward.requires_weekly_quests}).`;
                        else if (reward.requires_quest) {
                          const q = quests.find((quest) => quest.id === reward.requires_quest);
                          tooltipText = q ? `Loese Quest \"${q.title}\" ein.` : "Schliesse eine Quest ab.";
                        }

                        return (
                          <LockedTooltip
                            key={reward.id}
                            content={!isUnlocked && <p>{tooltipText || "Noch nicht freigeschaltet"}</p>}
                          >
                            <button
                              onClick={() => isUnlocked && handleSetBackground(reward.value, reward.color)}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                                isUnlocked
                                  ? "border-[#f0e5a5]/45 hover:border-[#f0e5a5]/80"
                                  : "border-stone-500 cursor-not-allowed"
                              } transition-colors group`}
                            >
                              <img src={reward.value} alt={reward.display_name} className="w-full h-full object-cover" />
                              <div className={`absolute inset-0 ${isUnlocked ? "group-hover:bg-black/20" : "bg-black/45"} transition-colors`} />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-stone-100 text-xs p-1 text-center">
                                {reward.display_name}
                              </div>
                              {!isUnlocked && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Lock className="w-8 h-8 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                                </div>
                              )}
                            </button>
                          </LockedTooltip>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {uniqueSpeciesCount >= 50 && (
              <div>
                <button
                  onClick={() => setCollapsedSections((p) => ({ ...p, scans: !p.scans }))}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors mb-3 ${
                    uiTheme === 'light'
                      ? 'bg-stone-100/30 border-[#c8ac62]/20 hover:bg-stone-100/50'
                      : 'bg-black/25 border-[#f0e5a5]/20 hover:bg-black/35'
                  }`}
                >
                  <h3 className={`text-sm font-semibold ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Pflanzenbild als Hintergrund</h3>
                  {collapsedSections.scans ? (
                    <ChevronDown className={`w-5 h-5 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-300'}`} />
                  ) : (
                    <ChevronUp className={`w-5 h-5 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-300'}`} />
                  )}
                </button>
                {!collapsedSections.scans && (
                  <>
                    <p className="text-xs text-stone-400 mb-3">
                      Freigeschaltet: Du hast {uniqueSpeciesCount} verschiedene Arten entdeckt.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {userDiscoveries
                        .filter((d) => d.image_url)
                        .map((discovery) => (
                          <button
                            key={discovery.id}
                            onClick={() => handleSetBackground(discovery.image_url)}
                            className="relative aspect-square rounded-lg overflow-hidden border-2 border-stone-300/40 hover:border-[#f0e5a5]/80 transition-colors group"
                          >
                            <img src={discovery.image_url} alt="Scan" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className={`flex-1 min-h-0 overflow-y-auto rounded-3xl border backdrop-blur-sm ${
        uiTheme === 'light'
          ? 'border-[#c0a860]/30 bg-white/40'
          : 'border-[#f0e5a5]/25 bg-black/25'
      }`}>
        <div className="px-3 py-3 space-y-2">
          <p className={`text-[10px] uppercase tracking-widest px-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Profil</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className={`h-7 text-sm px-2 ${
                      uiTheme === 'light'
                        ? 'bg-stone-100/50 border-[#c8ac62]/30 text-stone-800 placeholder:text-stone-500'
                        : 'bg-black/30 border-[#f0e5a5]/30 text-stone-100 placeholder:text-stone-400'
                    }`}
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                        setEditedName(user?.display_name || user?.full_name || "");
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={updateUserMutation.isPending}
                    className="w-7 h-7 rounded-lg bg-green-600/70 flex items-center justify-center flex-shrink-0"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setEditedName(user?.display_name || user?.full_name || "");
                    }}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-stone-300" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold text-stone-100 truncate">{getDisplayName()}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${uiTheme === 'light' ? 'hover:bg-stone-200/30' : 'hover:bg-white/10'}`}
                    aria-label="Name bearbeiten"
                  >
                    <Edit2 className={`w-3 h-3 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`} />
                  </button>
                </div>
              )}
              <p className={`text-xs truncate leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>
                {user?.selected_title || user?.title || "Pflanzen-Entdecker"}
              </p>
            </div>
          </div>

          <div className={`px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <ImageIcon className={`w-3.5 h-3.5 ${uiTheme === 'light' ? 'text-amber-700/60' : 'text-[#f0e5a5]/70'}`} />
              <p className={`text-xs ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Hintergrund</p>
            </div>
            <button
              onClick={() => setShowBackgroundSelector(true)}
              className={`w-full rounded-lg border p-2.5 flex items-center justify-between transition-colors ${
                uiTheme === 'light'
                  ? 'border-[#c8ac62]/25 bg-stone-100/30 hover:bg-stone-100/50'
                  : 'border-[#f0e5a5]/25 bg-black/20 hover:bg-black/35'
              }`}
            >
              <span className={`text-sm text-left ${uiTheme === 'light' ? 'text-stone-700' : 'text-stone-200'}`}>Neuen Hintergrund waehlen</span>
              <div className={`h-8 w-14 rounded-md overflow-hidden border ${uiTheme === 'light' ? 'border-[#c8ac62]/30 bg-stone-200/40' : 'border-[#f0e5a5]/30 bg-stone-800/40'}`}>
                {user?.background_image_url ? (
                  <img src={user.background_image_url} alt="Aktueller Hintergrund" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: user?.background_color || "linear-gradient(120deg, #374151, #111827)" }} />
                )}
              </div>
            </button>
          </div>

          <div className={`px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Star className={`w-3.5 h-3.5 ${uiTheme === 'light' ? 'text-amber-700/50' : 'text-[#f0e5a5]/60'}`} />
              <p className={`text-xs ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Aktiver Titel</p>
            </div>
            <Select
              value={user?.selected_title || "default"}
              onValueChange={(v) => updateUserMutation.mutate({ selected_title: v === "default" ? null : v })}
              disabled={updateUserMutation.isPending}
            >
              <SelectTrigger className={`h-8 text-sm ${uiTheme === 'light' ? 'bg-stone-100/40 border-[#c8ac62]/25 text-stone-800' : 'bg-black/30 border-[#f0e5a5]/25 text-stone-100'}`}>
                <SelectValue>
                  <span>{user?.selected_title || "Pflanzen-Entdecker"}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Pflanzen-Entdecker</SelectItem>
                {titleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
                {titleOptions.length === 0 && (
                  <div className="p-3 text-xs text-center text-stone-500">Noch keine Titel freigeschaltet</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Darstellung</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <Sun className={`w-4 h-4 flex-shrink-0 ${uiTheme === 'light' ? 'text-amber-700/70' : 'text-[#f0e5a5]/70'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Helle Anzeige</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Invertiert dunkle und goldene Akzente in ein helles Interface.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={uiTheme === "light"}
                onChange={(e) => {
                  const newTheme = e.target.checked ? "light" : "dark";
                  setUiTheme(newTheme);
                  updateUiThemeMutation.mutate(newTheme);
                }}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Pflanzen-Pulsieren</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Glüheffekt hinter dem FloraLog-Logo. Intensität richtet sich nach dem Pflanzenstatus.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.plant_pulse_enabled !== false}
                onChange={(e) => updateUserMutation.mutate({ plant_pulse_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Datenschutz</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Weekly Tracking</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Scans in woechentlichen Challenges teilen</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.weekly_tracking !== false}
                onChange={(e) => updateUserMutation.mutate({ weekly_tracking: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Lokales Tracking</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Scans im lokalen Tab zeigen (20 km)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.local_tracking !== false}
                onChange={(e) => updateUserMutation.mutate({ local_tracking: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Benachrichtigungen und Standort</p>

          <div className={`rounded-xl border overflow-hidden p-2 ${uiTheme === 'light' ? 'bg-stone-100/20 border-[#c8ac62]/15' : 'bg-white/5 border-[#f0e5a5]/10'}`}>
            <NotificationManager user={user} showInProfile />
          </div>

          <div className={`rounded-xl border overflow-hidden p-2 ${uiTheme === 'light' ? 'bg-stone-100/20 border-[#c8ac62]/15' : 'bg-white/5 border-[#f0e5a5]/10'}`}>
            <LocationManager showInProfile />
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Konto</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <Mail className={`w-4 h-4 flex-shrink-0 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`} />
            <div className="min-w-0">
              <p className={`text-[11px] ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>E-Mail</p>
              <p className={`text-sm truncate ${uiTheme === 'light' ? 'text-stone-700' : 'text-stone-200'}`}>{user?.email}</p>
            </div>
          </div>

          <button
            onClick={() => navigate(createPageUrl("Donate"))}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors ${
              uiTheme === 'light'
                ? 'border-green-400/40 bg-green-100/40 text-green-800 hover:bg-green-100/55'
                : 'border-green-500/30 bg-green-900/20 text-green-300 hover:bg-green-900/35'
            }`}
          >
            <Heart className="w-4 h-4" />
            Spenden
          </button>

          <button
            onClick={() => logout()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors mb-1 ${
              uiTheme === 'light'
                ? 'border-red-300/40 bg-red-100/40 text-red-800 hover:bg-red-100/55'
                : 'border-red-400/30 bg-red-900/20 text-red-200 hover:bg-red-900/35'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
          <button
            onClick={() => navigate(createPageUrl("Impressum"))}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors mb-1 ${
              uiTheme === 'light'
                ? 'border-blue-400/40 bg-blue-100/40 text-blue-800 hover:bg-blue-100/55'
                : 'border-blue-500/30 bg-blue-900/20 text-blue-300 hover:bg-blue-900/35'
            }`}
          >
            <FileText className="w-4 h-4" />
            Impressum
          </button>
        </div>
      </div>
    </div>
  );
}

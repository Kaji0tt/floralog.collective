import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/api/supabaseClient";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { getCurrentWeeklyQuest, getWeekNumber } from "@/components/quests/QuestRotationHelper";

// ─── Rarity helpers (same mapping as Home.jsx) ───────────────────────────────

const normalizeRarityText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

const rarityScoreFromLabel = (rarity) => {
  const n = normalizeRarityText(rarity);
  if (!n) return 0;
  if (n.includes("extremselten") || n.includes("legend") || n.includes("mythisch")) return 7;
  if (n.includes("sehrselten") || n.includes("episch")) return 6;
  if (n.includes("selten")) return 5;
  if (n.includes("gelegentlich") || n.includes("ungewohnlich")) return 3;
  if (n.includes("haufig") || n.includes("haeufig") || n.includes("common")) return 1;
  return 2;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

// Returns the ISO timestamp for the Monday of the week offset by `offsetWeeks`
// (0 = current week, -1 = last week, etc.)
const getWeekStartIsoForOffset = (offsetWeeks = 0) => {
  const now = new Date();
  const day = now.getUTCDay();
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack + offsetWeeks * 7)
  );
  return monday.toISOString();
};

const formatDateRange = (weekStartIso) => {
  const start = new Date(weekStartIso);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d) =>
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchWeeklyStats(weekStartIso, excludeBackfillDate = null) {
  // Compute the exclusive end of the week (Sunday 23:59:59 UTC → next Monday 00:00)
  const weekEndIso = new Date(new Date(weekStartIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const leaderboardParams = { p_limit: 200, p_week_start: weekStartIso };
  if (excludeBackfillDate) leaderboardParams.p_exclude_quest_backfill_date = excludeBackfillDate;

  // Discoveries + new profiles + leaderboard + LogoAsset catalog + WeeklyQuests in parallel
  const [discoveryRes, newProfileRes, leaderboardRes, logoAssetRes, weeklyQuestRes] = await Promise.all([
    supabase
      .from("UserPlantDiscovery")
      .select("id, plant_id, auth_id, image_url")
      .gte("discovered_date", weekStartIso)
      .lt("discovered_date", weekEndIso),
    supabase
      .from("PublicProfile")
      .select("id")
      .gte("created_date", weekStartIso)
      .lt("created_date", weekEndIso),
    supabase.rpc("get_weekly_seed_leaderboard", leaderboardParams),
    supabase.from("LogoAsset").select("*"),
    supabase.from("WeeklyQuest").select("id, title, target_species_name, target_genus_name, quest_number, required_discoveries"),
  ]);

  if (discoveryRes.error) throw new Error(`Discoveries: ${discoveryRes.error.message}`);

  const discoveries = discoveryRes.data ?? [];
  const newProfiles = newProfileRes.data ?? [];
  const fullLeaderboard = Array.isArray(leaderboardRes.data) ? leaderboardRes.data : [];

  const logoAssetCatalog = Array.isArray(logoAssetRes.data) ? logoAssetRes.data : [];

  // Platform-wide seeds earned this week (sum of all players via SECURITY DEFINER RPC)
  const seedsEarned = fullLeaderboard.reduce((s, e) => s + Number(e.weekly_seed_total ?? 0), 0);
  const leaderboard = fullLeaderboard.slice(0, 5);

  const uniqueScanners = new Set(discoveries.map((d) => d.auth_id).filter(Boolean)).size;

  // Likes for this week's scans – query by discovery_id to avoid null created_date issues
  const discoveryIds = discoveries.map((d) => d.id).filter(Boolean);
  let likes = [];
  const LIKE_CHUNK = 500;
  for (let i = 0; i < discoveryIds.length; i += LIKE_CHUNK) {
    const { data: chunk } = await supabase
      .from("ScanLike")
      .select("discovery_id")
      .in("discovery_id", discoveryIds.slice(i, i + LIKE_CHUNK));
    if (chunk) likes.push(...chunk);
  }
  const totalLikes = likes.length;

  // Rarity + species lookup (extended plant map)
  const plantIds = [...new Set(discoveries.map((d) => d.plant_id).filter(Boolean))];
  const plantMap = {}; // id → { rarity, species_name, genus_id }
  const CHUNK = 500;
  for (let i = 0; i < plantIds.length; i += CHUNK) {
    const { data: plants } = await supabase
      .from("Plant")
      .select("id, rarity, species_name, genus_category, genus_number")
      .in("id", plantIds.slice(i, i + CHUNK));
    for (const p of plants ?? []) plantMap[p.id] = p;
  }
  const rareScans = discoveries.filter((d) => rarityScoreFromLabel(plantMap[d.plant_id]?.rarity) >= 4).length;
  const distinctSpecies = new Set(discoveries.map((d) => d.plant_id).filter(Boolean)).size;

  // Most scanned plant this week
  const plantCountMap = {};
  for (const d of discoveries) {
    if (d.plant_id) plantCountMap[d.plant_id] = (plantCountMap[d.plant_id] || 0) + 1;
  }
  const topPlantEntry = Object.entries(plantCountMap).sort(([, a], [, b]) => b - a)[0];
  const topPlantId = topPlantEntry?.[0] ?? null;
  const topPlantCount = topPlantEntry?.[1] ?? 0;
  const topPlantName = topPlantId ? (plantMap[topPlantId]?.species_name ?? null) : null;

  // Quest for the selected week (rotation based on ISO week number of that week)
  const weekDate = new Date(weekStartIso);
  const weekString = getWeekNumber(weekDate);
  const weekNumber = parseInt(weekString.split("-W")[1], 10);
  const sortedQuests = [...(weeklyQuestRes.data ?? [])].sort((a, b) => a.quest_number - b.quest_number);
  const currentWeeklyQuest = sortedQuests.length > 0 ? sortedQuests[(weekNumber - 1) % sortedQuests.length] : null;
  let questFinds = 0;
  let questPlantLabel = null;
  let questMatchingDiscs = [];
  if (currentWeeklyQuest?.target_species_name) {
    questPlantLabel = currentWeeklyQuest.target_species_name;
    questMatchingDiscs = discoveries.filter(
      (d) => plantMap[d.plant_id]?.species_name === currentWeeklyQuest.target_species_name
    );
    questFinds = questMatchingDiscs.length;
  } else if (currentWeeklyQuest?.target_genus_name) {
    questPlantLabel = currentWeeklyQuest.target_genus_name;
    const { data: genusRow } = await supabase
      .from("PlantGenus")
      .select("category, category_dex_number")
      .eq("genus_name", currentWeeklyQuest.target_genus_name)
      .maybeSingle();
    if (genusRow?.category != null && genusRow?.category_dex_number != null) {
      questMatchingDiscs = discoveries.filter((d) => {
        const p = plantMap[d.plant_id];
        return p?.genus_category === genusRow.category &&
          Number(p?.genus_number) === Number(genusRow.category_dex_number);
      });
      questFinds = questMatchingDiscs.length;
    }
  }

  // Players who found the quest plant
  const questDiscovererAuthIds = [...new Set(questMatchingDiscs.map((d) => d.auth_id).filter(Boolean))];
  let questDiscoverers = [];
  if (questDiscovererAuthIds.length > 0) {
    const { data: qProfiles } = await supabase
      .from("PublicProfile")
      .select("auth_id, display_name, full_name")
      .in("auth_id", questDiscovererAuthIds);
    questDiscoverers = (qProfiles ?? []).map(
      (p) => p.display_name || p.full_name || "—"
    );
  }

  // Most liked scan this week
  const likeCounts = {};
  for (const like of likes) {
    if (like.discovery_id) likeCounts[like.discovery_id] = (likeCounts[like.discovery_id] || 0) + 1;
  }
  const topDiscoveryId = Object.entries(likeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  let topScan = null;
  if (topDiscoveryId) {
    const { data: disc } = await supabase
      .from("UserPlantDiscovery")
      .select("id, plant_id, image_url, auth_id")
      .eq("id", topDiscoveryId)
      .maybeSingle();
    if (disc) {
      const [plantRes, profRes] = await Promise.all([
        disc.plant_id
          ? supabase.from("Plant").select("id, species_name, rarity").eq("id", disc.plant_id).maybeSingle()
          : { data: null },
        disc.auth_id
          ? supabase
              .from("PublicProfile")
              .select("auth_id, display_name, full_name, bot_name, selected_face_asset, selected_plant_asset, selected_border_asset, selected_border_color")
              .eq("auth_id", disc.auth_id)
              .maybeSingle()
          : { data: null },
      ]);
      topScan = {
        ...disc,
        likeCount: likeCounts[topDiscoveryId] ?? 0,
        plant: plantRes.data,
        profile: profRes.data,
      };
    }
  }

  // Logo assets for leaderboard top 5
  const leaderboardAuthIds = leaderboard.map((e) => e.auth_id).filter(Boolean);
  const profileByAuthId = {};
  if (leaderboardAuthIds.length > 0) {
    const { data: lbProfiles } = await supabase
      .from("PublicProfile")
      .select("auth_id, bot_name, selected_face_asset, selected_plant_asset, selected_border_asset, selected_border_color")
      .in("auth_id", leaderboardAuthIds);
    for (const p of lbProfiles ?? []) profileByAuthId[String(p.auth_id)] = p;
  }
  const leaderboardWithProfiles = leaderboard.map((e) => ({
    ...e,
    profile: profileByAuthId[String(e.auth_id)] ?? null,
  }));

  return {
    seedsEarned,
    uniqueScanners,
    newPlayers: newProfiles.length,
    totalScans: discoveries.length,
    distinctSpecies,
    rareScans,
    totalLikes,
    topPlantName,
    topPlantCount,
    questPlantLabel,
    questFinds,
    questDiscoverers,
    leaderboard: leaderboardWithProfiles,
    logoAssetCatalog,
    topScan,
  };
}

// ─── Slide shell ──────────────────────────────────────────────────────────────

const SLIDE_BG = "linear-gradient(160deg, #fdf6ec 0%, #fefaf4 50%, #fdf6ec 100%)";
const SLIDE_BORDER = "1px solid rgba(180,150,100,0.22)";

function SlideShell({ children, style = {} }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl flex flex-col"
      style={{
        aspectRatio: "4/5",
        width: "100%",
        maxWidth: 380,
        background: SLIDE_BG,
        border: SLIDE_BORDER,
        boxShadow: "0 0 40px rgba(180,150,100,0.08)",
        ...style,
      }}
    >
      {/* ambient glow top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(180,210,160,0.18) 0%, transparent 70%)" }}
      />
      {children}
    </div>
  );
}

function SlideHeader({ label }) {
  return (
    <div className="flex items-center gap-1.5 z-10">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-[10px] font-semibold tracking-widest uppercase text-emerald-600/80">FloraLog</span>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-[10px] font-semibold tracking-widest uppercase text-stone-400 ml-1">{label}</span>
    </div>
  );
}

function SlideFooter({ weekRange }) {
  return (
    <div className="flex flex-col items-center gap-1 z-10">
      <span className="text-[10px] text-stone-400">{weekRange} · floralog.de</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent z-10" />;
}

// ─── Slide 1 – Community / Samen ─────────────────────────────────────────────

function Slide1({ stats, weekRange }) {
  return (
    <SlideShell>
      <div className="flex flex-col flex-1 px-6 py-6 gap-5 justify-between z-10">
        <div className="flex flex-col gap-2">
          <p className="text-stone-400 text-xs font-medium uppercase tracking-widest">Samen verdient</p>
          <div className="flex items-end gap-2">
            <span className="text-[64px] font-black leading-none tabular-nums text-emerald-700">
              {Number(stats.seedsEarned).toLocaleString("de-DE")}
            </span>
            <span className="text-2xl mb-2">🌱</span>
          </div>
        </div>

        <Divider />

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-stone-100 border border-stone-200">
            <span className="text-sm text-stone-500">Aktive SpielerInnen</span>
            <span className="text-2xl font-black text-stone-800 tabular-nums">
              {Number(stats.uniqueScanners).toLocaleString("de-DE")}
            </span>
          </div>
          <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-emerald-50 border border-emerald-200">
            <span className="text-sm text-emerald-700/80">Neue SpielerInnen</span>
            <span className="text-2xl font-black text-emerald-700 tabular-nums">
              {Number(stats.newPlayers).toLocaleString("de-DE")}
            </span>
          </div>
        </div>

        <Divider />
        <SlideFooter weekRange={weekRange} />
      </div>
    </SlideShell>
  );
}

// ─── Slide 2 – Rangliste ──────────────────────────────────────────────────────

const RANK_STYLES = [
  { color: "#92400e", label: "1.", bg: "rgba(253,230,138,0.45)", border: "rgba(245,158,11,0.4)" },
  { color: "#475569", label: "2.", bg: "rgba(203,213,225,0.35)", border: "rgba(148,163,184,0.4)" },
  { color: "#7c3e12", label: "3.", bg: "rgba(253,186,116,0.3)", border: "rgba(249,115,22,0.3)" },
  { color: "#78716c", label: "4.", bg: "rgba(231,229,228,0.5)", border: "rgba(168,162,158,0.35)" },
  { color: "#78716c", label: "5.", bg: "rgba(231,229,228,0.5)", border: "rgba(168,162,158,0.35)" },
];

function LeaderboardRow({ entry, rank, logoAssetCatalog }) {
  const rs = RANK_STYLES[rank] ?? RANK_STYLES[4];
  const profile = entry.profile ?? {};
  const logoAssets = resolveEquippedLogoAssetsWithCatalog(profile, logoAssetCatalog);
  const displayName = entry.display_name || entry.full_name || entry.user_email?.split("@")[0] || "—";

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{ background: rs.bg, border: `1px solid ${rs.border}` }}
    >
      <span className="text-sm font-black w-5 shrink-0 tabular-nums" style={{ color: rs.color }}>
        {rs.label}
      </span>
      <CustomLogoAvatar
        logoAssets={logoAssets}
        className="w-9 h-9 shrink-0 rounded-full"
        fallbackText={displayName.charAt(0).toUpperCase()}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-semibold text-stone-700 truncate leading-tight">{displayName}</span>
        {profile.bot_name && (
          <span className="text-[10px] text-stone-400 truncate leading-tight">{profile.bot_name}</span>
        )}
      </div>
      <span className="text-sm font-black tabular-nums shrink-0" style={{ color: rs.color }}>
        {Number(entry.weekly_seed_total ?? 0).toLocaleString("de-DE")}
        <span className="text-xs font-normal text-stone-500 ml-0.5">🌱</span>
      </span>
    </div>
  );
}

function Slide2({ stats, weekRange }) {
  return (
    <SlideShell>
      <div className="flex flex-col flex-1 px-6 py-6 gap-4 justify-between z-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-black text-stone-800 tracking-tight">Top 5 Samen</h2>
          <p className="text-xs text-stone-400">Meiste Samen gesammelt diese Woche</p>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          {stats.leaderboard.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-8">Noch keine Daten</p>
          ) : (
            stats.leaderboard.slice(0, 5).map((entry, i) => (
              <LeaderboardRow key={String(entry.auth_id ?? i)} entry={entry} rank={i} logoAssetCatalog={stats.logoAssetCatalog} />
            ))
          )}
        </div>

        <Divider />
        <SlideFooter weekRange={weekRange} />
      </div>
    </SlideShell>
  );
}

// ─── Slide 3 – Scan-Statistiken ───────────────────────────────────────────────

function Slide3({ stats, weekRange }) {
  return (
    <SlideShell>
      <div className="flex flex-col flex-1 px-6 py-6 gap-4 justify-between z-10">
        <div className="flex flex-col gap-1">
          <p className="text-stone-400 text-xs font-medium uppercase tracking-widest">Scans gesamt</p>
          <span className="text-[58px] font-black leading-none tabular-nums text-stone-800">
            {Number(stats.totalScans).toLocaleString("de-DE")}
          </span>
          {stats.distinctSpecies > 0 && (
            <span className="text-xs text-stone-400">
              {Number(stats.distinctSpecies).toLocaleString("de-DE")} verschiedene Arten
            </span>
          )}
        </div>

        <Divider />

        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center rounded-xl px-4 py-2.5 bg-amber-50 border border-amber-200">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-700">Selten oder seltener</span>
              <span className="text-[10px] text-stone-400">Seltenheit 4★ und drüber</span>
            </div>
            <span className="text-xl font-black text-amber-700 tabular-nums">
              {Number(stats.rareScans).toLocaleString("de-DE")}
            </span>
          </div>

          {stats.topPlantName && (
            <div className="flex justify-between items-center rounded-xl px-4 py-2.5 bg-emerald-50 border border-emerald-200">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-sm font-semibold text-emerald-700">Meistgescannte Art</span>
                <span className="text-[11px] text-stone-500 italic truncate">{stats.topPlantName}</span>
              </div>
              <span className="text-xl font-black text-emerald-700 tabular-nums shrink-0">
                {stats.topPlantCount}×
              </span>
            </div>
          )}

          {stats.questPlantLabel && (
            <div className="flex flex-col rounded-xl px-4 py-2.5 bg-violet-50 border border-violet-200 gap-1.5">
              <div className="flex justify-between items-center">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-sm font-semibold text-violet-700">Pflanze der Woche</span>
                  <span className="text-[11px] text-stone-500 italic truncate">{stats.questPlantLabel}</span>
                </div>
                <span className="text-xl font-black text-violet-700 tabular-nums shrink-0">
                  {stats.questFinds}×
                </span>
              </div>
              {stats.questDiscoverers?.length > 0 && (
                <p className="text-[10px] text-violet-600/80 leading-snug">
                  {stats.questDiscoverers.slice(0, 5).join(" · ")}
                  {stats.questDiscoverers.length > 5 && ` +${stats.questDiscoverers.length - 5}`}
                </p>
              )}
            </div>
          )}
        </div>

        <Divider />
        <SlideFooter weekRange={weekRange} />
      </div>
    </SlideShell>
  );
}

// ─── Slide 4 – Scan der Woche ─────────────────────────────────────────────────

function Slide4({ stats, weekRange }) {
  const { topScan } = stats;
  const profile = topScan?.profile ?? {};
  const logoAssets = topScan ? resolveEquippedLogoAssetsWithCatalog(profile, stats.logoAssetCatalog) : null;
  const displayName = profile.display_name || profile.full_name || "—";
  const speciesName = topScan?.plant?.species_name || "Unbekannte Art";

  return (
    <SlideShell>
      {/* Background image */}
      {topScan?.image_url && (
        <>
          <img
            src={topScan.image_url}
            alt={speciesName}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(253,246,236,0.92) 20%, rgba(253,246,236,0.25) 55%, transparent 100%)" }}
          />
        </>
      )}

      <div className="flex flex-col flex-1 px-6 py-6 gap-4 justify-between z-10">
        {/* Top badge */}
          <div className="flex items-center justify-end">
          <div className="flex items-center gap-1 rounded-full px-2.5 py-1 bg-pink-100 border border-pink-200">
            <span className="text-xs text-pink-600 font-semibold">
              {topScan ? `${topScan.likeCount} ♥` : "–"}
            </span>
          </div>
        </div>

        {/* Spacer that acts as the image area */}
        <div className="flex-1" />

        {/* Bottom info */}
        {topScan ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-pink-600 font-bold uppercase tracking-wide">♥ Meiste Likes diese Woche</span>
              <span className="text-lg font-black text-stone-800 leading-tight italic">{speciesName}</span>
            </div>

            <Divider />

            <div className="flex items-center gap-3">
              <CustomLogoAvatar
                logoAssets={logoAssets}
                className="w-12 h-12 shrink-0 rounded-full border border-white/15"
                fallbackText={displayName.charAt(0).toUpperCase()}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-stone-800 truncate">{displayName}</span>
                {profile.bot_name && (
                  <span className="text-xs text-emerald-600 truncate">{profile.bot_name}</span>
                )}
              </div>
              {topScan?.plant?.rarity && (
                <span className="ml-auto text-xs text-stone-400 text-right leading-tight max-w-[80px] truncate">
                  {topScan.plant.rarity}
                </span>
              )}
            </div>

            <Divider />
            <SlideFooter weekRange={weekRange} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-stone-400 text-sm text-center pb-2">
              Noch kein Scan mit Likes diese Woche
            </p>
            <Divider />
            <SlideFooter weekRange={weekRange} />
          </div>
        )}
      </div>
    </SlideShell>
  );
}

// ─── Preview carousel ─────────────────────────────────────────────────────────

const SLIDE_LABELS = ["Samen & Spieler", "Rangliste", "Scans", "Scan der Woche"];

function PreviewCarousel({ stats, weekRange, onClose }) {
  const [index, setIndex] = useState(0);
  const slides = [
    <Slide1 stats={stats} weekRange={weekRange} />,
    <Slide2 stats={stats} weekRange={weekRange} />,
    <Slide3 stats={stats} weekRange={weekRange} />,
    <Slide4 stats={stats} weekRange={weekRange} />,
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between w-full max-w-sm px-4 pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-stone-400 font-medium">
          {index + 1} / {slides.length} · {SLIDE_LABELS[index]}
        </span>
        <button className="p-1 text-stone-500 hover:text-white" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Slide */}
      <div className="w-full max-w-sm px-4" onClick={(e) => e.stopPropagation()}>
        {slides[index]}
      </div>

      {/* Navigation */}
      <div
        className="flex items-center gap-4 mt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="p-2 rounded-full bg-white/8 text-stone-300 disabled:opacity-30"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="rounded-full transition-all"
              style={{
                width: i === index ? 20 : 8,
                height: 8,
                background: i === index ? "#34d399" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        <button
          className="p-2 rounded-full bg-white/8 text-stone-300 disabled:opacity-30"
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={index === slides.length - 1}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-[10px] text-stone-700 mt-3">
        Screenshot aufnehmen, um die Karte zu speichern
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const normalizeRole = (v) => String(v || "").trim().toLowerCase();

// Einmalige Backfill-Ausschüttung vom 2026-07-07 (Quest-Seeds nachträglich vergeben)
const BACKFILL_DATE = "2026-07-07";

export default function AdminWeeklyReport() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, …
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(false);
  const [excludeBackfill, setExcludeBackfill] = useState(true); // Backfill-Korrektur standardmäßig aktiv

  const weekStartIso = getWeekStartIsoForOffset(weekOffset);
  const weekRange = formatDateRange(weekStartIso);

  // Backfill-Datum liegt in der aktuellen Woche (KW28 2026)
  const backfillIsInSelectedWeek = (() => {
    const backfill = new Date(BACKFILL_DATE + "T00:00:00Z");
    const weekStart = new Date(weekStartIso);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return backfill >= weekStart && backfill < weekEnd;
  })();

  const activeExcludeDate = (excludeBackfill && backfillIsInSelectedWeek) ? BACKFILL_DATE : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeeklyStats(weekStartIso, activeExcludeDate);
      setStats(data);
    } catch (err) {
      setError(err.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [weekStartIso, activeExcludeDate]);

  // Auth check (runs once)
  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (normalizeRole(currentUser?.role) !== "admin") {
          setTimeout(() => navigate(createPageUrl("Home")), 500);
        }
      } catch {
        setError("Profil konnte nicht geladen werden.");
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  // Load data whenever user is confirmed admin OR weekOffset changes
  useEffect(() => {
    if (user && normalizeRole(user?.role) === "admin") {
      load();
    }
  }, [user, load]);

  const isAdmin = user && normalizeRole(user?.role) === "admin";

  if (!isAdmin && !loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
        <p className="text-stone-500 text-sm">Kein Zugriff.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Page header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top py-4 border-b border-stone-800">
        <MobileBackButton />
        <div className="flex-1">
          <h1 className="text-lg font-bold">Wochenbericht</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-stone-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Week selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800/60 bg-stone-900/40">
        <button
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/8 disabled:opacity-30 transition-colors"
          onClick={() => setWeekOffset((o) => o - 1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-semibold text-white">{weekRange}</span>
          {weekOffset === 0 && (
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-widest">Aktuelle Woche</span>
          )}
          {weekOffset === -1 && (
            <span className="text-[10px] text-stone-500 uppercase tracking-widest">Letzte Woche</span>
          )}
          {weekOffset < -1 && (
            <span className="text-[10px] text-stone-500 uppercase tracking-widest">{Math.abs(weekOffset)} Wochen zurück</span>
          )}
        </div>
        <button
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/8 disabled:opacity-30 transition-colors"
          onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
          disabled={weekOffset >= 0}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center gap-6 px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-stone-500 text-sm">Lade Wochendaten…</p>
          </div>
        )}

        {error && (
          <div className="w-full max-w-sm rounded-2xl bg-red-950/40 border border-red-700/30 px-4 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Backfill-Korrektur Toggle – nur wenn Backfill in der gewählten Woche liegt */}
        {backfillIsInSelectedWeek && !loading && (
          <div className="w-full max-w-sm rounded-2xl bg-amber-950/40 border border-amber-600/30 px-4 py-3 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-400 mb-0.5">Einmalige Backfill-Ausschüttung</p>
              <p className="text-[11px] text-amber-300/70">Quest-Samen vom 07.07.2026 {excludeBackfill ? "sind ausgeklammert" : "sind eingerechnet"}</p>
            </div>
            <button
              onClick={() => setExcludeBackfill((v) => !v)}
              className={`shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors relative ${
                excludeBackfill ? "bg-amber-500" : "bg-stone-700"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  excludeBackfill ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}

        {stats && !loading && (
          <>
            {/* Quick summary grid */}
            <div className="w-full max-w-sm grid grid-cols-2 gap-3">
              {[
                { label: "Samen verdient", value: stats.seedsEarned, sub: (excludeBackfill && backfillIsInSelectedWeek) ? "Backfill ausgekl." : null, accent: true },
                { label: "Aktive Spieler", value: stats.uniqueScanners, sub: `+${stats.newPlayers} neu` },
                { label: "Scans gesamt", value: stats.totalScans, sub: `${stats.rareScans} selten+` },
                { label: "Likes auf Scans", value: stats.totalLikes },
              ].map(({ label, value, sub, accent }) => (
                <div
                  key={label}
                  className={`rounded-2xl px-4 py-4 flex flex-col gap-0.5 ${accent ? "bg-emerald-500/15 border border-emerald-500/25" : "bg-white/4 border border-white/8"}`}
                >
                  <span className="text-2xl font-black tabular-nums text-white">
                    {Number(value).toLocaleString("de-DE")}
                  </span>
                  {sub && <span className="text-xs text-stone-500">{sub}</span>}
                  <span className="text-xs text-stone-500 mt-0.5">{label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button
              className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              onClick={() => setPreview(true)}
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              4 Instagram-Slides öffnen
            </Button>
          </>
        )}
      </div>

      {/* Carousel preview */}
      {preview && stats && (
        <PreviewCarousel stats={stats} weekRange={weekRange} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}

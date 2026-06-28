import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/api/supabaseClient";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { resolveEquippedLogoAssets } from "@/lib/logoAccessoryAssets";

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

const getWeekStartIso = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
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

async function fetchWeeklyStats(weekStartIso) {
  const [ledgerRes, discoveryRes, newProfileRes, likesRes, leaderboardRes] = await Promise.all([
    supabase.from("RobotPlantWalletLedger").select("amount, direction").gte("created_at", weekStartIso),
    supabase.from("UserPlantDiscovery").select("id, plant_id, auth_id, image_url").gte("discovered_date", weekStartIso),
    supabase.from("PublicProfile").select("id").gte("created_date", weekStartIso),
    supabase.from("ScanLike").select("discovery_id, created_date").gte("created_date", weekStartIso),
    supabase.rpc("get_weekly_seed_leaderboard", { p_limit: 5 }),
  ]);

  if (ledgerRes.error) throw new Error(`Ledger: ${ledgerRes.error.message}`);
  if (discoveryRes.error) throw new Error(`Discoveries: ${discoveryRes.error.message}`);

  const ledger = ledgerRes.data ?? [];
  const discoveries = discoveryRes.data ?? [];
  const newProfiles = newProfileRes.data ?? [];
  const likes = likesRes.data ?? [];
  const leaderboard = Array.isArray(leaderboardRes.data) ? leaderboardRes.data : [];

  const seedsEarned = ledger.filter((l) => l.direction === "credit").reduce((s, l) => s + (l.amount || 0), 0);
  const seedsSpent = ledger.filter((l) => l.direction === "debit").reduce((s, l) => s + (l.amount || 0), 0);
  const uniqueScanners = new Set(discoveries.map((d) => d.auth_id).filter(Boolean)).size;
  const totalLikes = likes.length;

  // Rarity lookup
  const plantIds = [...new Set(discoveries.map((d) => d.plant_id).filter(Boolean))];
  const rarityMap = {};
  const CHUNK = 500;
  for (let i = 0; i < plantIds.length; i += CHUNK) {
    const { data: plants } = await supabase.from("Plant").select("id, rarity").in("id", plantIds.slice(i, i + CHUNK));
    for (const p of plants ?? []) rarityMap[p.id] = p.rarity;
  }
  const rareScans = discoveries.filter((d) => rarityScoreFromLabel(rarityMap[d.plant_id]) >= 4).length;

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
    seedsSpent,
    uniqueScanners,
    newPlayers: newProfiles.length,
    totalScans: discoveries.length,
    rareScans,
    totalLikes,
    leaderboard: leaderboardWithProfiles,
    topScan,
  };
}

// ─── Slide shell ──────────────────────────────────────────────────────────────

const SLIDE_BG = "linear-gradient(160deg, #090f0a 0%, #0c1f11 50%, #090f0a 100%)";
const SLIDE_BORDER = "1px solid rgba(52,211,153,0.2)";

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
        boxShadow: "0 0 40px rgba(52,211,153,0.06)",
        ...style,
      }}
    >
      {/* ambient glow top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(52,211,153,0.1) 0%, transparent 70%)" }}
      />
      {children}
    </div>
  );
}

function SlideHeader({ label }) {
  return (
    <div className="flex items-center gap-1.5 z-10">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="text-[10px] font-semibold tracking-widest uppercase text-emerald-400/70">FloraLog</span>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="text-[10px] font-semibold tracking-widest uppercase text-stone-500 ml-1">{label}</span>
    </div>
  );
}

function SlideFooter({ weekRange }) {
  return (
    <div className="flex flex-col items-center gap-1 z-10">
      <span className="text-[10px] text-stone-600">{weekRange} · floralog.app</span>
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
        <SlideHeader label="Wochenrückblick" />

        <div className="flex flex-col gap-2">
          <p className="text-stone-500 text-xs font-medium uppercase tracking-widest">Samen verdient</p>
          <div className="flex items-end gap-2">
            <span className="text-[64px] font-black leading-none tabular-nums text-emerald-300">
              {Number(stats.seedsEarned).toLocaleString("de-DE")}
            </span>
            <span className="text-2xl mb-2">🌱</span>
          </div>
          {stats.seedsSpent > 0 && (
            <span className="text-xs text-stone-500">
              −{Number(stats.seedsSpent).toLocaleString("de-DE")} ausgegeben diese Woche
            </span>
          )}
        </div>

        <Divider />

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-white/4 border border-white/8">
            <span className="text-sm text-stone-400">Aktive SpielerInnen</span>
            <span className="text-2xl font-black text-white tabular-nums">
              {Number(stats.uniqueScanners).toLocaleString("de-DE")}
            </span>
          </div>
          <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-sm text-emerald-300/80">Neue SpielerInnen</span>
            <span className="text-2xl font-black text-emerald-300 tabular-nums">
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
  { color: "#f59e0b", label: "1.", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)" },
  { color: "#94a3b8", label: "2.", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
  { color: "#b45309", label: "3.", bg: "rgba(180,83,9,0.08)", border: "rgba(180,83,9,0.25)" },
  { color: "#6b7280", label: "4.", bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.18)" },
  { color: "#6b7280", label: "5.", bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.18)" },
];

function LeaderboardRow({ entry, rank }) {
  const rs = RANK_STYLES[rank] ?? RANK_STYLES[4];
  const profile = entry.profile ?? {};
  const logoAssets = resolveEquippedLogoAssets(profile);
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
        <span className="text-sm font-semibold text-white truncate leading-tight">{displayName}</span>
        {profile.bot_name && (
          <span className="text-[10px] text-stone-500 truncate leading-tight">{profile.bot_name}</span>
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
        <SlideHeader label="Rangliste" />

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-black text-white tracking-tight">Top 5 Samen</h2>
          <p className="text-xs text-stone-500">Meiste Samen gesammelt diese Woche</p>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          {stats.leaderboard.length === 0 ? (
            <p className="text-stone-600 text-sm text-center py-8">Noch keine Daten</p>
          ) : (
            stats.leaderboard.slice(0, 5).map((entry, i) => (
              <LeaderboardRow key={String(entry.auth_id ?? i)} entry={entry} rank={i} />
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
      <div className="flex flex-col flex-1 px-6 py-6 gap-5 justify-between z-10">
        <SlideHeader label="Scan-Statistiken" />

        <div className="flex flex-col gap-2">
          <p className="text-stone-500 text-xs font-medium uppercase tracking-widest">Scans gesamt</p>
          <span className="text-[64px] font-black leading-none tabular-nums text-white">
            {Number(stats.totalScans).toLocaleString("de-DE")}
          </span>
        </div>

        <Divider />

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/25">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-300">Selten oder seltener</span>
              <span className="text-[10px] text-stone-500">Seltenheit 4★ und drüber</span>
            </div>
            <span className="text-2xl font-black text-amber-300 tabular-nums">
              {Number(stats.rareScans).toLocaleString("de-DE")}
            </span>
          </div>

          <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-pink-500/10 border border-pink-500/20">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-pink-300">Likes vergeben</span>
              <span className="text-[10px] text-stone-500">Diese Woche insgesamt</span>
            </div>
            <span className="text-2xl font-black text-pink-300 tabular-nums">
              {Number(stats.totalLikes).toLocaleString("de-DE")}
            </span>
          </div>
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
  const logoAssets = topScan ? resolveEquippedLogoAssets(profile) : null;
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
            style={{ opacity: 0.55 }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(5,10,7,0.97) 35%, rgba(5,10,7,0.4) 70%, rgba(5,10,7,0.15) 100%)" }}
          />
        </>
      )}

      <div className="flex flex-col flex-1 px-6 py-6 gap-4 justify-between z-10">
        {/* Top badge */}
        <div className="flex items-center justify-between">
          <SlideHeader label="Scan der Woche" />
          <div className="flex items-center gap-1 rounded-full px-2.5 py-1 bg-pink-500/20 border border-pink-500/30">
            <span className="text-xs text-pink-300 font-semibold">
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
              <span className="text-[10px] text-stone-500 uppercase tracking-widest font-medium">Entdeckte Art</span>
              <span className="text-lg font-black text-white leading-tight italic">{speciesName}</span>
            </div>

            <Divider />

            <div className="flex items-center gap-3">
              <CustomLogoAvatar
                logoAssets={logoAssets}
                className="w-12 h-12 shrink-0 rounded-full border border-white/15"
                fallbackText={displayName.charAt(0).toUpperCase()}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate">{displayName}</span>
                {profile.bot_name && (
                  <span className="text-xs text-emerald-400 truncate">{profile.bot_name}</span>
                )}
              </div>
              {topScan?.plant?.rarity && (
                <span className="ml-auto text-xs text-stone-500 text-right leading-tight max-w-[80px] truncate">
                  {topScan.plant.rarity}
                </span>
              )}
            </div>

            <Divider />
            <SlideFooter weekRange={weekRange} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-stone-600 text-sm text-center pb-2">
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

export default function AdminWeeklyReport() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(false);

  const weekStartIso = getWeekStartIso();
  const weekRange = formatDateRange(weekStartIso);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeeklyStats(weekStartIso);
      setStats(data);
    } catch (err) {
      setError(err.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [weekStartIso]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (normalizeRole(currentUser?.role) !== "admin") {
          setTimeout(() => navigate(createPageUrl("Home")), 500);
          return;
        }
        await load();
      } catch {
        setError("Profil konnte nicht geladen werden.");
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate, load]);

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
          <p className="text-xs text-stone-500">{weekRange}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-stone-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
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

        {stats && !loading && (
          <>
            {/* Quick summary grid */}
            <div className="w-full max-w-sm grid grid-cols-2 gap-3">
              {[
                { label: "Samen verdient", value: stats.seedsEarned, sub: stats.seedsSpent > 0 ? `−${stats.seedsSpent.toLocaleString("de-DE")} ausgegeben` : null, accent: true },
                { label: "Aktive Spieler", value: stats.uniqueScanners, sub: `+${stats.newPlayers} neu` },
                { label: "Scans gesamt", value: stats.totalScans, sub: `${stats.rareScans} selten+` },
                { label: "Likes vergeben", value: stats.totalLikes },
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

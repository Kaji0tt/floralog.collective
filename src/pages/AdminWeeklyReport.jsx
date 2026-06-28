import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Maximize2, X, Copy, Check } from "lucide-react";

import { supabase } from "@/api/supabaseClient";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import MobileBackButton from "@/components/navigation/MobileBackButton";

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

/** Returns ISO string for Monday 00:00:00 UTC of the current week. */
const getWeekStartIso = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysBack = day === 0 ? 6 : day - 1; // Monday-based
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
  const [ledgerRes, discoveryRes, profileRes] = await Promise.all([
    supabase
      .from("RobotPlantWalletLedger")
      .select("amount, direction")
      .gte("created_at", weekStartIso),

    supabase
      .from("UserPlantDiscovery")
      .select("id, plant_id")
      .gte("discovered_date", weekStartIso),

    supabase
      .from("PublicProfile")
      .select("id")
      .gte("created_date", weekStartIso),
  ]);

  if (ledgerRes.error) throw new Error(`Ledger: ${ledgerRes.error.message}`);
  if (discoveryRes.error) throw new Error(`Discoveries: ${discoveryRes.error.message}`);
  if (profileRes.error) throw new Error(`Profiles: ${profileRes.error.message}`);

  const ledger = ledgerRes.data ?? [];
  const discoveries = discoveryRes.data ?? [];
  const newProfiles = profileRes.data ?? [];

  // Seeds earned this week
  const seedsEarned = ledger
    .filter((l) => l.direction === "credit")
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const seedsSpent = ledger
    .filter((l) => l.direction === "debit")
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  // Rarity lookup
  const plantIds = [...new Set(discoveries.map((d) => d.plant_id).filter(Boolean))];

  let rarityMap = {};
  if (plantIds.length > 0) {
    // Fetch in chunks of 500 to stay within URL limits
    const CHUNK = 500;
    for (let i = 0; i < plantIds.length; i += CHUNK) {
      const chunk = plantIds.slice(i, i + CHUNK);
      const { data: plants } = await supabase
        .from("Plant")
        .select("id, rarity")
        .in("id", chunk);
      if (plants) {
        for (const p of plants) {
          rarityMap[p.id] = p.rarity;
        }
      }
    }
  }

  const rareScans = discoveries.filter(
    (d) => rarityScoreFromLabel(rarityMap[d.plant_id]) >= 4
  ).length;

  return {
    seedsEarned,
    seedsSpent,
    totalScans: discoveries.length,
    rareScans,
    newPlayers: newProfiles.length,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBlock({ label, value, sub, accent = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-4 py-5 gap-1 ${
        accent
          ? "bg-emerald-500/20 border border-emerald-400/40"
          : "bg-white/5 border border-white/10"
      }`}
    >
      <span className="text-4xl font-black tabular-nums tracking-tight text-white">
        {Number(value).toLocaleString("de-DE")}
      </span>
      {sub != null && (
        <span className="text-sm font-semibold text-emerald-300 tabular-nums">
          {typeof sub === "string" ? sub : `davon ${Number(sub).toLocaleString("de-DE")} selten+`}
        </span>
      )}
      <span className="text-xs text-stone-400 text-center leading-tight mt-0.5">{label}</span>
    </div>
  );
}

function InstagramCard({ stats, weekRange, cardRef }) {
  return (
    <div
      ref={cardRef}
      className="relative flex flex-col w-full max-w-sm rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0a1a0f 0%, #0f2a18 40%, #0a1a0f 100%)",
        border: "1px solid rgba(52,211,153,0.25)",
        boxShadow: "0 0 60px rgba(52,211,153,0.08)",
        aspectRatio: "9/16",
      }}
    >
      {/* Top decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 35% at 50% 0%, rgba(52,211,153,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="flex flex-col flex-1 px-6 pb-6 pt-8 gap-5 justify-between z-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold tracking-widest uppercase text-emerald-300/70">
              Floralog
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Wochenrückblick
          </h1>
          <p className="text-xs text-stone-500">{weekRange}</p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        {/* Stats grid */}
        <div className="flex flex-col gap-3">
          {/* Seeds */}
          <div className="flex flex-col rounded-2xl px-5 py-5 gap-1 bg-emerald-500/15 border border-emerald-400/30">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tabular-nums text-emerald-300">
                {Number(stats.seedsEarned).toLocaleString("de-DE")}
              </span>
              <span className="text-emerald-500 text-xl font-bold">🌱</span>
            </div>
            {stats.seedsSpent > 0 && (
              <span className="text-xs text-emerald-600">
                −{Number(stats.seedsSpent).toLocaleString("de-DE")} ausgegeben
              </span>
            )}
            <span className="text-xs font-medium text-stone-400 mt-0.5">
              Samen verdient diese Woche
            </span>
          </div>

          {/* Scans */}
          <div className="flex flex-col rounded-2xl px-5 py-5 gap-1 bg-white/5 border border-white/10">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black tabular-nums text-white">
                {Number(stats.totalScans).toLocaleString("de-DE")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-300">
                {Number(stats.rareScans).toLocaleString("de-DE")} selten oder seltener
              </span>
            </div>
            <span className="text-xs font-medium text-stone-400 mt-0.5">
              Scans insgesamt diese Woche
            </span>
          </div>

          {/* New players */}
          <div className="flex flex-col rounded-2xl px-5 py-5 gap-1 bg-white/5 border border-white/10">
            <span className="text-5xl font-black tabular-nums text-white">
              {Number(stats.newPlayers).toLocaleString("de-DE")}
            </span>
            <span className="text-xs font-medium text-stone-400 mt-0.5">
              Neue Spieler diese Woche
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        {/* Footer */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-stone-500">floralog.app</span>
          <div
            className="w-12 h-0.5 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, #34d399, transparent)" }}
          />
        </div>
      </div>
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
  const [copied, setCopied] = useState(false);

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

  const copyStats = useCallback(() => {
    if (!stats) return;
    const text = [
      `🌿 FloraLog Wochenrückblick`,
      `📅 ${weekRange}`,
      ``,
      `🌱 Samen verdient: ${Number(stats.seedsEarned).toLocaleString("de-DE")}`,
      stats.seedsSpent > 0 ? `   (−${Number(stats.seedsSpent).toLocaleString("de-DE")} ausgegeben)` : null,
      `📷 Scans gesamt: ${Number(stats.totalScans).toLocaleString("de-DE")}`,
      `⭐ Davon selten+: ${Number(stats.rareScans).toLocaleString("de-DE")}`,
      `👤 Neue Spieler: ${Number(stats.newPlayers).toLocaleString("de-DE")}`,
      ``,
      `floralog.app`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [stats, weekRange]);

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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top py-4 border-b border-stone-800">
        <MobileBackButton />
        <div className="flex-1">
          <h1 className="text-lg font-bold">Wochenbericht</h1>
          <p className="text-xs text-stone-500">{weekRange}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="text-stone-400"
        >
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
            {/* Quick stats for admin overview */}
            <div className="w-full max-w-sm grid grid-cols-3 gap-3">
              <StatBlock label="Samen verdient" value={stats.seedsEarned} accent />
              <StatBlock
                label="Scans"
                value={stats.totalScans}
                sub={`${stats.rareScans} selten+`}
              />
              <StatBlock label="Neue Spieler" value={stats.newPlayers} />
            </div>

            {/* Action buttons */}
            <div className="w-full max-w-sm flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800"
                onClick={() => setPreview(true)}
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Instagram-Vorschau
              </Button>
              <Button
                variant="outline"
                className="border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800 px-4"
                onClick={copyStats}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Seeds breakdown */}
            {stats.seedsSpent > 0 && (
              <div className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-800 px-5 py-4 text-sm space-y-2">
                <p className="font-semibold text-stone-300">Seeds Economy</p>
                <div className="flex justify-between text-stone-400">
                  <span>Verdient</span>
                  <span className="text-emerald-400 font-mono">
                    +{Number(stats.seedsEarned).toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Ausgegeben</span>
                  <span className="text-red-400 font-mono">
                    −{Number(stats.seedsSpent).toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="border-t border-stone-700 pt-2 flex justify-between font-semibold text-white">
                  <span>Netto</span>
                  <span className="font-mono">
                    {Number(stats.seedsEarned - stats.seedsSpent).toLocaleString("de-DE")}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Instagram preview overlay */}
      {preview && stats && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm px-4 gap-4"
          onClick={() => setPreview(false)}
        >
          {/* Close */}
          <button
            className="self-end p-2 text-stone-400 hover:text-white"
            onClick={() => setPreview(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {/* The card */}
          <div onClick={(e) => e.stopPropagation()}>
            <InstagramCard stats={stats} weekRange={weekRange} />
          </div>

          <p className="text-xs text-stone-600 text-center">
            Screenshot mit deinem Gerät aufnehmen um die Karte zu speichern.
          </p>
        </div>
      )}
    </div>
  );
}

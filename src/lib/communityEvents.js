import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

// Ended events stay visible (result display) for this long after end_date.
export const COMMUNITY_EVENT_AFTERGLOW_MS = 3 * 24 * 60 * 60 * 1000;

export const COMMUNITY_EVENT_QUERY_KEY = "communityEvent";

const toTime = (value) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

/**
 * @returns {"upcoming" | "active" | "succeeded" | "failed" | "ended"}
 */
export function getCommunityEventPhase(event, now = Date.now()) {
  if (!event) return "ended";
  const start = toTime(event.start_date);
  const end = toTime(event.end_date);
  if (start !== null && now < start) return "upcoming";
  if (end === null || now <= end) return "active";
  if (event.outcome === "succeeded") return "succeeded";
  if (event.outcome === "failed") return "failed";
  // Ended but not finalized yet: completed already decides the outcome.
  return event.completed ? "succeeded" : "ended";
}

export function getCommunityEventTiers(event) {
  const tiers = Array.isArray(event?.reward_tiers) ? event.reward_tiers : [];
  return tiers
    .map((tier) => ({
      min: Number(tier?.min_contributions) || 0,
      rewardId: tier?.reward_id || null,
      // Guaranteed tiers are granted at the event end regardless of the outcome.
      guaranteed: tier?.requires_success === false,
    }))
    .filter((tier) => tier.min > 0 && tier.rewardId)
    .sort((a, b) => a.min - b.min || Number(b.guaranteed) - Number(a.guaranteed));
}

export function getNextCommunityEventTier(event, contributedCount) {
  return getCommunityEventTiers(event).find((tier) => contributedCount < tier.min) || null;
}

/** "Kastanie" → "Kastanien", "Kürbis" → "Kürbisse". */
export function pluralizeCommunityEventTarget(label) {
  const value = String(label || "Zielpflanze").trim();
  if (/e$/i.test(value)) return `${value}n`;
  if (/is$/i.test(value)) return `${value}se`;
  return value;
}

export function getCommunityEventTargetLabel(event) {
  return event?.target_species_name || event?.target_genus_name || "Zielpflanze";
}

/**
 * Visual themes for every Community-Event surface (Home stripe, quest card,
 * explorer log, reward overlay). Selected via CommunityQuest.theme.
 * Tailwind classes are spelled out so the JIT compiler picks them up.
 */
export const COMMUNITY_EVENT_THEMES = {
  chestnut: {
    key: "chestnut",
    emoji: "🌰",
    blink: false,
    conic:
      "conic-gradient(from 0deg, rgba(120,53,15,0.15) 0%, rgba(245,158,11,0.95) 10%, rgba(254,243,199,1) 14%, rgba(245,158,11,0.95) 18%, rgba(120,53,15,0.15) 30%, rgba(120,53,15,0.15) 50%, rgba(217,119,6,0.9) 60%, rgba(253,230,138,1) 64%, rgba(217,119,6,0.9) 68%, rgba(120,53,15,0.15) 80%, rgba(120,53,15,0.15) 100%)",
    glowShadow: "0 0 16px rgba(245,158,11,0.32), 0 0 38px rgba(180,83,9,0.2)",
    glowShadowDim: "0 0 16px rgba(245,158,11,0.32), 0 0 38px rgba(180,83,9,0.2)",
    progressGradient: "linear-gradient(90deg, #78350f, #d97706, #fde68a)",
    cardAccent: { tint: "rgba(180,83,9,0.42)", border: "rgba(251,191,36,0.35)", iconBg: "bg-amber-300/16 border-amber-200/30 text-amber-100" },
    labelText: { light: "text-amber-700", dark: "text-amber-300/90" },
    personalText: { light: "text-amber-800", dark: "text-amber-200/90" },
    explorerSurface: { light: "bg-gradient-to-br from-amber-50 to-white", dark: "bg-gradient-to-br from-amber-900/40 via-stone-950/80 to-black/80" },
    explorerLabel: { light: "text-amber-700", dark: "text-amber-300" },
    explorerPersonal: { light: "text-amber-800", dark: "text-amber-200" },
    scanCard: { light: "border-amber-200 bg-white hover:bg-amber-50", dark: "border-amber-200/15 bg-black/30 hover:bg-black/45" },
    scanPlaceholder: { light: "bg-amber-50", dark: "bg-amber-500/10" },
    summaryBox: "border-amber-200/20",
    summaryHighlight: "text-amber-200",
    tierReached: "border-amber-300/60 bg-amber-400/20 text-amber-100",
    overlay: {
      panel: "border-amber-200/30 bg-[radial-gradient(circle_at_20%_10%,rgba(180,83,9,0.38),transparent_45%),radial-gradient(circle_at_80%_8%,rgba(251,191,36,0.22),transparent_40%),linear-gradient(180deg,rgba(28,16,6,0.98)_0%,rgba(16,10,4,0.99)_100%)]",
      sparkle: "text-amber-200/80",
      chip: "border-amber-200/35 bg-amber-300/10 text-amber-200/95",
      heading: "text-amber-50",
      muted: "text-amber-100/70",
      bar: "bg-gradient-to-r from-amber-700 via-amber-400 to-amber-200",
      box: "border-amber-100/25",
      accent: "text-amber-100",
      icon: "text-amber-300",
      reward: "border-amber-200/30 bg-amber-300/10",
      button: "bg-gradient-to-b from-amber-400 to-orange-600 hover:from-amber-300 hover:to-orange-500",
    },
  },
  pumpkin: {
    key: "pumpkin",
    emoji: "🎃",
    blink: true,
    conic:
      "conic-gradient(from 0deg, rgba(88,28,135,0.25) 0%, rgba(249,115,22,1) 10%, rgba(255,237,213,1) 14%, rgba(249,115,22,1) 18%, rgba(88,28,135,0.25) 30%, rgba(168,85,247,0.85) 40%, rgba(88,28,135,0.25) 50%, rgba(234,88,12,1) 60%, rgba(254,215,170,1) 64%, rgba(234,88,12,1) 68%, rgba(88,28,135,0.25) 80%, rgba(168,85,247,0.85) 90%, rgba(88,28,135,0.25) 100%)",
    glowShadow: "0 0 18px rgba(249,115,22,0.7), 0 0 42px rgba(147,51,234,0.45)",
    glowShadowDim: "0 0 6px rgba(249,115,22,0.15), 0 0 14px rgba(147,51,234,0.1)",
    progressGradient: "linear-gradient(90deg, #581c87, #ea580c, #fdba74)",
    cardAccent: { tint: "rgba(194,65,12,0.45)", border: "rgba(251,146,60,0.4)", iconBg: "bg-orange-400/16 border-orange-300/35 text-orange-100" },
    labelText: { light: "text-orange-700", dark: "text-orange-300" },
    personalText: { light: "text-purple-800", dark: "text-orange-200/90" },
    explorerSurface: { light: "bg-gradient-to-br from-orange-50 via-white to-purple-50", dark: "bg-gradient-to-br from-orange-900/45 via-purple-950/70 to-black/80" },
    explorerLabel: { light: "text-orange-700", dark: "text-orange-300" },
    explorerPersonal: { light: "text-purple-800", dark: "text-orange-200" },
    scanCard: { light: "border-orange-200 bg-white hover:bg-orange-50", dark: "border-orange-300/20 bg-black/30 hover:bg-black/45" },
    scanPlaceholder: { light: "bg-orange-50", dark: "bg-orange-500/10" },
    summaryBox: "border-orange-300/25",
    summaryHighlight: "text-orange-200",
    tierReached: "border-orange-300/60 bg-orange-500/20 text-orange-100",
    overlay: {
      panel: "border-orange-300/35 bg-[radial-gradient(circle_at_20%_10%,rgba(234,88,12,0.4),transparent_45%),radial-gradient(circle_at_80%_8%,rgba(147,51,234,0.3),transparent_40%),linear-gradient(180deg,rgba(26,10,30,0.98)_0%,rgba(14,6,16,0.99)_100%)]",
      sparkle: "text-orange-200/85",
      chip: "border-orange-300/40 bg-orange-400/10 text-orange-200",
      heading: "text-orange-50",
      muted: "text-orange-100/70",
      bar: "bg-gradient-to-r from-purple-800 via-orange-500 to-orange-200",
      box: "border-orange-200/25",
      accent: "text-orange-100",
      icon: "text-orange-300",
      reward: "border-orange-300/35 bg-orange-400/10",
      button: "bg-gradient-to-b from-orange-400 to-purple-700 hover:from-orange-300 hover:to-purple-600",
    },
  },
};

export const DEFAULT_COMMUNITY_EVENT_THEME = COMMUNITY_EVENT_THEMES.chestnut;

export function getCommunityEventTheme(eventOrThemeKey) {
  const key = typeof eventOrThemeKey === "string" ? eventOrThemeKey : eventOrThemeKey?.theme;
  return COMMUNITY_EVENT_THEMES[key] || DEFAULT_COMMUNITY_EVENT_THEME;
}

/**
 * className/style for the outer glow of an event surface. Blinking themes animate
 * the glow via the `community-event-glow-blink` keyframes (see index.css);
 * `baseShadow` stays underneath (e.g. the card's drop shadow).
 */
export function getCommunityEventGlowProps(theme, baseShadow = "") {
  const resolvedTheme = theme || DEFAULT_COMMUNITY_EVENT_THEME;
  const boxShadow = baseShadow ? `${baseShadow}, ${resolvedTheme.glowShadow}` : resolvedTheme.glowShadow;
  if (!resolvedTheme.blink) return { className: "", style: { boxShadow } };
  return {
    className: "community-event-glow-blink",
    style: {
      "--ce-glow-base": baseShadow || "0 0 0 transparent",
      "--ce-glow-strong": resolvedTheme.glowShadow,
      "--ce-glow-dim": resolvedTheme.glowShadowDim,
      boxShadow,
    },
  };
}

export function formatCommunityEventPeriod(event) {
  const options = { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" };
  const start = toTime(event?.start_date);
  const end = toTime(event?.end_date);
  if (start === null || end === null) return "";
  const fmt = new Intl.DateTimeFormat("de-DE", options);
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}

export function formatCommunityEventRemaining(event, now = Date.now()) {
  const end = toTime(event?.end_date);
  if (end === null) return "";
  const diff = end - now;
  if (diff <= 0) return "beendet";
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 48) return `noch ${Math.floor(hours / 24)} Tage`;
  if (hours >= 1) return `noch ${hours} Std.`;
  return "endet gleich";
}

async function fetchCommunityEvent(userId) {
  const sinceIso = new Date(Date.now() - COMMUNITY_EVENT_AFTERGLOW_MS).toISOString();
  const { data: events, error } = await supabase
    .from("CommunityQuest")
    .select("*")
    .eq("is_event", true)
    .eq("is_active", true)
    .lte("start_date", new Date().toISOString())
    .gte("end_date", sinceIso)
    .order("start_date", { ascending: false })
    .limit(1);

  if (error) {
    console.warn("[CommunityEvent] Event query failed:", error);
    return null;
  }

  const event = events?.[0];
  if (!event) return null;

  let participation = null;
  if (userId) {
    const { data, error: participationError } = await supabase
      .from("UserCommunityQuest")
      .select("*")
      .eq("community_quest_id", event.id)
      .eq("auth_id", userId)
      .maybeSingle();
    if (participationError) {
      console.warn("[CommunityEvent] Participation query failed:", participationError);
    }
    participation = data || null;
  }

  return { event, participation };
}

/**
 * Current (or recently ended) community event plus the user's participation.
 */
export function useCommunityEvent(userId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: [COMMUNITY_EVENT_QUERY_KEY, userId || null],
    queryFn: () => fetchCommunityEvent(userId),
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const event = query.data?.event || null;
  const participation = query.data?.participation || null;
  const contributedCount = Number(participation?.contributed_count) || 0;
  const progress = Number(event?.current_progress) || 0;
  const target = Number(event?.required_discoveries) || 0;

  return {
    ...query,
    event,
    participation,
    contributedCount,
    progress,
    target,
    phase: event ? getCommunityEventPhase(event) : null,
  };
}

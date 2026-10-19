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
    }))
    .filter((tier) => tier.min > 0 && tier.rewardId)
    .sort((a, b) => a.min - b.min);
}

export function getNextCommunityEventTier(event, contributedCount) {
  return getCommunityEventTiers(event).find((tier) => contributedCount < tier.min) || null;
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

/**
 * weeklyRewardsScheduler
 *
 * Scheduled (Monday 00:05 UTC) via Supabase Edge Function Schedule.
 * Distributes end-of-week bonuses for the PREVIOUS calendar week:
 *
 *   Rank 1  → +15 Funken (sparks)
 *   Rank 2  → +10 Funken
 *   Rank 3  → +5  Funken
 *   Rank 4  → +3  Funken
 *   Rank 5  → +3  Funken
 *
 *   Most liked scan  → +15 Samen (robot-plant seeds)
 *
 * Protected by WEEKLY_REWARDS_SCHEDULER_SECRET env var (header: x-weekly-rewards-secret).
 * Optionally accepts { weekStart: "YYYY-MM-DDT00:00:00.000Z" } in the body to target
 * a specific week (useful for back-filling or testing).
 */

const RANK_SPARKS = [15, 10, 5, 3, 3]; // indices 0-4 → positions 1-5
const LIKES_WINNER_FUNKEN = 15;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-weekly-rewards-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Returns the ISO week key "YYYY-WNN" for the Monday that starts the week containing `date`. */
function getIsoWeekKey(mondayDate: Date): string {
  const d = new Date(Date.UTC(
    mondayDate.getUTCFullYear(),
    mondayDate.getUTCMonth(),
    mondayDate.getUTCDate(),
    12, 0, 0,
  ));
  // Tomohiko Sakamoto / ISO-8601 week number
  const dayOfWeek = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Returns the Monday 00:00 UTC of the week offset by `delta` from today (0 = current week, -1 = last week). */
function getMondayForOffset(delta: number): Date {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysToMonday + delta * 7,
  ));
}

/** Bounds for the previous week (Mon 00:00 UTC … Mon 00:00 UTC). */
function getPreviousWeekBounds(): { weekStart: string; weekEnd: string; weekKey: string } {
  const prevMonday = getMondayForOffset(-1);
  const thisMonday = getMondayForOffset(0);
  return {
    weekStart: prevMonday.toISOString(),
    weekEnd: thisMonday.toISOString(),
    weekKey: getIsoWeekKey(prevMonday),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends an in-app notification AND a push notification (FCM / Web-Push)
 * by invoking the createNotification edge function with service-role credentials.
 */
async function sendNotification(
  db: ReturnType<typeof createClient>,
  serviceRoleKey: string,
  params: {
    authId: string;
    notificationType: string;
    title: string;
    message: string;
    description?: string;
    priority?: string;
    actionUrl?: string;
  },
): Promise<void> {
  const { authId, notificationType, title, message, description, priority, actionUrl } = params;
  const { error } = await db.functions.invoke("createNotification", {
    body: {
      authId,
      notificationType,
      title,
      message,
      description: description ?? "",
      displayLocation: "banner",
      priority: priority ?? "medium",
      actionUrl: actionUrl ?? "",
    },
    headers: {
      // Service-role key as Bearer – createNotification recognises this via
      // isServiceRoleInvocation() and skips the regular caller auth check.
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (error) {
    console.warn(
      `[weeklyRewardsScheduler] createNotification failed for ${authId}:`,
      error.message ?? error,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Origin check (scheduler calls are typically from Supabase internals, but keep it consistent)
  const originDenied = buildOriginDeniedResponse(req, corsHeaders, "weeklyRewardsScheduler");
  if (originDenied) return originDenied;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const schedulerSecret = Deno.env.get("WEEKLY_REWARDS_SCHEDULER_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured: missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  // ── Secret check ───────────────────────────────────────────────────────────
  const providedSecret = String(req.headers.get("x-weekly-rewards-secret") ?? "").trim();
  if (!schedulerSecret || !providedSecret || providedSecret !== schedulerSecret) {
    console.warn("[weeklyRewardsScheduler] Unauthorized call – secret mismatch");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // ── Build service-role client ──────────────────────────────────────────────
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Determine target week ──────────────────────────────────────────────────
  let weekStart: string;
  let weekEnd: string;
  let weekKey: string;

  try {
    const body = await req.clone().json() as Record<string, unknown>;
    if (typeof body?.weekStart === "string") {
      const ws = new Date(body.weekStart);
      if (isNaN(ws.getTime())) throw new Error("Invalid weekStart");
      const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
      weekStart = ws.toISOString();
      weekEnd = we.toISOString();
      weekKey = getIsoWeekKey(ws);
      console.log("[weeklyRewardsScheduler] Using forced weekStart:", weekStart);
    } else {
      ({ weekStart, weekEnd, weekKey } = getPreviousWeekBounds());
    }
  } catch {
    ({ weekStart, weekEnd, weekKey } = getPreviousWeekBounds());
  }

  console.log(`[weeklyRewardsScheduler] Processing week ${weekKey}: ${weekStart} → ${weekEnd}`);

  const rankingResults: unknown[] = [];
  const errors: string[] = [];

  // ══════════════════════════════════════════════════════════════════════════
  // 1. RANKING REWARDS – Funken für Top-5 der Wochensamen-Rangliste
  // ══════════════════════════════════════════════════════════════════════════
  {
    const { data: lb, error: lbErr } = await db.rpc("get_weekly_seed_leaderboard", {
      p_limit: 5,
      p_week_start: weekStart,
    });

    if (lbErr) {
      const msg = `leaderboard RPC failed: ${lbErr.message}`;
      console.error("[weeklyRewardsScheduler]", msg);
      errors.push(msg);
    } else {
      const entries = Array.isArray(lb) ? lb : [];

      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        const entry = entries[i] as {
          auth_id: string;
          display_name?: string | null;
          full_name?: string | null;
          weekly_seed_total?: number;
        };
        const rank = i + 1;
        const sparks = RANK_SPARKS[i];
        const authId = entry.auth_id;
        const displayName = entry.display_name || entry.full_name || "Spieler:in";
        const eventRef = `weekly_ranking:${weekKey}:rank:${rank}`;

        // Grant sparks (wallet_grant_currency is SECURITY DEFINER;
        // auth.uid() is NULL under service role → auth check passes)
        const { error: grantErr } = await db.rpc("wallet_grant_currency", {
          p_auth_id: authId,
          p_currency_code: "sparks",
          p_event_source: "weekly_ranking_reward",
          p_event_reference: eventRef,
          p_amount: sparks,
          p_direction: "credit",
          p_metadata: { week: weekKey, rank },
        });

        if (grantErr) {
          const msg = `rank ${rank} sparks grant (${authId}): ${grantErr.message}`;
          console.error("[weeklyRewardsScheduler]", msg);
          errors.push(msg);
          continue;
        }

        // Notification + Push via createNotification (handles FCM & Web-Push)
        // actionUrl deep-links into the WeeklyRankingResultModal (mounted globally in Layout.jsx)
        // instead of just landing on a plain Home screen.
        const modalParams = new URLSearchParams({
          weeklyRankModal: weekKey,
          rank: String(rank),
          sparks: String(sparks),
          weekStart,
        });
        await sendNotification(db, serviceRoleKey, {
          authId,
          notificationType: "weekly_ranking_reward",
          title: `🏆 Platz ${rank} in der Wochenwertung!`,
          message: `Du hast diese Woche Platz ${rank} in der Rangliste belegt und erhältst +${sparks} Funken als Belohnung! Weiter so! ⚡`,
          description: `${weekKey} · +${sparks} Funken`,
          priority: rank === 1 ? "high" : "medium",
          actionUrl: `Home?${modalParams.toString()}`,
        });

        rankingResults.push({ rank, authId, displayName, sparks });
        console.log(`[weeklyRewardsScheduler] Rank ${rank} (${displayName}): +${sparks} Funken`);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. MEISTE LIKES – 15 Funken für den meistgelikten Scan der Woche
  // ══════════════════════════════════════════════════════════════════════════
  let likesResult: unknown = null;
  {
    const { data: discs, error: discErr } = await db
      .from("UserPlantDiscovery")
      .select("id, auth_id, plant_id")
      .gte("discovered_date", weekStart)
      .lt("discovered_date", weekEnd);

    if (discErr) {
      const msg = `discoveries fetch failed: ${discErr.message}`;
      console.error("[weeklyRewardsScheduler]", msg);
      errors.push(msg);
    } else {
      const discoveries = (discs ?? []) as Array<{ id: string; auth_id: string | null; plant_id: string | null }>;
      const discoveryIds = discoveries.map((d) => d.id).filter(Boolean);

      if (discoveryIds.length > 0) {
        // Count likes per discovery (chunked to stay within URL limits)
        const likeCounts: Record<string, number> = {};
        const CHUNK = 500;
        for (let i = 0; i < discoveryIds.length; i += CHUNK) {
          const { data: chunk } = await db
            .from("ScanLike")
            .select("discovery_id")
            .in("discovery_id", discoveryIds.slice(i, i + CHUNK));
          for (const like of chunk ?? []) {
            if (like.discovery_id) {
              likeCounts[like.discovery_id] = (likeCounts[like.discovery_id] ?? 0) + 1;
            }
          }
        }

        const topEntry = Object.entries(likeCounts).sort(([, a], [, b]) => b - a)[0];

        if (topEntry && topEntry[1] > 0) {
          const [topDiscId, topCount] = topEntry;
          const topDisc = discoveries.find((d) => d.id === topDiscId);

          if (topDisc?.auth_id) {
            // Look up plant name for the notification message
            let plantName = "einer Pflanze";
            if (topDisc.plant_id) {
              const { data: plantRow } = await db
                .from("Plant")
                .select("species_name")
                .eq("id", topDisc.plant_id)
                .maybeSingle();
              if (plantRow?.species_name) plantName = plantRow.species_name;
            }

            const eventRef = `weekly_likes_winner:${weekKey}`;

            // Grant Funken (sparks) via wallet_grant_currency (SECURITY DEFINER)
            const { error: sparksErr } = await db.rpc("wallet_grant_currency", {
              p_auth_id: topDisc.auth_id,
              p_currency_code: "sparks",
              p_event_source: "weekly_likes_reward",
              p_event_reference: eventRef,
              p_amount: LIKES_WINNER_FUNKEN,
              p_direction: "credit",
              p_metadata: { week: weekKey, like_count: topCount, discovery_id: topDiscId },
            });

            if (sparksErr) {
              const msg = `likes funken grant (${topDisc.auth_id}): ${sparksErr.message}`;
              console.error("[weeklyRewardsScheduler]", msg);
              errors.push(msg);
            } else {
              // Notification + Push via createNotification (handles FCM & Web-Push)
              // actionUrl opens the Explorer Log with the Community (SOTW) tab pre-selected
              // instead of leading nowhere.
              await sendNotification(db, serviceRoleKey, {
                authId: topDisc.auth_id,
                notificationType: "weekly_likes_reward",
                title: "❤️ Herzliches Update aus der Community!",
                message: `Dein Scan von der Pflanze ${plantName} hat letzte Woche die meisten Likes erhalten (${topCount} ♥). Du erhältst +${LIKES_WINNER_FUNKEN} Funken als Belohnung!`,
                description: `${weekKey} · ${topCount} ♥ · +${LIKES_WINNER_FUNKEN} Funken`,
                priority: "high",
                actionUrl: "Friends?tab=explorer&explorerView=sotw",
              });

              likesResult = { discoveryId: topDiscId, authId: topDisc.auth_id, likeCount: topCount, funken: LIKES_WINNER_FUNKEN, plantName };
              console.log(`[weeklyRewardsScheduler] Likes winner (${topDisc.auth_id}): ${topCount} likes → +${LIKES_WINNER_FUNKEN} Funken`);
            }
          }
        } else {
          console.log("[weeklyRewardsScheduler] No liked scans found for this week");
        }
      } else {
        console.log("[weeklyRewardsScheduler] No discoveries found for this week");
      }
    }
  }

  return jsonResponse({
    success: true,
    weekKey,
    weekStart,
    weekEnd,
    rankingRewards: rankingResults,
    likesReward: likesResult,
    errors,
  });
});

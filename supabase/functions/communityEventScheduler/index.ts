import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

/**
 * communityEventScheduler
 *
 * Called hourly by the Cloudflare worker `workers/community-events`.
 * For every Community Event (CommunityQuest.is_event = true) it:
 *   1. sends a start broadcast once the event has started
 *   2. sends two progress broadcasts at ~1/3 and ~2/3 of the runtime
 *   3. sends a broadcast once the community goal is reached
 *   4. finalizes the event after end_date (finalize_community_quest RPC →
 *      Funken + Faces + result notification per participant) and broadcasts the result
 *
 * Every step is guarded by a timestamp/counter column on CommunityQuest that is
 * claimed atomically before sending, so repeated or overlapping runs never double-send.
 * Pushes are only sent between 08:00 and 21:59 Europe/Berlin; outside that window
 * they are deferred to the next run (finalization itself is never deferred).
 *
 * Protected by COMMUNITY_EVENT_SCHEDULER_SECRET (header: x-community-event-secret).
 * Body (optional): { "force": true } ignores the push time window (manual trigger).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-community-event-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PUSH_WINDOW_START_HOUR = 8;
const PUSH_WINDOW_END_HOUR = 22;
const ACTION_URL = "Achievements";

type CommunityEvent = {
  id: string;
  title: string;
  target_genus_name: string | null;
  target_species_name: string | null;
  required_discoveries: number;
  current_progress: number;
  completed: boolean;
  start_date: string;
  end_date: string;
  reward_tiers: Array<{ min_contributions?: number }> | null;
  success_sparks: number | null;
  failure_sparks: number | null;
  outcome: string | null;
  finalized_at: string | null;
  start_notified_at: string | null;
  progress_notified_count: number | null;
  goal_notified_at: string | null;
  end_notified_at: string | null;
};

type FcmServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getBerlinHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(date);
  return Number(hour) % 24;
}

function isInsidePushWindow(date: Date): boolean {
  const hour = getBerlinHour(date);
  return hour >= PUSH_WINDOW_START_HOUR && hour < PUSH_WINDOW_END_HOUR;
}

function formatBerlinWeekday(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "Europe/Berlin" }).format(new Date(value));
}

function pluralizeTarget(event: CommunityEvent): string {
  const label = (event.target_species_name || event.target_genus_name || "Zielpflanze").trim();
  return /e$/i.test(label) ? `${label}n` : label;
}

function formatTierThresholds(event: CommunityEvent): string {
  const mins = (Array.isArray(event.reward_tiers) ? event.reward_tiers : [])
    .map((tier) => Number(tier?.min_contributions) || 0)
    .filter((min) => min > 0)
    .sort((a, b) => a - b);
  if (mins.length === 0) return "";
  if (mins.length === 1) return String(mins[0]);
  return `${mins.slice(0, -1).join(", ")} und ${mins[mins.length - 1]}`;
}

// ── Story copy (Florabot voice) ──────────────────────────────────────────────

function buildStartCopy(event: CommunityEvent) {
  const plural = pluralizeTarget(event);
  const tiers = formatTierThresholds(event);
  return {
    title: `🌰 Community Event: ${event.title}`,
    body:
      `Wir Florabots brauchen eure Hilfe! Bis ${formatBerlinWeekday(event.end_date)} wollen wir gemeinsam ` +
      `${event.required_discoveries} ${plural} kartieren. Jeder Scan zählt` +
      (tiers ? ` – ab ${tiers} eigenen Scans warten exklusive Faces auf euch!` : "!"),
  };
}

function buildProgressCopy(event: CommunityEvent) {
  const plural = pluralizeTarget(event);
  const missing = Math.max(0, event.required_discoveries - event.current_progress);
  return {
    title: `🌰 Zwischenstand: ${event.title}`,
    body:
      `${event.current_progress} von ${event.required_discoveries} ${plural} sind schon in unseren Datenbanken! ` +
      `Noch ${missing} fehlen – die Florabots der Heimatwelt fiebern mit. Bis ${formatBerlinWeekday(event.end_date)} ist Zeit!`,
  };
}

function buildGoalCopy(event: CommunityEvent) {
  const plural = pluralizeTarget(event);
  return {
    title: `🎉 Ziel erreicht: ${event.title}`,
    body:
      `Gemeinsam habt ihr ${event.required_discoveries} ${plural} kartiert – die Belohnungen sind gesichert! ` +
      `Scannt weiter bis ${formatBerlinWeekday(event.end_date)}, um höhere Face-Stufen freizuschalten.`,
  };
}

function buildEndCopy(event: CommunityEvent) {
  const plural = pluralizeTarget(event);
  if (event.outcome === "succeeded") {
    return {
      title: `🌰 ${event.title} abgeschlossen!`,
      body:
        `Unglaublich: ${event.current_progress} ${plural} kartiert! Unsere Heimat lernt so viel von euch. ` +
        `Alle Teilnehmenden erhalten +${event.success_sparks ?? 0} Funken ⚡ – öffne die App für deine Belohnungen.`,
    };
  }
  return {
    title: `🌰 ${event.title} beendet`,
    body:
      `${event.current_progress} von ${event.required_discoveries} ${plural} – knapp daneben! Danke für eure Daten. ` +
      `Alle Teilnehmenden erhalten +${event.failure_sparks ?? 0} Funken ⚡ als Dankeschön.`,
  };
}

// ── Push delivery (FCM + Web Push), modeled on broadcastNews ─────────────────

function parseFcmServiceAccount(rawJson: string | null | undefined): FcmServiceAccount | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as FcmServiceAccount;
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isLikelyWebPushSubscription(subscriptionText: string | null | undefined): boolean {
  if (!subscriptionText) return false;
  try {
    const parsed = JSON.parse(subscriptionText) as { endpoint?: string; keys?: Record<string, string> };
    return typeof parsed?.endpoint === "string" && !!parsed?.keys;
  } catch {
    return false;
  }
}

function base64UrlEncodeBytes(input: Uint8Array): string {
  const binary = String.fromCharCode(...input);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(input: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(input));
}

async function getFcmAccessToken(serviceAccount: FcmServiceAccount): Promise<string> {
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64UrlEncodeText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncodeText(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const pem = serviceAccount.private_key.replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) {
    throw new Error(`Google OAuth token request failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json() as { access_token?: string };
  if (!data?.access_token) throw new Error("Google OAuth token response missing access_token");
  return data.access_token;
}

async function broadcastPush(
  db: SupabaseClient,
  params: { title: string; body: string; tag: string },
): Promise<{ totalProfiles: number; pushSent: number; pushFailed: number }> {
  const { title, body, tag } = params;

  // Persist the message in the news feed, too (same as admin broadcasts).
  const { error: newsError } = await db.from("News").insert({
    id: crypto.randomUUID(),
    title,
    text: body,
    created_date: new Date().toISOString(),
    created_by: "system",
  });
  if (newsError) console.warn("[communityEventScheduler] News insert failed:", newsError.message);

  const { data: allProfiles } = await db
    .from("PublicProfile")
    .select("auth_id, push_subscription, fcm_token");
  const profiles = (allProfiles || []) as Array<{
    auth_id: string | null;
    push_subscription: string | null;
    fcm_token: string | null;
  }>;

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails("mailto:info@floralog.de", vapidPublicKey, vapidPrivateKey);
  }

  const fcmServiceAccount = parseFcmServiceAccount(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON"));
  let fcmAccessToken: string | null = null;
  if (fcmServiceAccount) {
    try {
      fcmAccessToken = await getFcmAccessToken(fcmServiceAccount);
    } catch (err) {
      console.warn("[communityEventScheduler] FCM token failed:", (err as Error).message);
    }
  }

  let pushSent = 0;
  let pushFailed = 0;
  const tokensToClear: string[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (profile) => {
      const hasFcm = Boolean(profile.fcm_token);
      const hasWebPush = isLikelyWebPushSubscription(profile.push_subscription);
      if (!hasFcm && !hasWebPush) return;

      if (hasFcm && fcmServiceAccount && fcmAccessToken) {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${fcmServiceAccount.project_id}/messages:send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcmAccessToken}` },
            body: JSON.stringify({
              message: {
                token: profile.fcm_token!.trim(),
                notification: { title, body },
                data: { type: "community_event", sender: "system", actionUrl: ACTION_URL },
                android: {
                  priority: "high",
                  notification: { icon: "ic_stat_floralog", color: "#3BAF61" },
                },
                apns: { payload: { aps: { sound: "default" } } },
              },
            }),
          },
        );
        if (response.ok) {
          pushSent++;
          return;
        }
        pushFailed++;
        const errText = await response.text();
        if (errText.includes("UNREGISTERED") && profile.auth_id) tokensToClear.push(profile.auth_id);
        return;
      }

      if (hasWebPush && vapidPublicKey && vapidPrivateKey) {
        try {
          await webpush.sendNotification(
            JSON.parse(profile.push_subscription!),
            JSON.stringify({
              title,
              body,
              icon: "/PlantDexIcon.png",
              badge: "/PlantDexIcon.png",
              tag,
              data: { type: "community_event", from: "system", actionUrl: ACTION_URL },
            }),
          );
          pushSent++;
        } catch {
          pushFailed++;
        }
      }
    }));
  }

  if (tokensToClear.length > 0) {
    await Promise.allSettled(tokensToClear.map((authId) =>
      db.from("PublicProfile").update({ fcm_token: null }).eq("auth_id", authId)
    ));
  }

  return { totalProfiles: profiles.length, pushSent, pushFailed };
}

// ── Step claiming: update guard column only if still unclaimed ───────────────

async function claimTimestampFlag(db: SupabaseClient, eventId: string, column: string): Promise<boolean> {
  const { data, error } = await db
    .from("CommunityQuest")
    .update({ [column]: new Date().toISOString() })
    .eq("id", eventId)
    .is(column, null)
    .select("id");
  if (error) {
    console.warn(`[communityEventScheduler] claim ${column} failed:`, error.message);
    return false;
  }
  return (data || []).length > 0;
}

async function claimProgressSlot(db: SupabaseClient, eventId: string, expected: number): Promise<boolean> {
  const { data, error } = await db
    .from("CommunityQuest")
    .update({ progress_notified_count: expected + 1 })
    .eq("id", eventId)
    .eq("progress_notified_count", expected)
    .select("id");
  if (error) {
    console.warn("[communityEventScheduler] claim progress failed:", error.message);
    return false;
  }
  return (data || []).length > 0;
}

async function processEvent(db: SupabaseClient, event: CommunityEvent, now: Date, force: boolean) {
  const actions: string[] = [];
  const start = new Date(event.start_date).getTime();
  const end = new Date(event.end_date).getTime();
  const nowMs = now.getTime();
  const canPush = force || isInsidePushWindow(now);

  if (nowMs < start) return actions;

  // 4. Finalize after end (never deferred) + result broadcast
  if (nowMs > end) {
    let finalized = event;
    if (!event.finalized_at) {
      const { data, error } = await db.rpc("finalize_community_quest", { p_quest_id: event.id, p_force: false });
      if (error) {
        console.error("[communityEventScheduler] finalize failed:", error.message);
        actions.push(`finalize_error:${error.message}`);
        return actions;
      }
      actions.push(`finalized:${JSON.stringify(data)}`);
      const { data: refreshed } = await db.from("CommunityQuest").select("*").eq("id", event.id).single();
      if (refreshed) finalized = refreshed as CommunityEvent;
    }
    // Skipped intermediate steps must not fire after the event ended.
    if (!finalized.start_notified_at) await claimTimestampFlag(db, event.id, "start_notified_at");
    if (!finalized.goal_notified_at) await claimTimestampFlag(db, event.id, "goal_notified_at");
    if (!finalized.end_notified_at && canPush && await claimTimestampFlag(db, event.id, "end_notified_at")) {
      const result = await broadcastPush(db, { ...buildEndCopy(finalized), tag: `community-event-end-${event.id}` });
      actions.push(`end_push:${JSON.stringify(result)}`);
    }
    return actions;
  }

  if (!canPush) return actions;

  // 1. Start
  if (!event.start_notified_at) {
    if (await claimTimestampFlag(db, event.id, "start_notified_at")) {
      const result = await broadcastPush(db, { ...buildStartCopy(event), tag: `community-event-start-${event.id}` });
      actions.push(`start_push:${JSON.stringify(result)}`);
    }
    // One push per run keeps the cadence friendly.
    return actions;
  }

  // 3. Goal reached (takes priority over progress updates)
  if (event.completed && !event.goal_notified_at) {
    if (await claimTimestampFlag(db, event.id, "goal_notified_at")) {
      const result = await broadcastPush(db, { ...buildGoalCopy(event), tag: `community-event-goal-${event.id}` });
      actions.push(`goal_push:${JSON.stringify(result)}`);
    }
    return actions;
  }

  // 2. Progress updates at ~1/3 and ~2/3 of the runtime
  const sentProgress = Number(event.progress_notified_count) || 0;
  if (sentProgress < 2) {
    const checkpoint = start + ((end - start) * (sentProgress + 1)) / 3;
    if (nowMs >= checkpoint && await claimProgressSlot(db, event.id, sentProgress)) {
      // Once the goal is reached the goal push already told everyone – skip silently.
      if (!event.completed) {
        const result = await broadcastPush(db, {
          ...buildProgressCopy(event),
          tag: `community-event-progress-${event.id}-${sentProgress + 1}`,
        });
        actions.push(`progress_push_${sentProgress + 1}:${JSON.stringify(result)}`);
      } else {
        actions.push(`progress_skip_${sentProgress + 1}`);
      }
    }
  }

  return actions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const originDenied = buildOriginDeniedResponse(req, corsHeaders, "communityEventScheduler");
  if (originDenied) return originDenied;

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const schedulerSecret = Deno.env.get("COMMUNITY_EVENT_SCHEDULER_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured: missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
  }

  const providedSecret = String(req.headers.get("x-community-event-secret") ?? "").trim();
  if (!schedulerSecret || !providedSecret || providedSecret !== schedulerSecret) {
    console.warn("[communityEventScheduler] Unauthorized call – secret mismatch");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let force = false;
  try {
    const body = await req.json() as { force?: boolean };
    force = body?.force === true;
  } catch {
    // empty body is fine
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const now = new Date();

  // Started events that still need a push, finalization or the result push.
  const { data: events, error } = await db
    .from("CommunityQuest")
    .select("*")
    .eq("is_event", true)
    .eq("is_active", true)
    .lte("start_date", now.toISOString())
    .or("finalized_at.is.null,end_notified_at.is.null");

  if (error) {
    console.error("[communityEventScheduler] Event query failed:", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const results: Record<string, string[]> = {};
  for (const event of (events || []) as CommunityEvent[]) {
    try {
      results[event.id] = await processEvent(db, event, now, force);
    } catch (err) {
      console.error("[communityEventScheduler] processEvent failed:", err);
      results[event.id] = [`error:${(err as Error).message}`];
    }
  }

  console.log("[communityEventScheduler] Done", results);
  return jsonResponse({ ok: true, now: now.toISOString(), results });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const BERLIN_TZ = "Europe/Berlin";
const SLOT_WINDOWS = {
  midday: { hour: 12 },
  evening: { hour: 18 },
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-quiz-scheduler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SlotType = "midday" | "evening";

type SchedulerBody = {
  slotType?: SlotType;
  forceNow?: boolean;
};

type DiscoveryRow = {
  id: string;
  plant_id: string | null;
  image_url: string | null;
  discovered_date: string | null;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeSlotType(value: unknown): SlotType | null {
  if (value === "midday" || value === "evening") {
    return value;
  }
  return null;
}

function getBerlinParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "00";

  const year = Number(getPart("year"));
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));
  const hour = Number(getPart("hour"));
  const minute = Number(getPart("minute"));
  const second = Number(getPart("second"));

  const dayKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, hour, minute, second, dayKey };
}

function toBerlinUtcDate(params: { year: number; month: number; day: number; hour: number; minute: number }): Date {
  const { year, month, day, hour, minute } = params;

  const isMatch = (candidate: Date): boolean => {
    const parts = getBerlinParts(candidate);
    return (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    );
  };

  // Europe/Berlin can be UTC+1 or UTC+2.
  const offsetCandidates = [1, 2];
  for (const offsetHours of offsetCandidates) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hour - offsetHours, minute, 0, 0));
    if (isMatch(candidate)) {
      return candidate;
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 1, minute, 0, 0));
}

function computeQuizProbability(scanCount: number): number {
  const safeScanCount = Math.max(0, Number(scanCount || 0));
  if (safeScanCount < 3) return 0;

  if (safeScanCount <= 10) {
    return Math.min(25, 15 + (safeScanCount - 3) * (10 / 7));
  }

  const exponent = 1 - Math.exp(-0.2 * (safeScanCount - 10));
  return Math.min(25, 20 + 5 * exponent);
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickDistinctRandom<T>(items: T[], amount: number): T[] {
  const copy = [...items];
  const result: T[] = [];
  while (copy.length > 0 && result.length < amount) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy[index]);
    copy.splice(index, 1);
  }
  return result;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function sendQuizNotification(
  adminClient: ReturnType<typeof createClient>,
  authId: string,
  userEmail: string | null,
  quizId: string,
): Promise<{ sent: boolean; error?: string }> {
  const payload = {
    authId,
    userEmail,
    notificationType: "quiz_available",
    title: "🤖 Florabot hat ein Quiz für dich!",
    message: "Meine Datenbank hat eine Lücke gefunden. Kannst du sie schließen? Ein neues Pflanzen-Quiz wartet auf dich.",
    actionUrl: "Home?quiz=open",
    displayLocation: "banner",
    priority: "high",
  };

  const invoke = await adminClient.functions.invoke("createNotification", {
    body: payload,
  });

  if (!invoke.error && invoke.data?.success) {
    return { sent: true };
  }

  const fallbackInsert = await adminClient
    .from("UserNotification")
    .insert({
      auth_id: authId,
      user_email: userEmail,
      notification_type: "quiz_available",
      title: payload.title,
      message: payload.message,
      action_url: payload.actionUrl,
      display_location: payload.displayLocation,
      priority: payload.priority,
      seen: false,
      created_by: "system",
      created_date: new Date().toISOString(),
    });

  if (fallbackInsert.error) {
    return {
      sent: false,
      error: invoke.error?.message || fallbackInsert.error.message || "notification failed",
    };
  }

  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "quizScheduler");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const schedulerSecret = Deno.env.get("QUIZ_SCHEDULER_SECRET") || "";
    if (!schedulerSecret) {
      return jsonResponse({ error: "QUIZ_SCHEDULER_SECRET missing" }, 500);
    }

    const providedSecret = String(req.headers.get("x-quiz-scheduler-secret") || "").trim();
    if (!providedSecret || providedSecret !== schedulerSecret) {
      return jsonResponse({ error: "Unauthorized scheduler trigger" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as SchedulerBody;
    const slotType = normalizeSlotType(body.slotType);
    const forceNow = body.forceNow === true;

    if (!slotType) {
      return jsonResponse({ error: "slotType must be 'midday' or 'evening'" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const berlinNow = getBerlinParts(now);
    const slotConfig = SLOT_WINDOWS[slotType];
    const runKey = `${berlinNow.dayKey}:${slotType}`;

    let slotRoll = await adminClient
      .from("PlantQuizSlotRoll")
      .select("id, run_key, random_minute, scheduled_at, executed_at")
      .eq("run_key", runKey)
      .maybeSingle();

    if (slotRoll.error) {
      return jsonResponse({ error: `Slot roll lookup failed: ${slotRoll.error.message}` }, 500);
    }

    if (!slotRoll.data) {
      const randomMinute = randomIntInclusive(0, 59);
      const scheduledAt = toBerlinUtcDate({
        year: berlinNow.year,
        month: berlinNow.month,
        day: berlinNow.day,
        hour: slotConfig.hour,
        minute: randomMinute,
      }).toISOString();

      const inserted = await adminClient
        .from("PlantQuizSlotRoll")
        .insert({
          slot_date: berlinNow.dayKey,
          slot_type: slotType,
          run_key: runKey,
          random_minute: randomMinute,
          scheduled_at: scheduledAt,
        })
        .select("id, run_key, random_minute, scheduled_at, executed_at")
        .single();

      if (inserted.error) {
        return jsonResponse({ error: `Slot roll insert failed: ${inserted.error.message}` }, 500);
      }

      slotRoll = { data: inserted.data, error: null } as typeof slotRoll;
    }

    const slotData = slotRoll.data;
    if (!slotData) {
      return jsonResponse({ error: "Slot roll not available" }, 500);
    }

    const scheduledAtMs = new Date(slotData.scheduled_at).getTime();
    const nowMs = now.getTime();

    if (!forceNow && nowMs < scheduledAtMs) {
      return jsonResponse({
        success: true,
        status: "pending",
        runKey,
        scheduledAt: slotData.scheduled_at,
        now: now.toISOString(),
      });
    }

    const claimExecution = await adminClient
      .from("PlantQuizSlotRoll")
      .update({ executed_at: now.toISOString() })
      .eq("run_key", runKey)
      .is("executed_at", null)
      .lte("scheduled_at", forceNow ? new Date(nowMs + 1).toISOString() : now.toISOString())
      .select("id")
      .maybeSingle();

    if (claimExecution.error) {
      return jsonResponse({ error: `Failed to claim execution: ${claimExecution.error.message}` }, 500);
    }

    if (!claimExecution.data) {
      return jsonResponse({
        success: true,
        status: "already_executed_or_not_due",
        runKey,
      });
    }

    const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: profiles, error: profilesError }, { data: openQuizzes, error: openError }] = await Promise.all([
      adminClient
        .from("PublicProfile")
        .select("auth_id, user_email")
        .not("auth_id", "is", null),
      adminClient
        .from("PlantQuiz")
        .select("auth_id")
        .eq("status", "open"),
    ]);

    if (profilesError) {
      return jsonResponse({ error: `Failed to fetch profiles: ${profilesError.message}` }, 500);
    }

    if (openError) {
      return jsonResponse({ error: `Failed to fetch open quizzes: ${openError.message}` }, 500);
    }

    const openAuthSet = new Set((openQuizzes || []).map((row) => row.auth_id));
    const dailyQuizzesResult = await adminClient
      .from("PlantQuiz")
      .select("auth_id")
      .eq("scheduled_slot_date", berlinNow.dayKey);

    if (dailyQuizzesResult.error) {
      return jsonResponse({ error: `Failed to fetch daily quizzes: ${dailyQuizzesResult.error.message}` }, 500);
    }

    const dailyQuizAuthSet = new Set((dailyQuizzesResult.data || []).map((row) => row.auth_id));
    const profileRows = profiles || [];

    let createdCount = 0;
    let skippedOpenSlot = 0;
    let skippedInsufficientScans = 0;
    let rolledOut = 0;
    let notificationFailures = 0;

    for (const profile of profileRows) {
      const authId = String(profile.auth_id || "").trim();
      const userEmail = profile.user_email || null;
      if (!authId) continue;

      if (dailyQuizAuthSet.has(authId)) {
        continue;
      }

      if (openAuthSet.has(authId)) {
        skippedOpenSlot += 1;
        continue;
      }

      const discoveriesResult = await adminClient
        .from("UserPlantDiscovery")
        .select("id, plant_id, image_url, discovered_date")
        .eq("auth_id", authId)
        .gte("discovered_date", sevenDaysAgo)
        .order("discovered_date", { ascending: false })
        .limit(250);

      if (discoveriesResult.error) {
        continue;
      }

      const discoveries = (discoveriesResult.data || []) as DiscoveryRow[];
      const discoveriesWithPlant = discoveries.filter((row) => row.plant_id);
      const uniquePlantIds = Array.from(new Set(discoveriesWithPlant.map((row) => String(row.plant_id))));

      if (discoveriesWithPlant.length < 3 || uniquePlantIds.length < 3) {
        skippedInsufficientScans += 1;
        continue;
      }

      const probability = computeQuizProbability(discoveriesWithPlant.length);
      const roll = Math.random() * 100;
      if (roll >= probability) {
        rolledOut += 1;
        continue;
      }

      const excludedResult = await adminClient
        .from("PlantQuizExcludedDiscovery")
        .select("discovery_id")
        .eq("auth_id", authId);

      if (excludedResult.error) {
        continue;
      }

      const excludedSet = new Set((excludedResult.data || []).map((row) => row.discovery_id));
      const candidates = discoveriesWithPlant.filter((row) => !excludedSet.has(row.id));
      if (candidates.length === 0) {
        continue;
      }

      // Lade alle Pflanzendaten (ID und Kategorie)
      const plantsResult = await adminClient
        .from("Plant")
        .select("id, genus_category")
        .in("id", uniquePlantIds);

      if (plantsResult.error || !plantsResult.data) {
        continue;
      }

      const plantsMap = new Map(
        plantsResult.data.map((p: any) => [String(p.id), String(p.genus_category || "").trim()]),
      );

      const eligibleCandidates = candidates.filter((candidate) => {
        const correctPlantId = String(candidate.plant_id);
        const correctCategory = plantsMap.get(correctPlantId);
        if (!correctCategory) {
          return false;
        }
        
        // Finde Distraktoren aus der gleichen Kategorie
        const distractorPlantIds = uniquePlantIds.filter(
          (plantId) => plantId !== correctPlantId && plantsMap.get(plantId) === correctCategory
        );
        return distractorPlantIds.length >= 2;
      });

      if (eligibleCandidates.length === 0) {
        continue;
      }

      const selectedDiscovery = pickRandom(eligibleCandidates);
      const correctPlantId = String(selectedDiscovery.plant_id);
      const correctCategory = plantsMap.get(correctPlantId);
      if (!correctCategory) {
        continue;
      }
      
      const distractorPool = uniquePlantIds.filter(
        (plantId) => plantId !== correctPlantId && plantsMap.get(plantId) === correctCategory
      );
      const distractors = pickDistinctRandom(distractorPool, 2);
      if (distractors.length < 2) {
        continue;
      }

      const optionPlantIds = shuffle([correctPlantId, ...distractors]);

      const insertQuiz = await adminClient
        .from("PlantQuiz")
        .insert({
          auth_id: authId,
          source_discovery_id: selectedDiscovery.id,
          correct_plant_id: correctPlantId,
          option_plant_ids: optionPlantIds,
          status: "open",
          wrong_attempts: 0,
          max_attempts: 3,
          scheduled_slot_date: berlinNow.dayKey,
          scheduled_slot_type: slotType,
          scheduled_at: slotData.scheduled_at,
        })
        .select("id")
        .single();

      if (insertQuiz.error) {
        if (insertQuiz.error.code === "23505") {
          // open slot occupied concurrently
          continue;
        }
        continue;
      }

      createdCount += 1;
      openAuthSet.add(authId);
      dailyQuizAuthSet.add(authId);

      const quizId = String(insertQuiz.data?.id || "");
      const notification = await sendQuizNotification(adminClient, authId, userEmail, quizId);
      if (!notification.sent) {
        notificationFailures += 1;
      }

      await adminClient
        .from("PlantQuiz")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", quizId);
    }

    return jsonResponse({
      success: true,
      status: "executed",
      runKey,
      slotType,
      scheduledAt: slotData.scheduled_at,
      metrics: {
        profilesTotal: profileRows.length,
        createdCount,
        skippedOpenSlot,
        skippedInsufficientScans,
        rolledOut,
        notificationFailures,
      },
    });
  } catch (error) {
    console.error("[quizScheduler] unexpected error", error);
    return jsonResponse({ error: String(error?.message || error || "Unknown error") }, 500);
  }
});

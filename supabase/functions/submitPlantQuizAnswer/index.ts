import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubmitBody = {
  quizId?: string;
  selectedPlantId?: string;
};

type RewardPlan = {
  seeds: number;
  dataQuality: number;
  resolved: boolean;
  consolation: boolean;
};

const REWARDS_BY_WRONG_ATTEMPTS: Record<number, RewardPlan> = {
  0: { seeds: 250, dataQuality: 5, resolved: true, consolation: false },
  1: { seeds: 125, dataQuality: 3, resolved: true, consolation: false },
  2: { seeds: 66, dataQuality: 1, resolved: true, consolation: false },
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "submitPlantQuizAnswer");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    const accessToken = getAccessTokenFromAuthHeader(req.headers.get("Authorization"));
    if (!accessToken) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    const authUser = authData?.user;
    if (authError || !authUser?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as SubmitBody;
    const quizId = String(body.quizId || "").trim();
    const selectedPlantId = String(body.selectedPlantId || "").trim();

    if (!quizId || !selectedPlantId) {
      return jsonResponse({ error: "quizId and selectedPlantId are required" }, 400);
    }

    const quizResult = await adminClient
      .from("PlantQuiz")
      .select("id, auth_id, source_discovery_id, correct_plant_id, status, wrong_attempts")
      .eq("id", quizId)
      .maybeSingle();

    if (quizResult.error) {
      return jsonResponse({ error: quizResult.error.message }, 500);
    }

    const quiz = quizResult.data;
    if (!quiz) {
      return jsonResponse({ error: "Quiz not found" }, 404);
    }

    if (quiz.auth_id !== authUser.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (quiz.status !== "open") {
      return jsonResponse({
        success: true,
        alreadyResolved: true,
        status: quiz.status,
        wrongAttempts: Number(quiz.wrong_attempts || 0),
      });
    }

    const wrongAttempts = Math.max(0, Number(quiz.wrong_attempts || 0));
    const isCorrect = String(quiz.correct_plant_id) === selectedPlantId;

    if (isCorrect) {
      const rewardPlan = REWARDS_BY_WRONG_ATTEMPTS[Math.min(2, wrongAttempts)] || REWARDS_BY_WRONG_ATTEMPTS[2];
      const eventReference = `plantquiz:${quizId}:correct:${Math.min(2, wrongAttempts)}`;

      const rewardRpc = await adminClient.rpc("robot_plant_grant_reward", {
        p_auth_id: authUser.id,
        p_event_source: "quiz",
        p_event_reference: eventReference,
        p_amount: rewardPlan.seeds,
        p_energy_delta: 0,
        p_data_quality_delta: rewardPlan.dataQuality,
        p_care_delta: 0,
        p_metadata: {
          source: "plant_quiz",
          quizId,
          wrongAttemptsBeforeCorrect: wrongAttempts,
        },
      });

      if (rewardRpc.error) {
        return jsonResponse({ error: `Reward failed: ${rewardRpc.error.message}` }, 500);
      }

      const updateQuiz = await adminClient
        .from("PlantQuiz")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          reward_seeds: rewardPlan.seeds,
          reward_data_quality: rewardPlan.dataQuality,
        })
        .eq("id", quizId);

      if (updateQuiz.error) {
        return jsonResponse({ error: `Quiz update failed: ${updateQuiz.error.message}` }, 500);
      }

      await adminClient
        .from("PlantQuizExcludedDiscovery")
        .upsert({
          auth_id: authUser.id,
          discovery_id: quiz.source_discovery_id,
        }, { onConflict: "auth_id,discovery_id", ignoreDuplicates: true });

      return jsonResponse({
        success: true,
        correct: true,
        resolved: true,
        rewardSeeds: rewardPlan.seeds,
        rewardDataQuality: rewardPlan.dataQuality,
        wrongAttempts,
      });
    }

    // Bei falscher Antwort: Quiz sofort abbrechen, kein Reward
    const abortQuiz = await adminClient
      .from("PlantQuiz")
      .update({
        status: "resolved",
        wrong_attempts: wrongAttempts + 1,
        resolved_at: new Date().toISOString(),
        reward_seeds: 0,
        reward_data_quality: 0,
      })
      .eq("id", quizId);

    if (abortQuiz.error) {
      return jsonResponse({ error: `Quiz abort failed: ${abortQuiz.error.message}` }, 500);
    }

    return jsonResponse({
      success: true,
      correct: false,
      resolved: true,
      aborted: true,
      wrongAttempts: wrongAttempts + 1,
      encouragementMessage: "Viel Glück beim nächsten Mal!",
    });
  } catch (error) {
    console.error("[submitPlantQuizAnswer] unexpected error", error);
    return jsonResponse({ error: String(error?.message || error || "Unknown error") }, 500);
  }
});

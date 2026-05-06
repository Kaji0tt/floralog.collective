import { supabase } from "@/api/supabaseClient";

const isMissingTableError = (error) => {
  if (!error) return false;
  const lowerMessage = String(error.message || "").toLowerCase();
  return (
    error.code === "PGRST201" ||
    error.code === "42P01" ||
    lowerMessage.includes("does not exist") ||
    lowerMessage.includes("not found")
  );
};

export async function getOpenPlantQuiz(authId) {
  if (!authId) return null;

  const quizResult = await supabase
    .from("PlantQuiz")
    .select("id, auth_id, source_discovery_id, correct_plant_id, option_plant_ids, wrong_attempts, max_attempts, scheduled_slot_date, scheduled_slot_type, created_at")
    .eq("auth_id", authId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quizResult.error) {
    if (isMissingTableError(quizResult.error)) return null;
    throw quizResult.error;
  }

  const quiz = quizResult.data;
  if (!quiz) return null;

  const discoveryResult = await supabase
    .from("UserPlantDiscovery")
    .select("id, image_url, discovered_date, plant_id")
    .eq("id", quiz.source_discovery_id)
    .maybeSingle();

  if (discoveryResult.error && !isMissingTableError(discoveryResult.error)) {
    throw discoveryResult.error;
  }

  const optionIds = Array.isArray(quiz.option_plant_ids)
    ? quiz.option_plant_ids.map((value) => String(value)).filter(Boolean)
    : [];

  const allPlantIds = Array.from(new Set([quiz.correct_plant_id, ...optionIds].map((value) => String(value)).filter(Boolean)));

  let plantNameMap = new Map();
  if (allPlantIds.length > 0) {
    const plantsResult = await supabase
      .from("Plant")
      .select("id, species_name")
      .in("id", allPlantIds);

    if (plantsResult.error && !isMissingTableError(plantsResult.error)) {
      throw plantsResult.error;
    }

    plantNameMap = new Map((plantsResult.data || []).map((plant) => [String(plant.id), plant.species_name || "Unbekannte Pflanze"]));
  }

  const options = optionIds.map((plantId) => ({
    plantId,
    label: plantNameMap.get(plantId) || "Unbekannte Pflanze",
  }));

  return {
    id: quiz.id,
    sourceDiscoveryId: quiz.source_discovery_id,
    correctPlantId: String(quiz.correct_plant_id),
    wrongAttempts: Math.max(0, Number(quiz.wrong_attempts || 0)),
    maxAttempts: Math.max(1, Number(quiz.max_attempts || 3)),
    createdAt: quiz.created_at,
    scheduledSlotDate: quiz.scheduled_slot_date,
    scheduledSlotType: quiz.scheduled_slot_type,
    imageUrl: discoveryResult.data?.image_url || "",
    discoveryDate: discoveryResult.data?.discovered_date || null,
    options,
  };
}

export async function submitPlantQuizAnswer({ quizId, selectedPlantId }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const invokeOptions = {
    body: {
      quizId,
      selectedPlantId,
    },
  };

  if (session?.access_token) {
    invokeOptions.headers = {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  const { data, error } = await supabase.functions.invoke("submitPlantQuizAnswer", invokeOptions);
  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Antwort konnte nicht verarbeitet werden");
  }

  return data;
}

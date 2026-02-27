import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[generatePlantMetadata] Function loaded successfully");

type GeneratePlantMetadataBody = {
  plant_id: string;
  species_name: string | null;
  scientific_name: string | null;
  language?: string | null;
};

type LlmResponse = {
  description: string;
  identification_features: string[];
  fun_fact: string;
};

Deno.serve(async (req) => {
  console.log("[generatePlantMetadata] === REQUEST RECEIVED ===");
  console.log("[generatePlantMetadata] Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[generatePlantMetadata] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[generatePlantMetadata] Missing Supabase service env vars");
      return new Response(
        JSON.stringify({ error: "Supabase service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!openAiKey) {
      console.error("[generatePlantMetadata] Missing OPENAI_API_KEY env var");
      return new Response(
        JSON.stringify({ error: "LLM provider not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as GeneratePlantMetadataBody;
    const { plant_id, species_name, scientific_name } = body;
    const language = body.language || "de";

    if (!plant_id) {
      return new Response(
        JSON.stringify({ error: "plant_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("[generatePlantMetadata] Generating metadata for plant:", plant_id, species_name, scientific_name);

    const commonName = species_name || "unbekannter Name";
    const sciName = scientific_name || "unbekannter wissenschaftlicher Name";

    const prompt = `Pflanze: "${commonName}"
Wissenschaftlicher Name: "${sciName}"
Sprache: ${language}

Erzeuge:
- description (2–3 Sätze)
- identification_features (3–5 Stichpunkte)
- fun_fact (1 Satz)`;

    let llmResult: LlmResponse | null = null;

    try {
      console.log("[generatePlantMetadata] Calling OpenAI (responses API)...");

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          temperature: 0.4,
          max_output_tokens: 500,
          input: [
            {
              role: "system",
              content: "Du erstellst kurze, kindergerechte aber sachliche Pflanzen-Texte für eine Natur-App.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "plant_metadata",
              schema: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  identification_features: {
                    type: "array",
                    items: { type: "string" },
                  },
                  fun_fact: { type: "string" },
                },
                required: ["description", "identification_features", "fun_fact"],
              },
            },
          },
        }),
      });

      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        console.error("[generatePlantMetadata] OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${openAiResponse.status}`);
      }

      const openAiJson = await openAiResponse.json();
      llmResult = openAiJson?.output_parsed as LlmResponse | null;

      if (!llmResult || !llmResult.description || !llmResult.identification_features || !llmResult.fun_fact) {
        throw new Error("Incomplete LLM result");
      }
    } catch (llmError) {
      console.error("[generatePlantMetadata] LLM call failed:", llmError);
      return new Response(
        JSON.stringify({ error: "LLM call failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("[generatePlantMetadata] LLM result received, updating Plant row...");

    const identificationFeaturesText = Array.isArray(llmResult.identification_features)
      ? llmResult.identification_features.join("\n- ")
      : String(llmResult.identification_features);

    const { error: updateError } = await adminClient
      .from("Plant")
      .update({
        description: llmResult.description,
        identification_features: `- ${identificationFeaturesText}`,
        fun_fact: llmResult.fun_fact,
      })
      .eq("id", plant_id);

    if (updateError) {
      console.error("[generatePlantMetadata] Failed to update Plant row:", updateError);
      return new Response(
        JSON.stringify({ error: "Update failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("[generatePlantMetadata] Metadata successfully updated for plant", plant_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[generatePlantMetadata] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

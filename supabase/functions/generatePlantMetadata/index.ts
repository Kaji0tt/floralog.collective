import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[generatePlantMetadata] Function loaded successfully");

type GeneratePlantMetadataBody = {
  plant_id?: string | null;
  species_name: string | null;
  scientific_name: string | null;
  language?: string | null;
  include_openai?: boolean | null;
};

type LlmResponse = {
  description: string;
  identification_features: string[];
  fun_fact: string;
  rarity: string;
  is_european: boolean;
  genus_name: string;
  category: string;
};

type NaturaDbEcology = {
  wild_bees_count: number | null;
  butterflies_count: number | null;
  caterpillars_count: number | null;
  hoverflies_count: number | null;
  beetles_count: number | null;
  red_list_threat: string | null;
  red_list_population: string | null;
  nectar_value: string | null;
  pollen_value: string | null;
  naturadb_url: string | null;
};

const NATURADB_BASE_URL = "https://www.naturadb.de/pflanzen/";

const SLEEP_MS = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeSlug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const cleanText = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const cleaned = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&szlig;/gi, "ß")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

const extractCount = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractLabelValue = (text: string, labels: string[], stopLabels: string[]): string | null => {
  const lowerText = text.toLowerCase();
  let labelIndex = -1;
  let matchedLabel = "";

  for (const label of labels) {
    const idx = lowerText.indexOf(label.toLowerCase());
    if (idx >= 0 && (labelIndex === -1 || idx < labelIndex)) {
      labelIndex = idx;
      matchedLabel = label;
    }
  }

  if (labelIndex < 0) return null;

  const from = labelIndex + matchedLabel.length;
  const window = text.slice(from, from + 220);
  const lowerWindow = window.toLowerCase();

  let stopIndex = lowerWindow.length;
  for (const stopLabel of stopLabels) {
    const idx = lowerWindow.indexOf(stopLabel.toLowerCase());
    if (idx >= 0 && idx < stopIndex) {
      stopIndex = idx;
    }
  }

  const raw = window.slice(0, stopIndex).replace(/^\s*:?\s*/, "");
  return cleanText(raw);
};

const extractNaturaDbEcology = (rawHtml: string, naturadbUrl: string): NaturaDbEcology => {
  const withoutScripts = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopLabels = [
    "wildbienen",
    "schmetterlinge",
    "raupen",
    "schwebfliegen",
    "käfer",
    "gefahrdung",
    "gefährdung",
    "bestandssituation",
    "nektarwert",
    "pollenwert",
    "was sagen mir die daten",
    "einheimische verbreitung",
  ];

  const wildBeesRaw = extractLabelValue(text, ["Wildbienen"], stopLabels);
  const butterfliesRaw = extractLabelValue(text, ["Schmetterlinge"], stopLabels);
  const caterpillarsRaw = extractLabelValue(text, ["Raupen"], stopLabels);
  const hoverfliesRaw = extractLabelValue(text, ["Schwebfliegen", "Schwebfliegen"], stopLabels);
  const beetlesRaw = extractLabelValue(text, ["Käfer", "Kafer"], stopLabels);
  const threatRaw = extractLabelValue(text, ["Gefährdung (Rote Liste)", "Gefahrdung (Rote Liste)"], stopLabels);
  const populationRaw = extractLabelValue(text, ["Bestandssituation (Rote Liste)"], stopLabels);
  const nectarRaw = extractLabelValue(text, ["Nektarwert"], stopLabels);
  const pollenRaw = extractLabelValue(text, ["Pollenwert"], stopLabels);

  return {
    wild_bees_count: extractCount(wildBeesRaw),
    butterflies_count: extractCount(butterfliesRaw),
    caterpillars_count: extractCount(caterpillarsRaw),
    hoverflies_count: extractCount(hoverfliesRaw),
    beetles_count: extractCount(beetlesRaw),
    red_list_threat: cleanText(threatRaw),
    red_list_population: cleanText(populationRaw),
    nectar_value: cleanText(nectarRaw),
    pollen_value: cleanText(pollenRaw),
    naturadb_url: naturadbUrl,
  };
};

const fetchNaturaDbEcology = async (
  scientificName: string | null,
): Promise<NaturaDbEcology | null> => {
  if (!scientificName) return null;

  const slug = normalizeSlug(scientificName);
  if (!slug) return null;

  const naturadbUrl = `${NATURADB_BASE_URL}${slug}/`;

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(naturadbUrl, {
      headers: {
        "User-Agent": "floralog-ecology-backfill/1.0",
      },
    });

    if (response.ok) {
      const html = await response.text();
      return extractNaturaDbEcology(html, naturadbUrl);
    }

    if (response.status === 404) {
      return null;
    }

    if (response.status === 429 || response.status >= 500) {
      const delayMs = (2 ** attempt) * 700 + Math.floor(Math.random() * 300);
      await SLEEP_MS(delayMs);
      continue;
    }

    return null;
  }

  return null;
};

Deno.serve(async (req) => {
  console.log("[generatePlantMetadata] === REQUEST RECEIVED ===");
  console.log("[generatePlantMetadata] Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[generatePlantMetadata] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "generatePlantMetadata");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      console.error("[generatePlantMetadata] Missing OPENAI_API_KEY env var");
      return new Response(
        JSON.stringify({ error: "LLM provider not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const body = (await req.json()) as GeneratePlantMetadataBody;
    const { species_name, scientific_name } = body;
    const language = body.language || "de";
    const includeOpenAi = body.include_openai !== false;

    console.log("[generatePlantMetadata] Generating metadata for plant name:", species_name, scientific_name);

    const commonName = species_name || "unbekannter Name";
    const sciName = scientific_name || "unbekannter wissenschaftlicher Name";

    const prompt = `Pflanze: "${commonName}"
  Wissenschaftlicher Name: "${sciName}"
  Sprache: ${language}

  Erzeuge eine kurze JSON-Antwort mit folgendem Schema.
  Halte alle Texte insgesamt unter 150 Wörtern.

  Felder:
  - description: 2–3 sehr kurze Sätze.
  - identification_features: 2-3 Sätze zu den wichtigsten Erkennungsmerkmalen.
  - fun_fact: genau 1 kurzer Satz.
  - rarity: genau eines der Wörter "Häufig", "Gelegentlich", "Selten", "Sehr selten".
  - is_european: boolean, true NUR wenn die Art ursprünglich aus Europa stammt oder heute in Europa heimisch/natürlichisiert ist. Bei Unsicherheit immer false.
  - genus_name: der deutsche Gattungsname (z. B. "Glockenblume" für Campanula, "Rose" für Rosa). Falls kein gebräuchlicher deutscher Gattungsname existiert, verwende den wissenschaftlichen Gattungsnamen.
  - category: genau eines der Wörter "Bäume", "Sträucher", "Blumen". Wähle "Bäume" für verholzte Pflanzen mit einem Stamm (z. B. Eiche, Birke, Fichte). Wähle "Sträucher" für verholzte Pflanzen mit mehreren Trieben ohne klaren Hauptstamm (z. B. Holunder, Weißdorn, Hasel). Wähle "Blumen" für krautige Pflanzen, Wildblumen, Kräuter und Gräser (z. B. Glockenblume, Schafgarbe, Löwenzahn).`;

    let llmResult: LlmResponse | null = null;

    let ecology: NaturaDbEcology | null = null;
    try {
      ecology = await fetchNaturaDbEcology(scientific_name);
    } catch (ecologyError) {
      console.warn("[generatePlantMetadata] NaturaDB fetch failed, continuing with null ecology:", ecologyError);
    }

    if (includeOpenAi) {
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
          text: {
            format: {
              type: "json_schema",
              name: "plant_metadata",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  description: { type: "string" },
                  identification_features: {
                    type: "array",
                    items: { type: "string" },
                  },
                  fun_fact: { type: "string" },
                  rarity: {
                    type: "string",
                    enum: ["Häufig", "Gelegentlich", "Selten", "Sehr selten"],
                  },
                  is_european: {
                    type: "boolean",
                  },
                  genus_name: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["Bäume", "Sträucher", "Blumen"],
                  },
                },
                required: [
                  "description",
                  "identification_features",
                  "fun_fact",
                  "rarity",
                  "is_european",
                  "genus_name",
                  "category",
                ],
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
      console.log("[generatePlantMetadata] Raw OpenAI response (truncated):", JSON.stringify(openAiJson).slice(0, 500));

      // Prefer the SDK-like helper shape if present
      const helperParsed = (openAiJson as any).output_parsed as LlmResponse | undefined;

      if (
        helperParsed &&
        helperParsed.description &&
        Array.isArray(helperParsed.identification_features) &&
        helperParsed.fun_fact &&
        helperParsed.rarity &&
        typeof helperParsed.is_european === "boolean" &&
        typeof helperParsed.genus_name === "string" && helperParsed.genus_name &&
        typeof helperParsed.category === "string" && helperParsed.category
      ) {
        llmResult = helperParsed;
      } else {
        // Fallback: extract JSON text from the first message item and parse manually
        try {
          const outputItems = (openAiJson as any).output as any[] | undefined;
          const messageItem = outputItems?.find((item) => item.type === "message");
          const contentArray = messageItem?.content as any[] | undefined;
          const textContent = contentArray?.find((c) => c.type === "output_text");
          const text = textContent?.text as string | undefined;

          if (text) {
            const parsed = JSON.parse(text) as LlmResponse;
            if (
              parsed &&
              parsed.description &&
              Array.isArray(parsed.identification_features) &&
              parsed.fun_fact &&
              parsed.rarity &&
              typeof parsed.is_european === "boolean" &&
              typeof parsed.genus_name === "string" && parsed.genus_name &&
              typeof parsed.category === "string" && parsed.category
            ) {
              llmResult = parsed;
            }
          }
        } catch (parseError) {
          console.error("[generatePlantMetadata] Failed to parse JSON from output_text:", parseError);
        }
      }

      if (!llmResult) {
        console.error("[generatePlantMetadata] Incomplete LLM result payload:", JSON.stringify(openAiJson).slice(0, 500));
        throw new Error("Incomplete LLM result");
      }
      } catch (llmError) {
        console.error("[generatePlantMetadata] LLM call failed:", llmError);
        return new Response(
          JSON.stringify({ error: "LLM call failed" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    if (!includeOpenAi) {
      return new Response(
        JSON.stringify({
          wild_bees_count: ecology?.wild_bees_count ?? null,
          butterflies_count: ecology?.butterflies_count ?? null,
          caterpillars_count: ecology?.caterpillars_count ?? null,
          hoverflies_count: ecology?.hoverflies_count ?? null,
          beetles_count: ecology?.beetles_count ?? null,
          red_list_threat: ecology?.red_list_threat ?? null,
          red_list_population: ecology?.red_list_population ?? null,
          nectar_value: ecology?.nectar_value ?? null,
          pollen_value: ecology?.pollen_value ?? null,
          naturadb_url: ecology?.naturadb_url ?? null,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("[generatePlantMetadata] LLM result received, returning metadata preview...");

    return new Response(
      JSON.stringify({
        description: llmResult.description,
        identification_features: llmResult.identification_features,
        fun_fact: llmResult.fun_fact,
        rarity: llmResult.rarity,
        is_european: llmResult.is_european,
        genus_name: llmResult.genus_name,
        category: llmResult.category,
        wild_bees_count: ecology?.wild_bees_count ?? null,
        butterflies_count: ecology?.butterflies_count ?? null,
        caterpillars_count: ecology?.caterpillars_count ?? null,
        hoverflies_count: ecology?.hoverflies_count ?? null,
        beetles_count: ecology?.beetles_count ?? null,
        red_list_threat: ecology?.red_list_threat ?? null,
        red_list_population: ecology?.red_list_population ?? null,
        nectar_value: ecology?.nectar_value ?? null,
        pollen_value: ecology?.pollen_value ?? null,
        naturadb_url: ecology?.naturadb_url ?? null,
      }),
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

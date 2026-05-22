import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenerateBotNameBody = {
  displayName?: string | null;
  storyContext?: string | null;
};

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

function normalizeBotName(rawValue: string): string {
  return String(rawValue || "")
    .replace(/[^A-Za-z\u00C0-\u017F\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "generateBotName");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = getAccessTokenFromAuthHeader(req.headers.get("Authorization"));
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as GenerateBotNameBody;
    const displayName = String(body?.displayName || "").trim();
    const storyContext = String(body?.storyContext || "").trim();

    const ownerName = displayName || "(nicht gesetzt)";

    const userPrompt = `Spielername: ${ownerName}
Kontext: ${
      storyContext ||
      "Florabot ist ein neugieriger, freundlicher KI-Begleiter in einer Natur-Entdecker-App. Er hilft beim Erfassen und Verstehen von Pflanzen."
    }

  Dieser Florabot soll der Begleiter von ${ownerName} werden und stilistisch zu diesem Namen passen.

Erzeuge einen einzigen passenden Bot-Namen.
Regeln:
  - Name muss zum Stil/Klang des Spielernamens passen, aber NICHT identisch mit dem Spielername sein.
- Muss freundlich, einpraegsam, naturverbunden und leicht aussprechbar sein.
- 1 Wort, 4 bis 12 Zeichen.
- Keine Zahlen, keine Sonderzeichen, kein Titel, kein Satzzeichen.
- Gib nur JSON im geforderten Format aus.`;

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
            content: "Du bist ein Naming-Assistant fuer einen freundlich-neugierigen Natur-Bot.",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "bot_name_result",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                bot_name: { type: "string" },
              },
              required: ["bot_name"],
            },
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      return new Response(JSON.stringify({ error: `OpenAI API error: ${errorText}` }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const openAiJson = await openAiResponse.json();
    let generatedName = (openAiJson as { output_parsed?: { bot_name?: string } })?.output_parsed?.bot_name || "";

    if (!generatedName) {
      try {
        const outputItems = (openAiJson as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output;
        const messageItem = outputItems?.find((item) => item?.type === "message");
        const outputText = messageItem?.content?.find((item) => item?.type === "output_text")?.text || "";
        if (outputText) {
          generatedName = (JSON.parse(outputText) as { bot_name?: string }).bot_name || "";
        }
      } catch {
        // ignored; handled by validation below
      }
    }

    const botName = normalizeBotName(generatedName);
    if (!botName || botName.length < 4) {
      return new Response(JSON.stringify({ error: "Model returned invalid bot name" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ bot_name: botName }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

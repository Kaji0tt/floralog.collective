import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildOriginDeniedResponse } from "../_shared/origin.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

console.log("[identifyPlant] Function loaded successfully")

Deno.serve(async (req) => {
  console.log("[identifyPlant] === REQUEST RECEIVED ===")
  console.log("[identifyPlant] Method:", req.method)

  if (req.method === "OPTIONS") {
    console.log("[identifyPlant] Handling OPTIONS request")
    return new Response(null, { headers: corsHeaders })
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "identifyPlant")
  if (originDeniedResponse) {
    return originDeniedResponse
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[identifyPlant] Missing Supabase env vars")
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.warn("[identifyPlant] Unauthorized request", authError)
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    const body = await req.json()
    const rawImageUrls: unknown = body.image_urls ?? (body.image_url ? [body.image_url] : [])
    const rawOrgans: unknown = body.organs ?? (body.organ ? [body.organ] : [])

    const imageUrls = Array.isArray(rawImageUrls) ? rawImageUrls.filter((url) => typeof url === "string" && url) : []
    // Pad missing organ entries with "auto" so array lengths always match image count.
    const organs = imageUrls.map((_, index) =>
      Array.isArray(rawOrgans) && typeof rawOrgans[index] === "string" ? rawOrgans[index] : "auto",
    )

    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "image_urls required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    if (imageUrls.length > 5) {
      return new Response(
        JSON.stringify({ error: "Maximal 5 Bilder pro Identifikation erlaubt" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }

    console.log(`🌿 [identifyPlant] Starte PlantNet Identifikation mit ${imageUrls.length} Bild(ern), organs: ${organs.join(", ")}...`)

    try {
      const plantnetApiKey = Deno.env.get("PLANTNET_API_KEY")

      if (!plantnetApiKey) {
        throw new Error("PlantNet API Key nicht gesetzt")
      }

      const plantnetUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${plantnetApiKey}&lang=de`

      const formData = new FormData()

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i]
        console.log(`📥 [identifyPlant] Lade Bild ${i + 1}/${imageUrls.length} herunter von:`, imageUrl)
        const imageResponse = await fetch(imageUrl)

        if (!imageResponse.ok) {
          throw new Error(
            `Bild ${i + 1} konnte nicht geladen werden: ${imageResponse.status} ${imageResponse.statusText}`,
          )
        }

        const imageBlob = await imageResponse.blob()
        console.log(`✅ [identifyPlant] Bild ${i + 1} geladen, Größe:`, imageBlob.size, "bytes")

        formData.append("images", imageBlob, `plant-${i + 1}.jpg`)
        formData.append("organs", organs[i])
      }

      console.log("📤 [identifyPlant] Sende Anfrage an PlantNet...")
      const plantnetResponse = await fetch(plantnetUrl, {
        method: "POST",
        body: formData,
      })

      console.log("📥 [identifyPlant] PlantNet Response Status:", plantnetResponse.status)

      if (!plantnetResponse.ok) {
        const errorText = await plantnetResponse.text()
        console.warn("⚠️ [identifyPlant] PlantNet API Fehler:", errorText)

        if (
          plantnetResponse.status === 429 ||
          errorText.toLowerCase().includes("limit") ||
          errorText.toLowerCase().includes("quota")
        ) {
          throw new Error("PLANTNET_RATE_LIMIT")
        }

        if (plantnetResponse.status === 404) {
          console.log("⚠️ [identifyPlant] PlantNet konnte die Pflanze nicht identifizieren (404)")
          return new Response(
            JSON.stringify({
              identified: false,
              error: "PlantNet konnte die Pflanze nicht identifizieren.",
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          )
        }

        throw new Error(`PlantNet API Error: ${plantnetResponse.status}`)
      }

      const plantnetData = await plantnetResponse.json()
      console.log("✅ [identifyPlant] PlantNet Antwort:", JSON.stringify(plantnetData, null, 2))

      if (plantnetData.results && plantnetData.results.length > 0) {
        const allValidResults = plantnetData.results
          .filter((result: { score: number }) => result.score > 0.05)
          .slice(0, 5)

        if (allValidResults.length > 0) {
          console.log(
            `📊 [identifyPlant] ${allValidResults.length} Ergebnisse mit Score > 5% gefunden`,
          )

          const translatedResults = await Promise.all(
            allValidResults.map(async (result: any) => {
              const species = result.species
              const score = result.score

              const germanName =
                species.commonNames && species.commonNames.length > 0
                  ? species.commonNames[0]
                  : null

              const finalSpeciesName = germanName

              console.log(
                `🔍 [identifyPlant] PlantNet Name: "${finalSpeciesName || "nicht vorhanden"}" für ${
                  species.scientificNameWithoutAuthor
                } (${(score * 100).toFixed(1)}%)`,
              )

              const scientificName =
                species.scientificNameWithoutAuthor || species.scientificName || ""
              const scientificGenus = scientificName ? scientificName.split(" ")[0] : null
              const translatedSpeciesName = finalSpeciesName || scientificName || "Unbekannte Art"
              const words = translatedSpeciesName ? translatedSpeciesName.split(" ") : []
              const lastWord = words.at(-1) || null
              // Handle hyphenated compound names like "Wiesen-Glockenblume" → "Glockenblume"
              const genusNameFromCommon = lastWord?.includes("-")
                ? lastWord.split("-").pop() ?? lastWord
                : lastWord
              const genusName = genusNameFromCommon || scientificGenus

              return {
                species_name: translatedSpeciesName,
                genus_name: genusName || scientificGenus || "Unbekannte Gattung",
                scientific_name: scientificName || null,
                scientific_genus: scientificGenus || null,
                gbif_id: species?.gbif?.id ?? result?.gbif?.id ?? null,
                category: "Blumen",
                family: species.family?.scientificName || species.family?.name || null,
                description: null,
                identification_features: null,
                fun_fact: null,
                is_european: null,
                rarity: null,
                score: score,
                confidence_percentage: Math.round(score * 100),
              }
            }),
          )

          console.log("✅ [identifyPlant] Alle Übersetzungen abgeschlossen")

          return new Response(
            JSON.stringify({
              identified: true,
              source: "plantnet",
              results: translatedResults,
              primary_result: translatedResults[0],
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          )
        }
      }

      console.log("⚠️ [identifyPlant] PlantNet keine Ergebnisse gefunden")

      return new Response(
        JSON.stringify({
          identified: false,
          error: "PlantNet konnte die Pflanze nicht identifizieren.",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    } catch (plantnetError: any) {
      console.warn("⚠️ [identifyPlant] PlantNet fehlgeschlagen:", plantnetError?.message)

      if (plantnetError?.message === "PLANTNET_RATE_LIMIT") {
        return new Response(
          JSON.stringify({
            identified: false,
            error_type: "PLANTNET_RATE_LIMIT",
            error:
              "PlantNet hat die maximale Anzahl an Scans erreicht oder ist nicht erreichbar.",
          }),
          { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }

      return new Response(
        JSON.stringify({
          identified: false,
          error: `PlantNet Fehler: ${plantnetError?.message ?? String(plantnetError)}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }
  } catch (error: any) {
    console.error("💥 [identifyPlant] Unerwarteter Fehler:", error)
    return new Response(
      JSON.stringify({ error: error?.message ?? String(error), identified: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }
})

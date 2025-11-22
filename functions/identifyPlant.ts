import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
//Test Deployment
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { image_url, organ = "auto" } = await req.json();
        
        if (!image_url) {
            return Response.json({ error: 'image_url required' }, { status: 400 });
        }

        console.log(`🌿 Starte PlantNet Identifikation mit organ: ${organ}...`);

        // Versuch 1: PlantNet API
        try {
            const plantnetApiKey = Deno.env.get("PLANTNET_API_KEY");
            
            if (!plantnetApiKey) {
                throw new Error("PlantNet API Key nicht gesetzt");
            }

            const plantnetUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${plantnetApiKey}`;
            
            const formData = new FormData();
            
            // Lade Bild herunter und füge zu FormData hinzu
            const imageResponse = await fetch(image_url);
            const imageBlob = await imageResponse.blob();
            formData.append('images', imageBlob, 'plant.jpg');
            formData.append('organs', organ);

            const plantnetResponse = await fetch(plantnetUrl, {
                method: 'POST',
                body: formData
            });

            if (!plantnetResponse.ok) {
                const errorText = await plantnetResponse.text();
                console.warn("⚠️ PlantNet API Fehler:", errorText);
                throw new Error(`PlantNet API Error: ${plantnetResponse.status}`);
            }

            const plantnetData = await plantnetResponse.json();
            console.log("✅ PlantNet Antwort:", JSON.stringify(plantnetData, null, 2));

            // Prüfe ob PlantNet ein Ergebnis gefunden hat
            if (plantnetData.results && plantnetData.results.length > 0) {
                const topResult = plantnetData.results[0];
                const topScore = topResult.score;

                // Nur wenn Score > 0.3 (30%) akzeptieren wir das Ergebnis
                if (topScore > 0.3) {
                    // Sammle alle Ergebnisse mit Score > 5%
                    const allValidResults = plantnetData.results
                        .filter(result => result.score > 0.05)
                        .slice(0, 5); // Max 5 Ergebnisse
                    
                    console.log(`📊 ${allValidResults.length} Ergebnisse mit Score > 5% gefunden`);
                    
                    // Übersetze alle Ergebnisse zu Deutsch
                    const translatedResults = await Promise.all(
                        allValidResults.map(async (result) => {
                            const species = result.species;
                            const score = result.score;
                            
                            // Hole deutschen Namen von PlantNet
                            const germanName = species.commonNames?.find(name => name.toLowerCase().includes('de'))?.split('(')[0]?.trim() || null;
                            
                            console.log(`🔍 PlantNet deutscher Name: ${germanName || 'nicht gefunden'} für ${species.scientificNameWithoutAuthor} (${(score * 100).toFixed(1)}%)...`);
                            
                            const llmEnrichment = await base44.asServiceRole.integrations.Core.InvokeLLM({
                                prompt: `Die Pflanze wurde als "${species.scientificNameWithoutAuthor}" identifiziert.
${germanName ? `PlantNet deutscher Name: "${germanName}"` : ''}

WICHTIG: Prüfe zuerst, ob diese Pflanze in Mitteleuopa (Deutschland, Österreich, Schweiz, Polen, Tschechien, etc.) heimisch ist oder häufig vorkommt!

Falls die Pflanze NICHT in Mitteleuopa vorkommt (z.B. tropische Pflanzen, asiatische Arten, amerikanische Pflanzen):
- Setze "is_european" auf false
- Gib trotzdem alle Informationen an

Falls die Pflanze in Mitteleuopa vorkommt:
- Setze "is_european" auf true

KRITISCH - Namensgebung:
1. **species_name** = NUTZE DEN DEUTSCHEN NAMEN VON PLANTNET falls vorhanden: "${germanName || ''}"
   - Falls PlantNet-Name existiert, nutze diesen EXAKT
   - Ansonsten: Deutscher Artname im SINGULAR mit Bindestrich (z.B. "Silber-Pappel")

2. **genus_name** = DEUTSCHER Gattungsname im SINGULAR
   - Beispiele: "Pappel", "Weide", "Oregano", "Thymian", "Minze", "Aster"
   - NIEMALS lateinisch (FALSCH: "Origanum", "Thymus", "Mentha", "Tripolium")
   - NIEMALS Plural (FALSCH: "Pappeln", "Weiden")

3. **scientific_genus** = LATEINISCHER Gattungsname
   - Extrahiere aus "${species.scientificNameWithoutAuthor}"
   - Das erste Wort ist die Gattung!

4. Kategorie: "Bäume", "Sträucher" oder "Blumen" - Füge sämtliche Süß-Gräser der Kategorie "Sträucher" hinzu.
5. Deutsche Pflanzenfamilie (z.B. "Lippenblütler", "Weidengewächse", "Korbblütler")
6. Kurze Beschreibung (2-3 Sätze)
7. Haupterkennungsmerkmale
8. Interessanter Fakt für Kinder
9. is_european: true/false (ob die Pflanze in Mitteleuopa vorkommt)
10. rarity: Wie häufig kommt die Pflanze in Mitteleuopa vor?
   - "Häufig": Überall zu finden (z.B. Löwenzahn, Brennnessel, Eiche)
   - "Gelegentlich": Regelmäßig anzutreffen, aber nicht überall (z.b. Eiche, Feuerdorn, Oregano)
   - "Selten": Nur in bestimmten Regionen (z.B. Edelweiß, seltene Orchideen)
   - "Sehr Selten": Sehr selten in freier Natur
   - "Extrem Selten": Sehr selten, oft vom Aussterben bedroht`,
                                response_json_schema: {
                                    type: "object",
                                    properties: {
                                        species_name: { type: "string" },
                                        genus_name: { type: "string" },
                                        scientific_genus: { type: "string" },
                                        category: { type: "string", enum: ["Bäume", "Sträucher", "Blumen"] },
                                        family: { type: "string" },
                                        description: { type: "string" },
                                        identification_features: { type: "string" },
                                        fun_fact: { type: "string" },
                                        is_european: { type: "boolean" },
                                        rarity: { type: "string", enum: ["Häufig", "Gelegentlich", "Selten", "Sehr Selten", "Extrem Selten"] }
                                    }
                                }
                            });

                            return {
                                species_name: llmEnrichment.species_name,
                                genus_name: llmEnrichment.genus_name,
                                scientific_name: species.scientificNameWithoutAuthor,
                                scientific_genus: llmEnrichment.scientific_genus,
                                category: llmEnrichment.category,
                                family: llmEnrichment.family,
                                description: llmEnrichment.description,
                                identification_features: llmEnrichment.identification_features,
                                fun_fact: llmEnrichment.fun_fact,
                                is_european: llmEnrichment.is_european,
                                rarity: llmEnrichment.rarity,
                                score: score,
                                confidence_percentage: Math.round(score * 100)
                            };
                        })
                    );

                    console.log("✅ Alle Übersetzungen abgeschlossen");

                    return Response.json({
                        identified: true,
                        source: "plantnet",
                        results: translatedResults,
                        primary_result: translatedResults[0]
                    });
                }
            }
            
            console.log("⚠️ PlantNet Score zu niedrig oder keine Ergebnisse, verwende LLM Fallback...");
            throw new Error("PlantNet Score zu niedrig");

        } catch (plantnetError) {
            console.warn("⚠️ PlantNet fehlgeschlagen:", plantnetError.message);
            console.log("🤖 Fallback zu LLM...");

            // Fallback: LLM mit Bild
            const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `Du bist ein präziser Botaniker und Pflanzenexperte.

Analysiere dieses Foto sehr sorgfältig und identifiziere die Pflanze NUR wenn du dir SICHER bist.

WICHTIGE REGELN:
- Setze "identified" nur auf TRUE wenn du die Pflanze mit hoher Sicherheit erkennst
- Achte genau auf: Blattform, Blütenform, Farbe, Wuchsform, Stängelstruktur
- Bei Unsicherheit: setze "identified" auf FALSE
- Lieber keine Antwort als eine falsche!
- WICHTIG: Prüfe ob die Pflanze in Mitteleuopa (Deutschland, Österreich, Schweiz, Polen, Tschechien, etc.) heimisch oder häufig vorkommt
- Setze "is_european" auf false für tropische, asiatische, amerikanische oder andere nicht-europäische Pflanzen

Falls du die Pflanze SICHER erkennst, gib an:
1. Deutschen Artnamen (präzise, z.B. "Gewöhnliche Sonnenblume", "Trauer-Weide", nicht nur "Sonnenblume")
2. Gattungsname (z.B. "Sonnenblume", "Weide")
3. Wissenschaftlicher Artname (z.B. "Helianthus annuus", "Salix babylonica")
4. Wissenschaftlicher Gattungsname (z.B. "Helianthus", "Salix")
5. Kategorie: "Bäume", "Sträucher" oder "Blumen"
6. Pflanzenfamilie (z.B. "Korbblütler", "Weidengewächse")
7. Beschreibung (2-3 Sätze)
8. Haupterkennungsmerkmale
9. Interessanter Fakt
10. is_european: true/false (ob die Pflanze in Mitteleuopa vorkommt)
11. rarity: Wie häufig kommt die Pflanze in Mitteleuopa vor?
    - "Häufig": Überall zu finden
    - "Gelegentlich": Regelmäßig anzutreffen
    - "Selten": Nur in bestimmten Regionen
    - "Sehr Selten": Sehr selten
    - "Extrem Selten": Sehr selten, oft vom Aussterben bedroht

Sei ehrlich: Falls du unsicher bist, setze "identified" auf false!`,
                file_urls: [image_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        identified: { type: "boolean" },
                        confidence: { type: "string" },
                        species_name: { type: "string" },
                        genus_name: { type: "string" },
                        scientific_name: { type: "string" },
                        scientific_genus: { type: "string" },
                        category: { type: "string", enum: ["Bäume", "Sträucher", "Blumen"] },
                        family: { type: "string" },
                        description: { type: "string" },
                        identification_features: { type: "string" },
                        fun_fact: { type: "string" },
                        is_european: { type: "boolean" },
                        rarity: { type: "string", enum: ["Häufig", "Gelegentlich", "Selten", "Sehr Selten", "Extrem Selten"] }
                    },
                    required: ["identified"]
                }
            });

            return Response.json({
                identified: llmResult.identified,
                source: "llm",
                results: llmResult.identified ? [{
                    ...llmResult,
                    confidence_percentage: null
                }] : [],
                primary_result: llmResult.identified ? llmResult : null
            });
        }

    } catch (error) {
        console.error("💥 Fehler:", error);
        return Response.json({ 
            error: error.message,
            identified: false 
        }, { status: 500 });
    }
});
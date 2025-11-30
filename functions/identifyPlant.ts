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

            const plantnetUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${plantnetApiKey}&lang=de`;
            
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
                
                // Prüfe ob es ein Rate-Limit-Fehler ist (429 oder spezifische Meldung)
                if (plantnetResponse.status === 429 || errorText.toLowerCase().includes('limit') || errorText.toLowerCase().includes('quota')) {
                    throw new Error('PLANTNET_RATE_LIMIT');
                }
                
                throw new Error(`PlantNet API Error: ${plantnetResponse.status}`);
            }

            const plantnetData = await plantnetResponse.json();
            console.log("✅ PlantNet Antwort:", JSON.stringify(plantnetData, null, 2));

            // Prüfe ob PlantNet ein Ergebnis gefunden hat
            if (plantnetData.results && plantnetData.results.length > 0) {
                // PlantNet IMMER verwenden wenn Ergebnisse vorhanden sind
                // Sammle alle Ergebnisse mit Score > 5%
                const allValidResults = plantnetData.results
                    .filter(result => result.score > 0.05)
                    .slice(0, 5); // Max 5 Ergebnisse
                
                if (allValidResults.length > 0) {
                    
                    console.log(`📊 ${allValidResults.length} Ergebnisse mit Score > 5% gefunden`);
                    
                    // Übersetze alle Ergebnisse zu Deutsch
                    const translatedResults = await Promise.all(
                        allValidResults.map(async (result) => {
                            const species = result.species;
                            const score = result.score;
                            
                            // commonNames sind jetzt auf Deutsch (durch lang=de Parameter)
                            // Nimm den ersten commonName falls vorhanden
                            const germanName = species.commonNames && species.commonNames.length > 0 
                                ? species.commonNames[0] 
                                : null;
                            
                            // Verwende PlantNet-Namen oder null (wird später vom LLM übersetzt)
                            const finalSpeciesName = germanName;
                            
                            console.log(`🔍 PlantNet Name: "${finalSpeciesName || 'nicht vorhanden'}" für ${species.scientificNameWithoutAuthor} (${(score * 100).toFixed(1)}%)`);
                            
                            const llmEnrichment = await base44.asServiceRole.integrations.Core.InvokeLLM({
                                prompt: `Die Pflanze wurde als "${species.scientificNameWithoutAuthor}" identifiziert.
${finalSpeciesName ? `PlantNet gibt als deutschen Namen: "${finalSpeciesName}" an.` : 'PlantNet hat keinen deutschen Namen geliefert.'}

WICHTIG: Prüfe zuerst, ob diese Pflanze in Mitteleuopa (Deutschland, Österreich, Schweiz, Polen, Tschechien, etc.) heimisch oder häufig vorkommt!

Falls die Pflanze NICHT in Mitteleuopa vorkommt (z.B. tropische Pflanzen, asiatische Arten, amerikanische Pflanzen):
- Setze "is_european" auf false
- Gib trotzdem alle Informationen an

Falls die Pflanze in Mitteleuopa vorkommt:
- Setze "is_european" auf true

Gib folgende Informationen an:

1. **species_name** = DEUTSCHER Artname
   - Falls PlantNet einen deutschen Namen geliefert hat, verwende diesen
   - Ansonsten: Übersetze den wissenschaftlichen Namen ins Deutsche
   - Beispiele: "Gewöhnliche Brombeere", "Gemeine Fichte", "Frauenmantel"
   - WICHTIG: Muss zur Art "${species.scientificNameWithoutAuthor}" passen!

2. **genus_name** = DEUTSCHER Gattungsname im SINGULAR
   - Beispiele: "Brombeere", "Fichte", "Frauenmantel", "Weide", "Oregano"
   - NIEMALS lateinisch (FALSCH: "Rubus", "Picea", "Alchemilla")
   - NIEMALS Plural (FALSCH: "Brombeeren", "Fichten")

3. **scientific_genus** = LATEINISCHER Gattungsname
   - Extrahiere aus "${species.scientificNameWithoutAuthor}"
   - Das erste Wort ist die Gattung!

4. Kategorie: "Bäume", "Sträucher" oder "Blumen"
5. Deutsche Pflanzenfamilie (z.B. "Lippenblütler", "Weidengewächse", "Korbblütler")
6. Kurze Beschreibung (2-3 Sätze)
7. Haupterkennungsmerkmale
8. Interessanter Fakt für Kinder
9. is_european: true/false (ob die Pflanze in Mitteleuopa vorkommt)
10. rarity: Wie häufig kommt die Pflanze in Mitteleuopa vor?
   - "Häufig": Überall zu finden (z.B. Löwenzahn, Brennnessel, Rotbuche)
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

                            // Verwende LLM-übersetzten Namen, oder PlantNet-Namen als Fallback
                            const translatedSpeciesName = llmEnrichment.species_name || finalSpeciesName || species.scientificNameWithoutAuthor;
                            
                            return {
                                species_name: translatedSpeciesName,
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
            
            console.log("⚠️ PlantNet keine Ergebnisse gefunden");
            
            return Response.json({
                identified: false,
                error: 'PlantNet konnte die Pflanze nicht identifizieren.'
            });

        } catch (plantnetError) {
            console.warn("⚠️ PlantNet fehlgeschlagen:", plantnetError.message);
            
            // Bei Rate-Limit: Spezieller Error zurückgeben
            if (plantnetError.message === 'PLANTNET_RATE_LIMIT') {
                return Response.json({
                    identified: false,
                    error_type: 'PLANTNET_RATE_LIMIT',
                    error: 'PlantNet hat die maximale Anzahl an Scans erreicht oder ist nicht erreichbar.'
                }, { status: 503 });
            }
            
            // Kein LLM-Fallback mehr - nur PlantNet
            return Response.json({
                identified: false,
                error: `PlantNet Fehler: ${plantnetError.message}`
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
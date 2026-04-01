import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
//Test Deployment
Deno.serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseAnonKey) {
            return Response.json({ error: 'Supabase not configured' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization') ?? ''
                }
            }
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
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
            console.log("📥 Lade Bild herunter von:", image_url);
            const imageResponse = await fetch(image_url);
            
            if (!imageResponse.ok) {
                throw new Error(`Bild konnte nicht geladen werden: ${imageResponse.status} ${imageResponse.statusText}`);
            }
            
            const imageBlob = await imageResponse.blob();
            console.log("✅ Bild geladen, Größe:", imageBlob.size, "bytes");
            
            formData.append('images', imageBlob, 'plant.jpg');
            formData.append('organs', organ);

            console.log("📤 Sende Anfrage an PlantNet...");
            const plantnetResponse = await fetch(plantnetUrl, {
                method: 'POST',
                body: formData
            });
            
            console.log("📥 PlantNet Response Status:", plantnetResponse.status);

            if (!plantnetResponse.ok) {
                const errorText = await plantnetResponse.text();
                console.warn("⚠️ PlantNet API Fehler:", errorText);
                
                // Prüfe ob es ein Rate-Limit-Fehler ist (429 oder spezifische Meldung)
                if (plantnetResponse.status === 429 || errorText.toLowerCase().includes('limit') || errorText.toLowerCase().includes('quota')) {
                    throw new Error('PLANTNET_RATE_LIMIT');
                }
                
                // 404 "Species not found" bedeutet: PlantNet konnte die Pflanze nicht identifizieren
                // Das ist KEIN Fehler, sondern ein gültiges Ergebnis
                if (plantnetResponse.status === 404) {
                    console.log("⚠️ PlantNet konnte die Pflanze nicht identifizieren (404)");
                    return Response.json({
                        identified: false,
                        error: 'PlantNet konnte die Pflanze nicht identifizieren.'
                    });
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
                            
                            const scientificName = species.scientificNameWithoutAuthor || species.scientificName || '';
                            const scientificGenus = scientificName ? scientificName.split(' ')[0] : null;
                            const translatedSpeciesName = finalSpeciesName || scientificName || 'Unbekannte Art';
                            const genusName = translatedSpeciesName ? translatedSpeciesName.split(' ')[0] : scientificGenus;

                            return {
                                species_name: translatedSpeciesName,
                                genus_name: genusName || scientificGenus || 'Unbekannte Gattung',
                                scientific_name: scientificName || null,
                                scientific_genus: scientificGenus || null,
                                category: 'Blumen',
                                family: species.family?.scientificName || species.family?.name || null,
                                description: null,
                                identification_features: null,
                                fun_fact: null,
                                is_european: null,
                                rarity: null,
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
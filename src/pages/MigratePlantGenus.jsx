import React, { useState } from "react";
import { Query } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MigratePlantGenus() {
  const [status, setStatus] = useState("idle"); // idle, running, success, error
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState([]);
  const [migrated, setMigrated] = useState(0);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const migrateData = async () => {
    setStatus("running");
    setProgress("Lade Daten...");
    setErrors([]);
    setMigrated(0);

    try {
      // Lade alle Pflanzen und Gattungen (listAll() - list() truncates at 1000 rows)
      const plants = await Query.Plant.listAll();
      const genera = await Query.PlantGenus.list();

      setProgress(`Gefunden: ${plants.length} Pflanzen, ${genera.length} Gattungen`);

      let migratedCount = 0;
      const errorList = [];

      for (let i = 0; i < plants.length; i++) {
        const plant = plants[i];
        
        // Überspringe wenn bereits migriert
        if (plant.genus_category && plant.genus_number) {
          setProgress(`${i + 1}/${plants.length} - "${plant.species_name}" bereits migriert`);
          continue;
        }

        // Finde das Genus anhand der alten genus_id
        const genus = genera.find(g => g.id === plant.genus_id);
        
        if (!genus) {
          errorList.push(`Plant "${plant.species_name}" (ID: ${plant.id}) - Genus nicht gefunden (genus_id: ${plant.genus_id})`);
          continue;
        }

        try {
          // Update mit neuen Feldern
          await Query.Plant.update(plant.id, {
            genus_category: genus.category,
            genus_number: genus.category_dex_number
          });
          
          migratedCount++;
          setMigrated(migratedCount);
          setProgress(`${i + 1}/${plants.length} - Migriert: "${plant.species_name}" → ${genus.category} #${genus.category_dex_number}`);
          
          await sleep(100);
        } catch (err) {
          errorList.push(`Plant "${plant.species_name}" - Fehler beim Update: ${err.message}`);
        }
      }

      setErrors(errorList);
      setStatus("success");
      setProgress(`Migration abgeschlossen! ${migratedCount} Pflanzen migriert.`);
    } catch (error) {
      setStatus("error");
      setProgress(`Fehler: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-orange-200 shadow-lg">
          <CardHeader className="bg-orange-50 border-b border-orange-200">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              Plant-Genus Migration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-sm">
                <strong>⚠️ Diese Seite migriert alle Plant-Einträge von genus_id auf genus_category + genus_number.</strong>
                <br />
                <br />
                Die Migration kann nur einmal durchgeführt werden und überschreibt keine bereits migrierten Einträge.
              </AlertDescription>
            </Alert>

            {status === "idle" && (
              <Button 
                onClick={migrateData}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4"
              >
                Migration starten
              </Button>
            )}

            {status === "running" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-blue-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-semibold">Migration läuft...</span>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-900 font-mono">{progress}</p>
                  <p className="text-sm text-blue-700 mt-2">Migriert: {migrated}</p>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Migration erfolgreich!</span>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-900 font-semibold">{progress}</p>
                </div>

                {errors.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-sm font-semibold text-red-900 mb-2">⚠️ Fehler bei {errors.length} Einträgen:</p>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-800 font-mono">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === "error" && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center gap-3 text-red-600 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Fehler aufgetreten</span>
                </div>
                <p className="text-sm text-red-900">{progress}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
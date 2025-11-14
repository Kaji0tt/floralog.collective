import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Loader2 } from "lucide-react";

export default function AdminFixSalix() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const updatePlantMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Plant.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });

  const handleFix = async () => {
    setProcessing(true);
    setResult(null);

    try {
      // Finde "Salix" mit scientific_name "Salix atrocinerea"
      const salixPlant = plants.find(p => 
        p.scientific_name === "Salix atrocinerea" || 
        (p.species_name === "Salix" && p.scientific_name.includes("atrocinerea"))
      );

      if (!salixPlant) {
        setResult({
          success: false,
          message: "Keine Pflanze mit 'Salix atrocinerea' gefunden!"
        });
        setProcessing(false);
        return;
      }

      console.log("🔍 Gefundene Pflanze:", salixPlant);

      // Benenne um zu "Asch-Weide"
      await updatePlantMutation.mutateAsync({
        id: salixPlant.id,
        data: {
          species_name: "Asch-Weide",
          description: "Die Asch-Weide ist ein kleiner bis mittelgroßer Baum, der häufig an Gewässern wächst. Sie zeichnet sich durch ihre geschwungenen, hängenden Zweige aus. Diese Weidenart ist bekannt für ihre schnellen Wachstumsraten und ihre Anpassungsfähigkeit an unterschiedliche Bodenbedingungen.",
          identification_features: "Dünne, lange, hängende Äste; schmale, längliche Blätter mit einer hellgrünen Oberseite und einer silbergrünen Unterseite; gelbgrüne Blütenkätzchen im Frühling.",
          fun_fact: "Asch-Weiden sind wichtige Pflanzen für Insekten und Vögel, da sie früh im Jahr blühen und Nahrung bieten!"
        }
      });

      setResult({
        success: true,
        message: `✅ Pflanze erfolgreich umbenannt!\n\nAlt: "${salixPlant.species_name}" (${salixPlant.scientific_name})\nNeu: "Asch-Weide" (Salix atrocinerea)`,
        oldName: salixPlant.species_name,
        scientificName: salixPlant.scientific_name
      });

    } catch (error) {
      console.error("Fehler:", error);
      setResult({
        success: false,
        message: `❌ Fehler: ${error.message}`
      });
    }

    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="border-2 border-amber-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
            <CardTitle className="text-2xl">
              🌳 Salix → Asch-Weide umbenennen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-blue-900 font-semibold mb-2">
                Was macht diese Seite?
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Findet die Pflanze "Salix" mit scientific_name "Salix atrocinerea"</li>
                <li>• Benennt sie um zu "Asch-Weide" (korrekter deutscher Name)</li>
                <li>• Fügt passende Beschreibung hinzu</li>
              </ul>
            </div>

            {!result && (
              <Button
                onClick={handleFix}
                disabled={processing}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-6 text-lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verarbeite...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Jetzt umbenennen
                  </>
                )}
              </Button>
            )}

            {result && (
              <Alert className={`border-2 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <AlertDescription className={`${result.success ? 'text-green-900' : 'text-red-900'} whitespace-pre-line`}>
                  {result.message}
                </AlertDescription>
              </Alert>
            )}

            {result && result.success && (
              <div className="text-center">
                <p className="text-sm text-stone-600 mb-4">
                  Die Asch-Weide wurde erfolgreich umbenannt. Du kannst jetzt die Trauer-Weide scannen!
                </p>
                <Button
                  onClick={() => window.location.href = "/"}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Zurück zur Startseite
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
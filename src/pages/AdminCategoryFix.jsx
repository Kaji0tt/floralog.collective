import { useState } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

export default function AdminCategoryFix() {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const updateGenusMutation = useMutation({
    mutationFn: ({ id, data }) => Query.PlantGenus.update(id, data),
  });

  const blumenGenera = genera.filter(g => g.category === "Blumen" || g.category === "Blumen & Kräuter");
  
  // Finde Duplikate
  const numberCounts = {};
  blumenGenera.forEach(g => {
    if (g.category_dex_number) {
      numberCounts[g.category_dex_number] = (numberCounts[g.category_dex_number] || 0) + 1;
    }
  });
  const duplicates = Object.entries(numberCounts).filter(([num, count]) => count > 1);

  const renumberAllBlumen = async () => {
    setFixing(true);
    setResult(null);

    try {
      // Hole alle aktuellen Blumen-Gattungen
      const allGenera = await Query.PlantGenus.list();
      const blumenList = allGenera
        .filter(g => g.category === "Blumen" || g.category === "Blumen & Kräuter")
        .sort((a, b) => {
          // Sortiere alphabetisch nach genus_name
          return (a.genus_name || "").localeCompare(b.genus_name || "");
        });

      console.log(`🔢 Nummeriere ${blumenList.length} Blumen-Gattungen neu...`);
      
      for (let i = 0; i < blumenList.length; i++) {
        const updates = {
          category_dex_number: i + 1
        };
        
        // Falls noch alte Kategorie vorhanden, auch umbenennen
        if (blumenList[i].category === "Blumen & Kräuter") {
          updates.category = "Blumen";
        }
        
        await updateGenusMutation.mutateAsync({
          id: blumenList[i].id,
          data: updates
        });
      }

      queryClient.invalidateQueries({ queryKey: ['genera'] });
      
      setResult({
        success: true,
        message: `✅ Erfolgreich bereinigt!\n\n- ${blumenList.length} Gattungen neu nummeriert (1-${blumenList.length})\n- Alle Duplikate entfernt\n- Alphabetisch sortiert`
      });

    } catch (error) {
      setResult({
        success: false,
        message: `❌ Fehler: ${error.message}`
      });
    }

    setFixing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-orange-200 shadow-lg">
          <CardHeader className="bg-orange-50">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              Admin: Blumen-Nummern bereinigen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <Alert className="border-2 border-blue-200 bg-blue-50">
              <AlertDescription className="text-sm">
                <strong>Was macht diese Funktion?</strong>
                <ol className="list-decimal ml-5 mt-2 space-y-1">
                  <li>Vergibt alle Blumen-Nummern komplett neu</li>
                  <li>Sortiert alphabetisch nach Gattungsname</li>
                  <li>Behebt alle Duplikate</li>
                  <li>Nummerierung: 1, 2, 3, 4, ... (lückenlos)</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">Blumen-Gattungen</h3>
                <div className="text-3xl font-bold text-blue-700 mb-1">
                  {blumenGenera.length}
                </div>
                <p className="text-sm text-blue-600">Gesamt</p>
              </div>

              <div className={`rounded-lg p-4 border ${duplicates.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <h3 className={`font-bold mb-2 ${duplicates.length > 0 ? 'text-red-900' : 'text-green-900'}`}>
                  Duplikate
                </h3>
                <div className={`text-3xl font-bold mb-1 ${duplicates.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {duplicates.length}
                </div>
                <p className={`text-sm ${duplicates.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {duplicates.length > 0 ? 'Doppelte Nummern' : 'Keine Duplikate'}
                </p>
              </div>
            </div>

            {duplicates.length > 0 && (
              <Alert className="border-2 border-orange-200 bg-orange-50">
                <AlertDescription className="text-sm">
                  <strong className="text-orange-900">Gefundene Duplikate:</strong>
                  <div className="mt-2 space-y-1">
                    {duplicates.slice(0, 5).map(([num, count]) => (
                      <div key={num} className="text-orange-800">
                        #{num} kommt {count}x vor
                      </div>
                    ))}
                    {duplicates.length > 5 && (
                      <div className="text-orange-600 text-xs">
                        ... und {duplicates.length - 5} weitere
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert className={`border-2 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <AlertDescription className="whitespace-pre-line text-sm font-semibold">
                  {result.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <Button
                onClick={renumberAllBlumen}
                disabled={fixing}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-6 px-8 text-lg"
              >
                {fixing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Bereinige...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Alle Blumen neu nummerieren
                  </>
                )}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}


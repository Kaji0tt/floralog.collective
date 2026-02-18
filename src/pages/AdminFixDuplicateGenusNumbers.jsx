import { useState } from "react";
import { Query } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function AdminFixDuplicateGenusNumbers() {
  const queryClient = useQueryClient();
  const [fixing, setFixing] = useState(false);

  const { data: genera = [], isLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  // Finde Duplikate
  const findDuplicates = () => {
    const duplicates = {};
    
    genera.forEach(genus => {
      const key = `${genus.category}-${genus.category_dex_number}`;
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      duplicates[key].push(genus);
    });

    // Filtere nur die mit mehr als einem Eintrag
    const result = {};
    Object.entries(duplicates).forEach(([key, items]) => {
      if (items.length > 1) {
        result[key] = items;
      }
    });

    return result;
  };

  const duplicates = findDuplicates();
  const hasDuplicates = Object.keys(duplicates).length > 0;

  const fixDuplicatesMutation = useMutation({
    mutationFn: async () => {
      setFixing(true);
      
      // Für jede Kategorie: finde die höchste verwendete Nummer
      const categories = ['Bäume', 'Sträucher', 'Blumen'];
      const maxNumbers = {};
      
      categories.forEach(category => {
        const categoryGenera = genera.filter(g => g.category === category);
        maxNumbers[category] = Math.max(...categoryGenera.map(g => g.category_dex_number || 0));
      });

      // Gehe durch alle Duplikate und weise neue Nummern zu
      for (const [key, items] of Object.entries(duplicates)) {
        const [category] = key.split('-');
        
        // Das erste Item behalten, die anderen neu nummerieren
        for (let i = 1; i < items.length; i++) {
          maxNumbers[category]++;
          await Query.PlantGenus.update(items[i].id, {
            category_dex_number: maxNumbers[category]
          });
        }
      }
      
      setFixing(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genera'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-stone-900 mb-3">
            Duplikate Gattungsnummern beheben 🔧
          </h1>
          <p className="text-lg text-stone-600">
            {hasDuplicates 
              ? `${Object.keys(duplicates).length} Duplikat-Gruppen gefunden`
              : "Keine Duplikate gefunden"}
          </p>
        </div>

        {!hasDuplicates ? (
          <Card className="border-2 border-green-200">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                Alles in Ordnung! ✅
              </h3>
              <p className="text-stone-600">
                Keine doppelten Gattungsnummern gefunden.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-orange-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      Duplikate gefunden
                    </h3>
                    <p className="text-stone-700 mb-4">
                      Die folgenden Gattungsnummern sind mehrfach vergeben. Mit einem Klick werden die Duplikate automatisch an das Ende der jeweiligen Kategorie verschoben.
                    </p>
                    <Button
                      onClick={() => fixDuplicatesMutation.mutate()}
                      disabled={fixing || fixDuplicatesMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {fixing || fixDuplicatesMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Wird behoben...
                        </>
                      ) : (
                        "🔧 Alle Duplikate automatisch beheben"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {Object.entries(duplicates).map(([key, items]) => {
                const [category, number] = key.split('-');
                return (
                  <Card key={key} className="border-2 border-red-200">
                    <CardHeader className="bg-red-50">
                      <CardTitle className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <div>
                          <div className="text-xl font-bold text-stone-900">
                            {category} #{number}
                          </div>
                          <div className="text-sm text-stone-600 font-normal">
                            {items.length} Gattungen mit dieser Nummer
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {items.map((genus, index) => (
                          <div 
                            key={genus.id}
                            className={`p-4 rounded-lg border-2 ${
                              index === 0 
                                ? 'border-green-200 bg-green-50' 
                                : 'border-orange-200 bg-orange-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge className={index === 0 ? "bg-green-600" : "bg-orange-600"}>
                                  {index === 0 ? "Behalten" : "Wird verschoben"}
                                </Badge>
                                <div>
                                  <div className="font-bold text-stone-900">
                                    {genus.genus_name}
                                  </div>
                                  <div className="text-sm text-stone-600 italic">
                                    {genus.scientific_genus}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-sm text-stone-600">
                                ID: {genus.id.slice(-8)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


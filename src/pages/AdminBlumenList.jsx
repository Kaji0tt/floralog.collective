import { Query } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flower2 } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

export default function AdminBlumenList() {
  const { data: genera = [], isLoading } = useQuery({
    queryKey: ['genera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const blumenGenera = genera
    .filter(g => g.category === "Blumen" || g.category === "Blumen & Kräuter")
    .sort((a, b) => {
      const aNum = a.category_dex_number || 9999;
      const bNum = b.category_dex_number || 9999;
      return aNum - bNum;
    });

  // Finde Duplikate
  const numberCounts = {};
  blumenGenera.forEach(g => {
    if (g.category_dex_number) {
      numberCounts[g.category_dex_number] = (numberCounts[g.category_dex_number] || 0) + 1;
    }
  });

  const isDuplicate = (num) => numberCounts[num] > 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">
            Blumen-Gattungen Übersicht
          </h1>
          <p className="text-lg text-stone-600">
            Sortiert nach Dex-Nummer • {blumenGenera.length} Gattungen gesamt
          </p>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg">
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center gap-2">
              <Flower2 className="w-6 h-6 text-green-600" />
              Alle Blumen-Gattungen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-stone-200">
              {blumenGenera.map((genus) => (
                <div
                  key={genus.id}
                  className={`p-4 hover:bg-stone-50 transition-colors ${
                    isDuplicate(genus.category_dex_number) ? 'bg-red-50 hover:bg-red-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Dex Nummer */}
                    <div className={`flex-shrink-0 w-20 text-center ${
                      isDuplicate(genus.category_dex_number) ? 'text-red-700' : 'text-stone-700'
                    }`}>
                      <div className="text-2xl font-bold">
                        #{String(genus.category_dex_number || '?').padStart(3, '0')}
                      </div>
                      {isDuplicate(genus.category_dex_number) && (
                        <Badge className="bg-red-500 text-white text-xs mt-1">
                          Duplikat!
                        </Badge>
                      )}
                    </div>

                    {/* Gattungsinfo */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-stone-900 mb-1">
                        {genus.genus_name}
                      </h3>
                      <p className="text-sm text-stone-600 italic mb-2">
                        {genus.scientific_genus}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-stone-300 text-xs">
                          {genus.category}
                        </Badge>
                        {genus.family && (
                          <Badge variant="outline" className="border-green-300 text-xs">
                            {genus.family}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* ID (für Debugging) */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-stone-400 font-mono">
                        {genus.id.substring(0, 8)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Statistiken */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-700 mb-1">
                {blumenGenera.length}
              </div>
              <div className="text-sm text-stone-600">Gesamt</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-700 mb-1">
                {Object.values(numberCounts).filter(count => count > 1).length}
              </div>
              <div className="text-sm text-stone-600">Doppelte Nummern</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-700 mb-1">
                {blumenGenera.filter(g => !g.category_dex_number).length}
              </div>
              <div className="text-sm text-stone-600">Ohne Nummer</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


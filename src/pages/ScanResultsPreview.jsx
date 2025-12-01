import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScanResults from "../components/scanner/ScanResults";
import MobileBackButton from "../components/navigation/MobileBackButton";

const DEMO_PLANTS = {
  haeufig: {
    id: "demo-1",
    species_name: "Gewöhnliche Sonnenblume",
    scientific_name: "Helianthus annuus",
    rarity: "Häufig",
    description: "Die Sonnenblume ist eine einjährige Pflanze, die für ihre großen, gelben Blütenköpfe bekannt ist. Sie kann bis zu 3 Meter hoch werden und folgt dem Lauf der Sonne.",
    identification_features: "Große gelbe Blütenköpfe mit brauner Mitte, raue behaarte Stängel, herzförmige Blätter",
    fun_fact: "Sonnenblumen können bis zu 2000 Samen in einem einzigen Blütenkopf produzieren!",
    discovered: false,
    xpAwarded: 20,
    confidence_percentage: 95
  },
  gelegentlich: {
    id: "demo-2",
    species_name: "Rotbuche",
    scientific_name: "Fagus sylvatica",
    rarity: "Gelegentlich",
    description: "Die Rotbuche ist einer der wichtigsten Laubbäume Mitteleuropas. Sie kann über 300 Jahre alt werden und Höhen von 40 Metern erreichen.",
    identification_features: "Glatte, silbergraue Rinde, eiförmige Blätter mit gewelltem Rand, Bucheckern als Früchte",
    fun_fact: "Aus einer einzigen Buche können über 30 Millionen Blätter wachsen!",
    discovered: false,
    xpAwarded: 35,
    confidence_percentage: 88,
    isNewToPlantDex: true
  },
  selten: {
    id: "demo-3",
    species_name: "Türkenbund-Lilie",
    scientific_name: "Lilium martagon",
    rarity: "Selten",
    description: "Eine besonders schöne Waldlilie mit zurückgerollten Blütenblättern in rosa bis purpur Farben mit dunklen Punkten.",
    identification_features: "Türkenartig zurückgerollte Blütenblätter, dunkelrote Punkte, quirlständige Blätter",
    fun_fact: "Die Zwiebeln wurden früher als Nahrung verwendet und schmecken ähnlich wie Kartoffeln!",
    discovered: true,
    xpAwarded: 5,
    confidence_percentage: 72
  },
  nichtEuropaeisch: {
    id: "demo-4",
    species_name: "Japanischer Ahorn",
    scientific_name: "Acer palmatum",
    rarity: "Gelegentlich",
    description: "Ein dekorativer Baum aus Japan mit fein geschlitzten Blättern, die im Herbst leuchtend rot werden.",
    identification_features: "Handförmig gelappte, fein geschlitzte Blätter, zierlicher Wuchs",
    fun_fact: "In Japan werden Ahornblätter frittiert und als Snack gegessen!",
    notInDex: true,
    is_european: false
  },
  unerkannt: {
    identified: false,
    error: "Die Pflanze konnte nicht identifiziert werden. Versuche ein klareres Foto mit mehr Details."
  }
};

const DEMO_IMAGE = "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=800";

export default function ScanResultsPreview() {
  const [selectedDemo, setSelectedDemo] = useState("haeufig");
  const [imageUrl] = useState(DEMO_IMAGE);

  const currentPlant = DEMO_PLANTS[selectedDemo];

  // Für multiple results Demo
  const allResults = selectedDemo === "haeufig" ? [
    DEMO_PLANTS.haeufig,
    { ...DEMO_PLANTS.gelegentlich, confidence_percentage: 45 },
    { ...DEMO_PLANTS.selten, confidence_percentage: 23 }
  ] : [currentPlant];

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        {/* Controls */}
        <Card className="mb-6 border-2 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold text-orange-800">🧪 Preview-Modus:</span>
              <Select value={selectedDemo} onValueChange={setSelectedDemo}>
                <SelectTrigger className="w-48 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="haeufig">Häufig (+ Alternativen)</SelectItem>
                  <SelectItem value="gelegentlich">Gelegentlich (Neu im Dex)</SelectItem>
                  <SelectItem value="selten">Selten (Bereits entdeckt)</SelectItem>
                  <SelectItem value="nichtEuropaeisch">Nicht-europäisch</SelectItem>
                  <SelectItem value="unerkannt">Nicht erkannt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ScanResults Komponente */}
        <ScanResults
          plant={currentPlant}
          imageUrl={imageUrl}
          onRescan={() => alert("Rescan geklickt")}
          userLocation={{ lat: 52.52, lng: 13.405 }}
          allResults={allResults}
          onDeleteResult={() => alert("Löschen geklickt")}
          onChangeResult={() => alert("Ändern geklickt")}
          latestDiscoveryId={selectedDemo !== "unerkannt" && selectedDemo !== "nichtEuropaeisch" ? "demo-discovery-id" : null}
        />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, Flower2, TreeDeciduous, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import CommunityTagPanel from "@/components/collection/CommunityTagPanel";

export default function PlantDetail() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const plantId = urlParams.get('id');

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ['plant', plantId],
    // Fetch only the single requested plant instead of the whole (1800+ row) catalog.
    queryFn: () => Query.Plant.filter({ id: plantId ? [plantId] : [] }),
    enabled: !!plantId,
  });

  const plant = plants.find(p => p.id === plantId);

  const { data: genera = [] } = useQuery({
    queryKey: ['plantDetailGenera'],
    queryFn: () => Query.PlantGenus.list(),
  });

  const genusId = genera.find(
    (genus) =>
      genus.category === plant?.genus_category &&
      genus.category_dex_number === plant?.genus_number
  )?.id || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 mb-4">Pflanze nicht gefunden</p>
        <Button onClick={() => navigate(createPageUrl("Collection"))}>
          Zurück zur Sammlung
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Collection"))}
          className="mb-6 hover:bg-green-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Sammlung
        </Button>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={plant.image_url}
                alt={plant.common_name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-600">Entdeckt am</p>
                      <p className="font-medium">
                        {format(new Date(plant.discovery_date), "d. MMMM yyyy", { locale: de })}
                      </p>
                    </div>
                  </div>
                  {plant.discovery_location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-xs text-gray-600">Fundort</p>
                        <p className="font-medium">{plant.discovery_location}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {plant.common_name}
              </h1>
              <p className="text-xl text-gray-600 italic mb-4">
                {plant.scientific_name}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-600 text-white text-sm px-4 py-1">
                  <TreeDeciduous className="w-4 h-4 mr-2" />
                  {plant.category}
                </Badge>
                {plant.subcategory && (
                  <Badge variant="outline" className="border-2 border-green-600 text-green-700 text-sm px-4 py-1 bg-white">
                    {plant.subcategory}
                  </Badge>
                )}
                <Badge className="bg-gray-700 text-white text-sm px-4 py-1">
                  {plant.family}
                </Badge>
              </div>
            </div>

            <CommunityTagPanel
              plantId={plant.id}
              genusId={genusId}
              currentUserId={currentUser?.id || currentUser?.auth_id || null}
              isLightUi
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{plant.description}</p>
              </CardContent>
            </Card>

            {plant.identification_features && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Flower2 className="w-5 h-5 text-green-600" />
                    Erkennungsmerkmale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 leading-relaxed">
                    {plant.identification_features}
                  </p>
                </CardContent>
              </Card>
            )}

            {plant.habitat && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lebensraum & Verbreitung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Lebensraum</p>
                    <p className="text-gray-700">{plant.habitat}</p>
                  </div>
                  {plant.distribution && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Verbreitung</p>
                      <p className="text-gray-700">{plant.distribution}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {plant.flowering_period && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Blütezeit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{plant.flowering_period}</p>
                </CardContent>
              </Card>
            )}

            {plant.conservation_status && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-lg">Schutzstatus</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{plant.conservation_status}</p>
                </CardContent>
              </Card>
            )}

            {plant.notes && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Persönliche Notizen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{plant.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

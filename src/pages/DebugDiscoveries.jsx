import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DebugDiscoveries() {
  const [discoveries, setDiscoveries] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Lade ALLE Discoveries (nicht gefiltert)
      const allDiscoveries = await base44.entities.UserPlantDiscovery.list();
      setDiscoveries(allDiscoveries);
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-stone-900 mb-8">
          🔍 Debug: UserPlantDiscovery Daten
        </h1>

        {user && (
          <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle>Aktueller User</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.full_name}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {discoveries.map((discovery, index) => (
            <Card key={discovery.id} className="border-2 border-stone-200">
              <CardHeader>
                <CardTitle className="text-lg">Discovery #{index + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Badge className="mb-2 bg-purple-600">Built-in Felder</Badge>
                    <p className="text-sm"><strong>ID:</strong> {discovery.id}</p>
                    <p className="text-sm"><strong>created_by:</strong> 
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-900 rounded font-mono">
                        {discovery.created_by || "❌ FEHLT"}
                      </span>
                    </p>
                    <p className="text-sm"><strong>created_date:</strong> {discovery.created_date}</p>
                    <p className="text-sm"><strong>updated_date:</strong> {discovery.updated_date}</p>
                  </div>
                  
                  <div>
                    <Badge className="mb-2 bg-blue-600">Eigene Felder</Badge>
                    <p className="text-sm"><strong>plant_id:</strong> {discovery.plant_id}</p>
                    <p className="text-sm"><strong>discovered_date:</strong> {discovery.discovered_date}</p>
                    <p className="text-sm"><strong>location:</strong> {discovery.discovery_location || "-"}</p>
                    <p className="text-sm"><strong>notes:</strong> {discovery.discovery_notes || "-"}</p>
                    <p className="text-sm"><strong>image_url:</strong> {discovery.image_url ? "✅" : "❌"}</p>
                  </div>
                </div>

                {user && discovery.created_by === user.email && (
                  <Badge className="bg-green-600 text-white mt-2">
                    ✅ Das ist DEINE Discovery!
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {discoveries.length === 0 && (
          <Card className="border-2 border-orange-200">
            <CardContent className="p-12 text-center">
              <p className="text-lg text-stone-600">Noch keine Discoveries vorhanden</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
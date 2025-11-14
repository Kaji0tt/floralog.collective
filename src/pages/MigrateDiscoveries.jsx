import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function MigrateDiscoveries() {
  const [discoveries, setDiscoveries] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, failed: 0, skipped: 0 });
  const [logs, setLogs] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    loadDiscoveries();
  }, []);

  const loadDiscoveries = async () => {
    try {
      const allDiscoveries = await base44.entities.UserPlantDiscovery.list();
      setDiscoveries(allDiscoveries);
      addLog(`📊 ${allDiscoveries.length} Discoveries geladen`);
      
      // Analysiere Daten
      const withUser = allDiscoveries.filter(d => d.user);
      const withoutUser = allDiscoveries.filter(d => !d.user);
      const withCreatedBy = allDiscoveries.filter(d => d.created_by);
      
      addLog(`✅ ${withUser.length} haben bereits 'user' Feld`);
      addLog(`❌ ${withoutUser.length} fehlt 'user' Feld`);
      addLog(`📧 ${withCreatedBy.length} haben 'created_by' Feld`);
    } catch (error) {
      addLog(`❌ Fehler beim Laden: ${error.message}`);
    }
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const migrateDiscoveries = async () => {
    setMigrating(true);
    setProgress(0);
    setResults({ success: 0, failed: 0, skipped: 0 });
    setLogs([]);
    addLog("🚀 Migration gestartet...");

    const discoveriesToMigrate = discoveries.filter(d => !d.user && d.created_by);
    const total = discoveriesToMigrate.length;

    if (total === 0) {
      addLog("✅ Keine Migration nötig - alle Discoveries haben bereits ein 'user' Feld!");
      setMigrating(false);
      setIsComplete(true);
      return;
    }

    addLog(`📝 Migriere ${total} Discoveries...`);

    for (let i = 0; i < discoveriesToMigrate.length; i++) {
      const discovery = discoveriesToMigrate[i];
      
      try {
        // Update discovery mit user-Feld
        await base44.entities.UserPlantDiscovery.update(discovery.id, {
          user: discovery.created_by
        });
        
        setResults(prev => ({ ...prev, success: prev.success + 1 }));
        addLog(`✅ ${i + 1}/${total}: ${discovery.id.substring(0, 8)}... → ${discovery.created_by}`);
      } catch (error) {
        setResults(prev => ({ ...prev, failed: prev.failed + 1 }));
        addLog(`❌ ${i + 1}/${total}: Fehler bei ${discovery.id.substring(0, 8)}... - ${error.message}`);
      }

      setProgress(((i + 1) / total) * 100);
    }

    addLog("🎉 Migration abgeschlossen!");
    setMigrating(false);
    setIsComplete(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-green-200 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-stone-900">
              🔧 UserPlantDiscovery Migration
            </CardTitle>
            <p className="text-stone-600 mt-2">
              Fügt das 'user' Feld zu allen bestehenden Discoveries hinzu
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-3xl font-bold text-blue-700">{discoveries.length}</div>
                <div className="text-sm text-blue-600 font-semibold">Gesamt</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-3xl font-bold text-green-700">{discoveries.filter(d => d.user).length}</div>
                <div className="text-sm text-green-600 font-semibold">Mit 'user'</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="text-3xl font-bold text-orange-700">{discoveries.filter(d => !d.user && d.created_by).length}</div>
                <div className="text-sm text-orange-600 font-semibold">Zu migrieren</div>
              </div>
            </div>

            {/* Migration Button */}
            {!isComplete && (
              <Button
                onClick={migrateDiscoveries}
                disabled={migrating || discoveries.filter(d => !d.user && d.created_by).length === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
              >
                {migrating ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Migriere... {Math.round(progress)}%
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6 mr-2" />
                    Migration starten
                  </>
                )}
              </Button>
            )}

            {/* Progress */}
            {migrating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <div className="flex justify-between text-sm text-stone-600">
                  <span>Fortschritt: {Math.round(progress)}%</span>
                  <span>{results.success} erfolgreich, {results.failed} fehlgeschlagen</span>
                </div>
              </div>
            )}

            {/* Results */}
            {isComplete && (
              <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold text-green-900">Migration abgeschlossen!</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-700">{results.success}</div>
                    <div className="text-sm text-green-600">Erfolgreich</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-700">{results.failed}</div>
                    <div className="text-sm text-red-600">Fehlgeschlagen</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-700">{results.skipped}</div>
                    <div className="text-sm text-gray-600">Übersprungen</div>
                  </div>
                </div>
                <Button
                  onClick={loadDiscoveries}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  Daten neu laden
                </Button>
              </div>
            )}

            {/* Logs */}
            <Card className="border border-stone-200 bg-stone-50">
              <CardHeader>
                <CardTitle className="text-lg">Migration Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs text-green-400">
                  {logs.length === 0 ? (
                    <div className="text-gray-500">Warte auf Migration...</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="mb-1">{log}</div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
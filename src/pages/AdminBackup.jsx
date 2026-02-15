import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Database, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminBackup() {
  const [user, setUser] = useState(null);
  const [exportStatus, setExportStatus] = useState({});
  const [importing, setImporting] = useState(false);

  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  // Liste aller Entities in deiner App
  const entities = [
    'Achievement',
    'Classroom',
    'ClassroomMember',
    'ClassroomQuest',
    'CollectionQuest',
    'DailyQuest',
    'Friend',
    'MonthlyQuest',
    'News',
    'Plant',
    'PlantGenus',
    'PublicProfile',
    'Quest',
    'Referral',
    'Reward',
    'ScanLike',
    'SharedScan',
    'UserAchievement',
    'UserCollectionQuest',
    'UserDailyQuest',
    'UserMonthlyQuest',
    'UserNotification',
    'UserPlantDiscovery',
    'UserQuest',
    'UserReward',
    'UserWeeklyQuest',
    'WeeklyQuest'
  ];

  const exportEntity = async (entityName) => {
    try {
      setExportStatus(prev => ({ ...prev, [entityName]: 'loading' }));
      
      const data = await base44.entities[entityName].list();
      
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityName}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportStatus(prev => ({ ...prev, [entityName]: 'success' }));
      setTimeout(() => {
        setExportStatus(prev => ({ ...prev, [entityName]: null }));
      }, 3000);
    } catch (error) {
      console.error(`Fehler beim Export von ${entityName}:`, error);
      setExportStatus(prev => ({ ...prev, [entityName]: 'error' }));
      setTimeout(() => {
        setExportStatus(prev => ({ ...prev, [entityName]: null }));
      }, 3000);
    }
  };

  const exportAllEntities = async () => {
    try {
      setExportStatus({ all: 'loading' });
      
      const allData = {};
      
      for (const entityName of entities) {
        try {
          const data = await base44.entities[entityName].list();
          allData[entityName] = data;
        } catch (error) {
          console.error(`Fehler beim Laden von ${entityName}:`, error);
          allData[entityName] = { error: error.message };
        }
      }
      
      // Metadata hinzufügen
      const backup = {
        metadata: {
          exportDate: new Date().toISOString(),
          appName: 'Floralog',
          version: '1.0',
          entityCount: entities.length
        },
        data: allData
      };
      
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Floralog_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportStatus({ all: 'success' });
      setTimeout(() => {
        setExportStatus({});
      }, 3000);
    } catch (error) {
      console.error('Fehler beim vollständigen Export:', error);
      setExportStatus({ all: 'error' });
      setTimeout(() => {
        setExportStatus({});
      }, 3000);
    }
  };

  const handleImport = async (event, entityName) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        alert('❌ Ungültiges Format! Erwartet wird ein Array von Objekten.');
        setImporting(false);
        return;
      }

      // Import durchführen
      let successCount = 0;
      let errorCount = 0;

      for (const item of data) {
        try {
          // Entferne System-Felder vor dem Import
          const { id, created_date, updated_date, created_by, ...cleanItem } = item;
          await base44.entities[entityName].create(cleanItem);
          successCount++;
        } catch (error) {
          console.error(`Fehler beim Import von Item:`, error);
          errorCount++;
        }
      }

      alert(`✅ Import abgeschlossen!\n\nErfolgreich: ${successCount}\nFehler: ${errorCount}`);
      setImporting(false);
    } catch (error) {
      console.error('Import Fehler:', error);
      alert(`❌ Import fehlgeschlagen: ${error.message}`);
      setImporting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-900">
            Nur Admins haben Zugriff auf diese Seite.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-stone-900 mb-2">📦 Daten-Backup</h1>
          <p className="text-stone-600">
            Exportiere und importiere alle Floralog-Daten
          </p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Wichtig:</strong> Dieser Backup enthält KEINE Secrets (PayPal, PlantNet API Keys).
            Diese müssen manuell neu hinzugefügt werden. User-Authentication wird von Base44 verwaltet.
          </AlertDescription>
        </Alert>

        {/* Vollständiger Export */}
        <Card className="mb-6 border-2 border-green-300 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <Database className="w-6 h-6" />
              Vollständiger Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-stone-600 mb-4">
              Exportiert ALLE Entities in einer einzigen JSON-Datei.
            </p>
            <Button
              onClick={exportAllEntities}
              disabled={exportStatus.all === 'loading'}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {exportStatus.all === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Exportiere alle Daten...
                </>
              ) : exportStatus.all === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Export erfolgreich!
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Alle Daten exportieren
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Einzelne Entities */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6" />
              Einzelne Entities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map(entityName => (
                <div key={entityName} className="border border-stone-200 rounded-lg p-4 bg-white">
                  <h3 className="font-semibold text-stone-900 mb-3">{entityName}</h3>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => exportEntity(entityName)}
                      disabled={exportStatus[entityName] === 'loading'}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {exportStatus[entityName] === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : exportStatus[entityName] === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <label className="flex-1">
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => handleImport(e, entityName)}
                        disabled={importing}
                        className="hidden"
                      />
                      <Button
                        as="span"
                        variant="outline"
                        size="sm"
                        className="w-full cursor-pointer"
                        disabled={importing}
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Anleitung */}
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">📖 Anleitung</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 space-y-2">
            <p><strong>Export:</strong> Klicke auf den Download-Button, um die Daten als JSON zu exportieren.</p>
            <p><strong>Import:</strong> Klicke auf den Upload-Button und wähle eine JSON-Datei aus.</p>
            <p><strong>⚠️ Wichtig beim Import:</strong> Bestehende Duplikate werden NICHT gelöscht. 
            Importiere nur in eine leere Datenbank oder bereinige vorher!</p>
            <p><strong>Code-Backup:</strong> Dein Code wird automatisch auf GitHub gesichert (bereits aktiviert).</p>
            <p><strong>Nach Wiederherstellung:</strong> Secrets (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PLANTNET_API_KEY) 
            müssen in den Base44-Einstellungen neu hinzugefügt werden.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/api/userApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLevelFromXP, getTitleForLevel } from "../components/utils/xpSystem";

export default function XPMigration() {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);

  const migrateMyAccount = async () => {
    setMigrating(true);
    setResult(null);

    try {
      const user = await getCurrentUser();
      const currentXP = user.xp || 0;
      
      const correctLevel = getLevelFromXP(currentXP);
      const correctTitle = getTitleForLevel(correctLevel);

      await base44.auth.updateMe({
        level: correctLevel,
        title: correctTitle
      });

      setResult({
        success: true,
        oldLevel: user.level,
        newLevel: correctLevel,
        totalXP: currentXP,
        newTitle: correctTitle
      });
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    }

    setMigrating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
            <CardTitle className="text-2xl">
              XP-System Migration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-blue-900 font-semibold">
                Diese Seite berechnet dein Level NEU basierend auf der neuen XP-Kurve.
              </p>
            </div>

            {!result && (
              <Button
                onClick={migrateMyAccount}
                disabled={migrating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 text-lg"
              >
                {migrating ? "Migriere..." : "Mein Level neu berechnen"}
              </Button>
            )}

            {result && result.success && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <p className="text-green-900 font-bold mb-3">✅ Migration erfolgreich!</p>
                <div className="space-y-2 text-green-900">
                  <p>Altes Level: <strong>Level {result.oldLevel}</strong></p>
                  <p>Neues Level: <strong>Level {result.newLevel}</strong></p>
                  <p>Gesamt-XP: <strong>{result.totalXP} XP</strong></p>
                  <p>Neuer Titel: <strong>{result.newTitle}</strong></p>
                </div>
                <p className="text-sm mt-4 pt-4 border-t border-green-300">
                  Gehe zurück zur Startseite! 🎉
                </p>
              </div>
            )}

            {result && !result.success && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-red-900 font-bold">❌ Fehler: {result.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetToLevel5() {
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const resetAccount = async () => {
    setResetting(true);
    
    try {
      // Level 5 benötigt: 100 + 150 + 200 + 250 + 300 = 1000 XP
      // Wir setzen auf 1000 XP = frisch Level 5
      await base44.auth.updateMe({
        level: 5,
        xp: 1000,
        title: "Pflanzen-Forscher 🔍"
      });
      
      setDone(true);
    } catch (error) {
      alert("Fehler: " + error.message);
    }
    
    setResetting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
      <div className="max-w-md mx-auto mt-20">
        <Card className="border-2 border-orange-200">
          <CardHeader className="bg-orange-50">
            <CardTitle className="text-xl">Account auf Level 5 zurücksetzen</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {!done ? (
              <>
                <p className="mb-4 text-stone-700">
                  Dies setzt deinen Account auf <strong>Level 5</strong> mit <strong>1.000 XP</strong> zurück.
                </p>
                <Button
                  onClick={resetAccount}
                  disabled={resetting}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4"
                >
                  {resetting ? "Wird zurückgesetzt..." : "Auf Level 5 zurücksetzen"}
                </Button>
              </>
            ) : (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <p className="text-green-900 font-bold mb-2">✅ Fertig!</p>
                <p className="text-green-800">Du bist jetzt Level 5 mit 1.000 XP!</p>
                <p className="text-sm mt-3 text-green-700">Gehe zur Startseite zurück! 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser, updateCurrentUserProfile } from "@/api/userApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, RotateCcw, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function ResetAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: userDiscoveries = [] } = useQuery({
    queryKey: ['userDiscoveries'],
    queryFn: () => Query.UserPlantDiscovery.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests'],
    queryFn: () => Query.UserQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements'],
    queryFn: () => Query.UserAchievement.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: myFriends = [] } = useQuery({
    queryKey: ['myFriends'],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      // Alle Freundschaften wo ich beteiligt bin (Sender oder Empfänger)
      return allFriends.filter(f => 
        f.request_sent_by?.toLowerCase() === user.email.toLowerCase() || 
        f.request_sent_to?.toLowerCase() === user.email.toLowerCase()
      );
    },
    enabled: !!user?.email,
  });

  const handleReset = async () => {
    if (confirmText.toLowerCase() !== "zurücksetzen") {
      alert('Bitte tippe "ZURÜCKSETZEN" ein, um fortzufahren.');
      return;
    }

    setIsResetting(true);

    try {
      // Log the user object for dashboard visibility
      console.log("Current user:", user);

      // 1. Lösche alle UserPlantDiscoveries
      console.log(`🗑️ Lösche ${userDiscoveries.length} Entdeckungen...`);
      for (const discovery of userDiscoveries) {
        await Query.UserPlantDiscovery.delete(discovery.id);
      }

      // 2. Lösche alle UserQuests
      console.log(`🗑️ Lösche ${userQuests.length} Quest-Fortschritte...`);
      for (const quest of userQuests) {
        await Query.UserQuest.delete(quest.id);
      }

      // 3. Lösche alle UserAchievements
      console.log(`🗑️ Lösche ${userAchievements.length} Erfolge...`);
      for (const achievement of userAchievements) {
        await Query.UserAchievement.delete(achievement.id);
      }

      // 4. Lösche ALLE Freundschaften wo ich beteiligt bin
      console.log(`🗑️ Lösche ${myFriends.length} Freundschaften...`);
      for (const friend of myFriends) {
        await Query.Friend.delete(friend.id);
      }

      // 5. Setze User-Daten zurück
      console.log("🔄 Setze User-Daten zurück...");
      await updateCurrentUserProfile({
        level: 1,
        xp: 0,
        avatar_url: null,
        title: "Pflanzen-Anfänger",
        selected_title: null,
        favorite_category: null
      });

      // Invalidiere alle Queries
      queryClient.invalidateQueries();

      setResetComplete(true);
      console.log("✅ Account erfolgreich zurückgesetzt!");

      // Leite nach 3 Sekunden zur Startseite
      setTimeout(() => {
        navigate(createPageUrl("Home"));
      }, 3000);

    } catch (error) {
      console.error("❌ Fehler beim Zurücksetzen:", error);
      alert(`Fehler: ${error.message}`);
      setIsResetting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  if (resetComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8 flex items-center justify-center">
        <Card className="border-2 border-green-200 shadow-xl bg-white max-w-md">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-stone-900 mb-4">
              Account zurückgesetzt! ✅
            </h2>
            <p className="text-lg text-stone-600 mb-6">
              Dein Floralog wurde komplett zurückgesetzt.
              <br />
              Viel Erfolg beim Neustart! 🌱
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-green-600 mx-auto" />
            <p className="text-sm text-stone-500 mt-2">
              Weiterleitung zur Startseite...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-red-600 mb-3">
            ⚠️ Account zurücksetzen
          </h1>
          <p className="text-lg text-stone-600">
            Achtung: Diese Aktion kann nicht rückgängig gemacht werden!
          </p>
        </div>

        <Card className="border-2 border-red-300 shadow-xl bg-white mb-6">
          <CardHeader className="bg-red-50 border-b border-red-200">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-6 h-6" />
              Was wird gelöscht?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">🗑️</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">Alle Pflanzen-Entdeckungen</p>
                  <p className="text-sm text-stone-600">{userDiscoveries.length} Entdeckungen werden gelöscht</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">🗑️</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">Alle Quest-Fortschritte</p>
                  <p className="text-sm text-stone-600">{userQuests.length} Quests werden zurückgesetzt</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">🗑️</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">Alle Erfolge</p>
                  <p className="text-sm text-stone-600">{userAchievements.length} Erfolge werden entfernt</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">🗑️</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">Alle Freundschaften</p>
                  <p className="text-sm text-stone-600">{myFriends.length} Freunde werden entfernt (auch bei ihnen!)</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">🔄</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">Level, XP, Titel und Avatar</p>
                  <p className="text-sm text-stone-600">Zurück auf Level 1 mit 0 XP</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Alert className="border-2 border-blue-200 bg-blue-50 mb-6">
          <AlertDescription className="text-blue-900">
            <strong>ℹ️ Hinweis:</strong> Dein Supabase-Account (E-Mail & Login) bleibt bestehen. 
            Nur deine PlantDex-Daten werden gelöscht.
          </AlertDescription>
        </Alert>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Bestätigung erforderlich</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">
                Tippe <span className="text-red-600 font-bold">"ZURÜCKSETZEN"</span> ein, um fortzufahren:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ZURÜCKSETZEN"
                className="border-2 border-stone-300"
                disabled={isResetting}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(createPageUrl("Profile"))}
                disabled={isResetting}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleReset}
                disabled={confirmText.toLowerCase() !== "zurücksetzen" || isResetting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird zurückgesetzt...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Account zurücksetzen
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

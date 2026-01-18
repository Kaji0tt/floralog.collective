import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Scroll, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_IMAGE = "";

export default function QuestNotificationTemplate() {
  const [showNotification, setShowNotification] = useState(false);
  const [questData, setQuestData] = useState({
    title: "🏆 Neue Wöchentliche Challenge!",
    questTitle: "Der Waldspaziergang",
    description: "Begib dich auf die Suche nach den geheimnisvollen Bäumen des Waldes! Scanne 3 verschiedene Baumarten und entdecke ihre einzigartigen Eigenschaften.",
    requirement: "Scanne 3 verschiedene Baumarten",
    xpReward: 100
  });
  const [characterImage, setCharacterImage] = useState(DEFAULT_IMAGE);
  const [queueCount, setQueueCount] = useState(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Quest Notification Template</h1>
        <p className="text-stone-600 mb-8">Design und teste die Quest-Benachrichtigungen</p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Einstellungen */}
          <Card className="border-2 border-stone-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Einstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Benachrichtigungstitel</Label>
                <Input
                  value={questData.title}
                  onChange={(e) => setQuestData({ ...questData, title: e.target.value })}
                  placeholder="z.B. 🏆 Neue Wöchentliche Challenge!"
                />
              </div>

              <div>
                <Label>Quest-Titel</Label>
                <Input
                  value={questData.questTitle}
                  onChange={(e) => setQuestData({ ...questData, questTitle: e.target.value })}
                  placeholder="z.B. Der Waldspaziergang"
                />
              </div>

              <div>
                <Label>Beschreibung</Label>
                <Textarea
                  value={questData.description}
                  onChange={(e) => setQuestData({ ...questData, description: e.target.value })}
                  placeholder="Quest-Beschreibung..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Anforderung (optional)</Label>
                <Input
                  value={questData.requirement}
                  onChange={(e) => setQuestData({ ...questData, requirement: e.target.value })}
                  placeholder="z.B. Scanne 3 verschiedene Baumarten"
                />
              </div>

              <div>
                <Label>XP-Belohnung</Label>
                <Input
                  type="number"
                  value={questData.xpReward}
                  onChange={(e) => setQuestData({ ...questData, xpReward: parseInt(e.target.value) || 0 })}
                  placeholder="z.B. 100"
                />
              </div>

              <div>
                <Label>Charakter-Bild URL</Label>
                <Input
                  value={characterImage}
                  onChange={(e) => setCharacterImage(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-xs text-stone-500 mt-1">
                  Aktuell: {characterImage === DEFAULT_IMAGE ? "Standard PlantDex Icon" : "Benutzerdefiniert"}
                </p>
              </div>

              <div>
                <Label>Warteschlangen-Anzahl (Simulation)</Label>
                <Input
                  type="number"
                  value={queueCount}
                  onChange={(e) => setQueueCount(parseInt(e.target.value) || 1)}
                  placeholder="z.B. 3"
                  min="1"
                  max="10"
                />
              </div>

              <Button
                onClick={() => setShowNotification(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Benachrichtigung anzeigen
              </Button>

              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-semibold text-sm text-amber-900 mb-2">💡 Tipps</h4>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li>• Tippe außerhalb der Sprechblase zum Schließen</li>
                  <li>• Lange Texte werden scrollbar</li>
                  <li>• Das Bild kann später in den Einstellungen geändert werden</li>
                  <li>• Mobile: Bild ist kleiner und unten links</li>
                  <li>• Desktop: Bild ist größer und rechts unten</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Live-Vorschau */}
          <div className="relative">
            <Card className="border-2 border-stone-200">
              <CardHeader>
                <CardTitle>Live-Vorschau</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-stone-500 mb-4">
                  Klicke auf "Benachrichtigung anzeigen" um die Vorschau zu sehen
                </p>
                <div className="h-[600px] overflow-y-auto snap-y snap-mandatory rounded-lg border-2 border-stone-300">
                  {/* Vorschau der Komponente */}
                  {showNotification && (
                    <div className="h-screen w-full snap-start bg-black/40 flex items-start justify-start p-6">
                      <div
                        className="relative w-full max-w-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Quest Content Box */}
                        <div className="bg-amber-50 border-4 border-amber-300 rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto relative">
                          {/* Schließen Button */}
                          <button
                            onClick={() => setShowNotification(false)}
                            className="absolute top-3 right-3 w-10 h-10 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center transition-colors z-10 shadow-lg"
                          >
                            <X className="w-6 h-6 text-amber-900" />
                          </button>

                          <div className="flex items-center gap-2 mb-4">
                            <Scroll className="w-6 h-6 text-amber-600" />
                            <h3 className="text-xl font-bold text-stone-900">
                              {questData.title}
                            </h3>
                          </div>

                          <h4 className="font-bold text-stone-900 mb-3 text-lg">
                            {questData.questTitle}
                          </h4>
                          
                          <p className="text-base text-stone-700 leading-relaxed mb-3">
                            {questData.description}
                          </p>
                          
                          {questData.requirement && (
                            <p className="text-sm text-stone-600 mb-3 italic bg-amber-100 p-3 rounded-lg border border-amber-200">
                              📋 {questData.requirement}
                            </p>
                          )}

                          {queueCount > 1 && (
                            <div className="mt-4 text-sm text-stone-500 text-center bg-amber-100 py-2 rounded-lg">
                              Weitere Quest wartet... ({queueCount - 1})
                            </div>
                          )}
                        </div>

                        {/* Person/Charakter Bild - unten rechts */}
                        <div className="fixed bottom-0 right-0 w-64 h-64">
                          <img
                            src={characterImage}
                            alt="Quest Giver"
                            className="absolute bottom-0 right-0 w-full h-full object-contain object-bottom-right drop-shadow-2xl"
                            onError={(e) => {
                              e.target.src = DEFAULT_IMAGE;
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Technische Hinweise */}
        <Card className="mt-8 border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">📝 Implementierungs-Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>• Das Bild kann später über <code className="bg-blue-200 px-1 rounded">user.quest_giver_image</code> im User-Entity gespeichert werden</p>
            <p>• Die Komponente prüft automatisch täglich/wöchentlich/monatlich auf neue Quests</p>
            <p>• Status wird in localStorage gespeichert um wiederholte Anzeigen zu verhindern</p>
            <p>• Mehrere Quests werden in einer Warteschlange verarbeitet</p>
            <p>• Responsive Design: Mobile (unten links) vs Desktop (rechts unten)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
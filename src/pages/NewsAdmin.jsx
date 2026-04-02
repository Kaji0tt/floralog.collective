import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Newspaper, Send } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function NewsAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const createUuid = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    // RFC4122 v4 fallback for environments without crypto.randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const randomNibble = Math.floor(Math.random() * 16);
      const value = char === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
      return value.toString(16);
    });
  };

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Nicht-Admins zur News-Seite weiterleiten
      if (currentUser?.role !== 'admin') {
        navigate(createPageUrl("News"));
      }
    };
    loadUser();
  }, [navigate]);

  const createNewsMutation = useMutation({
    mutationFn: (newsData) => Query.News.create(newsData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      setTitle("");
      setText("");
      alert("✅ Neuigkeit erfolgreich erstellt!");
    },
    onError: (error) => {
      alert(`❌ Fehler: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!title.trim() || !text.trim()) {
      alert("Bitte fülle Titel und Text aus.");
      return;
    }

    createNewsMutation.mutate({
      id: createUuid(),
      title: title.trim(),
      text: text.trim(),
      created_date: new Date().toISOString(),
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <div className="animate-spin text-green-600">⏳</div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3 flex items-center justify-center gap-3">
            <Newspaper className="w-10 h-10 text-green-600" />
            Neuigkeit erstellen
          </h1>
          <p className="text-lg text-stone-600">
            Erstelle eine neue Neuigkeit für alle Nutzer
          </p>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader className="border-b border-stone-200">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-6 h-6 text-green-600" />
              Neue Neuigkeit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Titel
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Neue Features verfügbar!"
                  className="text-lg"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Text
                </label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Beschreibe die Neuigkeit im Detail..."
                  className="min-h-[200px]"
                  maxLength={2000}
                />
                <div className="text-xs text-stone-500 mt-1 text-right">
                  {text.length}/2000 Zeichen
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(createPageUrl("News"))}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={createNewsMutation.isPending || !title.trim() || !text.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {createNewsMutation.isPending ? "Wird erstellt..." : "Erstellen"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
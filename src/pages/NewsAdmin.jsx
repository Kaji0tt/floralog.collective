import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Newspaper, Send, Loader2, AlertCircle } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/api/supabaseClient";

export default function NewsAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState("");

  const createUuid = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const randomNibble = Math.floor(Math.random() * 16);
      const value = char === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
      return value.toString(16);
    });
  };

  const normalizedRole = (value) => String(value || "").trim().toLowerCase();
  const isAdmin = user && (normalizedRole(user?.role) === "admin");

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoadError(null);
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        // Nicht-Admins zur News-Seite weiterleiten
        if (currentUser && normalizedRole(currentUser?.role) !== "admin") {
          setTimeout(() => navigate(createPageUrl("News")), 500);
        }
      } catch (error) {
        console.error("[NewsAdmin] Error loading user:", error);
        setLoadError("Fehler beim Laden des Profils");
      }
    };
    loadUser();
  }, [navigate]);

  const broadcastNewsMutation = useMutation({
    mutationFn: async ({ title, text }) => {
      setBroadcastStatus("Sende Push-Benachrichtigungen...");
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("broadcastNews", {
        body: { title, text, createdBy: user?.email },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Broadcast fehlgeschlagen");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setBroadcastStatus("");
      setTitle("");
      setText("");
      alert(`✅ Neuigkeit erstellt und an ${data.pushSent ?? 0} Spielende als Push-Benachrichtigung gesendet!`);
    },
    onError: (error) => {
      setBroadcastStatus("");
      alert(`❌ Fehler: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim() || !text.trim()) {
      alert("Bitte fülle Titel und Text aus.");
      return;
    }

    broadcastNewsMutation.mutate({ title: title.trim(), text: text.trim() });
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-stone-900 mb-2">Fehler</h2>
          <p className="text-stone-600">{loadError}</p>
          <Button onClick={() => navigate(createPageUrl("News"))} className="mt-4">
            Zur News-Seite
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-2" />
          <p className="text-stone-600">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-stone-900 mb-2">Zugriff verweigert</h2>
          <p className="text-stone-600">Du hast keine Berechtigung für diese Seite.</p>
          <Button onClick={() => navigate(createPageUrl("News"))} className="mt-4">
            Zur News-Seite
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3 flex items-center justify-center gap-3">
            <Newspaper className="w-8 h-8 md:w-10 md:h-10 text-green-600" />
            Nachricht senden
          </h1>
          <p className="text-base md:text-lg text-stone-600">
            Sende eine Neuigkeit an alle Spielenden
          </p>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader className="border-b border-stone-200">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Send className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              Neue Ankündigung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Titel
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Neue Features verfügbar!"
                  className="text-base"
                  maxLength={200}
                  disabled={broadcastNewsMutation.isPending}
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
                  className="min-h-[150px] md:min-h-[200px] text-base"
                  maxLength={2000}
                  disabled={broadcastNewsMutation.isPending}
                />
                <div className="text-xs text-stone-500 mt-1 text-right">
                  {text.length}/2000 Zeichen
                </div>
              </div>

              {broadcastStatus && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-700">{broadcastStatus}</span>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(createPageUrl("News"))}
                  className="flex-1"
                  disabled={broadcastNewsMutation.isPending}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={broadcastNewsMutation.isPending || !title.trim() || !text.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {broadcastNewsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      An alle senden
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
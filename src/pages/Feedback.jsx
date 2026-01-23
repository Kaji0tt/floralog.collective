import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, CheckCircle, Loader2, AlertCircle, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";

export default function Feedback() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !message) {
      setError("Bitte fülle alle Felder aus");
      return;
    }

    setSending(true);
    setError(null);

    try {
      await base44.integrations.Core.SendEmail({
        to: "jascha.kruse@web.de",
        subject: `PlantDex Feedback von ${name}`,
        body: `
Name: ${name}
E-Mail: ${email}

Nachricht:
${message}
        `
      });

      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
      
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      setError("Fehler beim Senden. Bitte versuche es erneut.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4">
            Dein Feedback 💬
          </h1>
          <p className="text-lg text-stone-600 max-w-xl mx-auto">
            PlantDex befindet sich aktuell noch in der Entwicklung. 
            Dein Feedback hilft mir, die App stetig zu verbessern!
          </p>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mb-6"
        >
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-stone-900 mb-2">
                    Ich freue mich über jede Art von Feedback!
                  </h3>
                  <ul className="space-y-1 text-sm text-stone-700">
                    <li>✓ Verbesserungsvorschläge</li>
                    <li>✓ Fehlerberichte</li>
                    <li>✓ Neue Feature-Ideen</li>
                    <li>✓ Allgemeines Feedback zur Bedienung</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* In Bearbeitung Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-6"
        >
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Wrench className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-stone-900 mb-2">
                    Aktuell in Bearbeitung 🛠️
                  </h3>
                  <ul className="space-y-1 text-sm text-stone-700">
                    <li>🗺️ Tägliche Quests mit geografischen Zonen (Sümpfe, Strand, Gebirge, ...)</li>
                    <li>📅 Mehr wöchentliche Quests</li>
                    <li>👥 Mehr Möglichkeiten zur Interaktion mit Freunden</li>
                    <li>🏠 Möglichkeit "Gruppen" zu erstellen</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feedback Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Card className="border-2 border-stone-200 shadow-lg bg-white">
            <CardHeader className="border-b border-stone-200">
              <CardTitle className="text-2xl flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-green-600" />
                Feedback senden
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900 mb-2">
                    Vielen Dank! 🎉
                  </h3>
                  <p className="text-stone-600">
                    Dein Feedback wurde erfolgreich gesendet.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-stone-700 mb-2 block">
                      Dein Name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Max Mustermann"
                      className="border-2 border-stone-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-stone-700 mb-2 block">
                      Deine E-Mail
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="max@beispiel.de"
                      className="border-2 border-stone-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-stone-700 mb-2 block">
                      Dein Feedback
                    </label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Beschreibe hier dein Feedback, Verbesserungsvorschläge oder berichte über Fehler..."
                      className="border-2 border-stone-200 min-h-[150px]"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Feedback absenden
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
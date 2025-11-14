
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Volume2, VolumeX, MapPin, Calendar } from "lucide-react";

export default function HintDialog({ genus, isOpen, onClose }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!genus) return null;

  const getCategoryHints = () => {
    switch(genus.category) {
      case "Bäume":
        return [
          { icon: Calendar, text: "Bäume sind das ganze Jahr über zu finden" },
          { icon: MapPin, text: "Suche in Parks, Wäldern und an Straßenrändern" }
        ];
      case "Sträucher":
        return [
          { icon: Calendar, text: "Blütezeit je nach Art unterschiedlich" },
          { icon: MapPin, text: "Häufig in Gärten, Parks und Hecken" }
        ];
      case "Blumen":
        return [
          { icon: Calendar, text: "Hauptsächlich im Frühling und Sommer" },
          { icon: MapPin, text: "Auf Wiesen, an Wegrändern und in Gärten" }
        ];
      default:
        return [];
    }
  };

  const getHintText = () => {
    let text = `Hinweise für diese Pflanze. `;
    
    if (genus.description) {
      text += genus.description + ". ";
    }
    
    // Kategorie-spezifische Hinweise
    const categoryHints = getCategoryHints();
    if (categoryHints.length > 0) {
      text += "So findest du diese Pflanze: ";
      categoryHints.forEach((hint, index) => {
        text += hint.text + ". ";
      });
    }
    
    return text;
  };

  const speakHint = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      if (isSpeaking) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(getHintText());
      utterance.lang = 'de-DE';
      utterance.rate = 1.2;
      utterance.pitch = 1;
      
      const voices = window.speechSynthesis.getVoices();
      const germanVoice = voices.find(voice => 
        voice.lang.startsWith('de') && 
        (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('männlich'))
      ) || voices.find(voice => voice.lang.startsWith('de'));
      
      if (germanVoice) {
        utterance.voice = germanVoice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const getCategoryIcon = () => {
    switch(genus.category) {
      case "Bäume": return "🌳";
      case "Sträucher": return "🌿";
      case "Blumen": return "🌸";
      default: return "🌱";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2 pr-8">
            <DialogTitle className="text-2xl font-bold text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              Hinweise
            </DialogTitle>
            <Button
              onClick={speakHint}
              variant="outline"
              size="icon"
              className={`border-2 ${isSpeaking ? 'border-amber-500 bg-amber-50' : 'border-stone-300'}`}
            >
              {isSpeaking ? (
                <VolumeX className="w-5 h-5 text-amber-600" />
              ) : (
                <Volume2 className="w-5 h-5 text-stone-600" />
              )}
            </Button>
          </div>
          <DialogDescription className="text-base text-stone-600">
            Tipps zum Finden dieser Pflanze
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gattung Info */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl">{getCategoryIcon()}</div>
              <div>
                <h3 className="font-bold text-xl text-stone-900">{genus.name}</h3>
                <Badge className="bg-stone-700 text-white mt-1">
                  {genus.category}
                </Badge>
              </div>
            </div>
            {genus.description && (
              <p className="text-sm text-stone-700 leading-relaxed">
                {genus.description}
              </p>
            )}
          </div>

          {/* Kategorie-spezifische Hinweise */}
          <div className="space-y-3">
            <h4 className="font-bold text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              So findest du diese Pflanze:
            </h4>
            {getCategoryHints().map((hint, index) => (
              <div key={index} className="flex items-start gap-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                <hint.icon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-stone-700">{hint.text}</p>
              </div>
            ))}
          </div>

          {/* Familie Info */}
          {genus.family && (
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-sm font-semibold text-purple-900">
                🔬 Familie: {genus.family}
              </p>
            </div>
          )}

          {/* Call to Action */}
          <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200 text-center">
            <p className="font-semibold text-green-900 mb-2">
              📸 Bereit zum Scannen?
            </p>
            <p className="text-sm text-stone-700">
              Gehe raus und scanne die Pflanze, wenn du sie gefunden hast!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

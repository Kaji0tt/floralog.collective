import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Volume2, VolumeX, Search } from "lucide-react";

export default function HintDialog({ genus, isOpen, onClose }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!genus) return null;

  const handleSearchPlant = () => {
    const searchQuery = encodeURIComponent(`Wo finde ich ${genus.genus_name}`);
    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
  };

  const getHintText = () => {
    let text = `Hinweise für ${genus.genus_name}. `;
    
    if (genus.description) {
      text += genus.description;
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
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border-2 border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl">{getCategoryIcon()}</div>
              <div>
                <h3 className="font-bold text-2xl text-stone-900">{genus.genus_name}</h3>
                <p className="text-sm italic text-stone-600">{genus.scientific_genus}</p>
                <Badge className="bg-stone-700 text-white mt-2">
                  {genus.category}
                </Badge>
              </div>
            </div>
            {genus.description && (
              <p className="text-sm text-stone-700 leading-relaxed mt-3">
                {genus.description}
              </p>
            )}
          </div>

          {/* Familie Info */}
          {genus.family && (
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm font-semibold text-purple-900">
                🔬 Familie: {genus.family}
              </p>
            </div>
          )}

          {/* Google Suche Button */}
          <Button
            onClick={handleSearchPlant}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base"
          >
            <Search className="w-5 h-5 mr-2" />
            Pflanze nachschlagen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
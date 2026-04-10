import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Volume2, VolumeX, Search } from "lucide-react";

export default function HintDialog({ genus, isOpen, onClose, isLightUi = true }) {
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
      <DialogContent className={`max-w-md w-[95vw] sm:w-full ${!isLightUi ? "bg-[#1a1d1a] border-[#f0e5a5]/20" : ""}`}>
        <DialogHeader>
          <div className="flex items-center justify-between mb-2 pr-8">
            <DialogTitle className={`text-xl sm:text-2xl font-bold flex items-center gap-2 flex-1 min-w-0 ${!isLightUi ? "text-stone-100" : "text-stone-900"}`}>
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 flex-shrink-0" />
              <span className="truncate">Hinweise</span>
            </DialogTitle>
            <Button
              onClick={speakHint}
              variant="outline"
              size="icon"
              className={`border-2 ${isSpeaking
                ? 'border-amber-500 bg-amber-50'
                : (!isLightUi ? 'border-stone-600 bg-stone-800/40' : 'border-stone-300')}`}
            >
              {isSpeaking ? (
                <VolumeX className="w-5 h-5 text-amber-600" />
              ) : (
                <Volume2 className={`w-5 h-5 ${!isLightUi ? "text-stone-300" : "text-stone-600"}`} />
              )}
            </Button>
          </div>
          <DialogDescription className={`text-base ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>
            Tipps zum Finden dieser Pflanze
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gattung Info */}
          <div className={`rounded-xl p-4 border-2 overflow-hidden ${!isLightUi ? "bg-amber-900/20 border-amber-700/40" : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl sm:text-4xl flex-shrink-0">{getCategoryIcon()}</div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-lg sm:text-2xl break-words ${!isLightUi ? "text-stone-100" : "text-stone-900"}`}>{genus.genus_name}</h3>
                <p className={`text-xs sm:text-sm italic break-words ${!isLightUi ? "text-stone-400" : "text-stone-600"}`}>{genus.scientific_genus}</p>
                <Badge className="bg-stone-700 text-white mt-2 text-xs">
                  {genus.category}
                </Badge>
              </div>
            </div>
            {genus.description && (
              <p className={`text-xs sm:text-sm leading-relaxed mt-3 break-words ${!isLightUi ? "text-stone-300" : "text-stone-700"}`}>
                {genus.description}
              </p>
            )}
          </div>

          {/* Familie Info */}
          {genus.family && (
            <div className={`rounded-lg p-3 sm:p-4 border overflow-hidden ${!isLightUi ? "bg-purple-900/20 border-purple-700/40" : "bg-purple-50 border-purple-200"}`}>
              <p className={`text-xs sm:text-sm font-semibold break-words ${!isLightUi ? "text-purple-200" : "text-purple-900"}`}>
                🔬 Familie: {genus.family}
              </p>
            </div>
          )}

          {/* Google Suche Button */}
          <Button
            onClick={handleSearchPlant}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 sm:py-6 text-sm sm:text-base"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            <span className="truncate">Pflanze nachschlagen</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
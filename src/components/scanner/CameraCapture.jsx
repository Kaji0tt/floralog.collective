import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, SwitchCamera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Bildkomprimierung
function compressImage(file, maxSizeMB = 1) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Max 1920px Breite
        const maxWidth = 1920;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Komprimiere zu JPEG mit 85% Qualität
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, { 
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log(`Bild komprimiert: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
          } else {
            reject(new Error('Komprimierung fehlgeschlagen'));
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [selectedOrgan, setSelectedOrgan] = useState("auto");
  const [facingMode, setFacingMode] = useState(isMobile ? 'environment' : 'environment'); // Standardmäßig Rückkamera

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]); // Neu starten wenn facingMode sich ändert

  const startCamera = async () => {
    try {
      // Stoppe alte Kamera falls vorhanden
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsReady(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Kamera konnte nicht gestartet werden. Bitte erlaube den Kamerazugriff.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !isReady) return;

    console.log("🎥 capturePhoto gestartet");
    console.log("  videoRef.current:", videoRef.current);
    console.log("  isReady:", isReady);

    // Prüfe ob Video-Dimensionen gültig sind
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    
    console.log("  Video Dimensionen:", videoWidth, "x", videoHeight);
    
    if (!videoWidth || !videoHeight || videoWidth === 0 || videoHeight === 0) {
      console.error("❌ Video noch nicht bereit - Dimensionen:", videoWidth, videoHeight);
      alert("Bitte warte einen Moment bis die Kamera vollständig geladen ist.");
      return;
    }

    setIsCompressing(true);
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      console.log("  Canvas erstellt:", canvas.width, "x", canvas.height);
      
      const ctx = canvas.getContext('2d');
      
      // Zeichne das Video-Frame auf den Canvas
      ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
      console.log("  Video auf Canvas gezeichnet");

      // Erstelle Blob vom Canvas
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.95);
      });
      
      console.log("  Blob erstellt:", blob);
      console.log("  Blob size:", blob ? (blob.size / 1024).toFixed(2) + "KB" : "null");
      
      if (!blob) {
        throw new Error("Fehler beim Erstellen des Bildes");
      }
      
      const file = new File([blob], `plant-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      console.log("📸 Foto aufgenommen - Größe:", (file.size / 1024 / 1024).toFixed(2) + "MB");
      
      // Komprimiere das Bild
      const compressedFile = await compressImage(file);
      
      console.log("✅ Foto komprimiert - rufe onCapture auf");
      
      // Stoppe Kamera erst NACH erfolgreicher Kompression
      stopCamera();
      onCapture(compressedFile, selectedOrgan);
    } catch (error) {
      console.error("❌ Fehler beim Erfassen des Fotos:", error);
      alert("Fehler beim Aufnehmen des Fotos. Bitte versuche es erneut.");
      setIsCompressing(false);
    }
  };

  const organOptions = [
    { value: "auto", label: "🤖 Automatisch", description: "KI erkennt den Pflanzenteil" },
    { value: "flower", label: "🌸 Blüte", description: "Fotografiere die Blüten" },
    { value: "leaf", label: "🍃 Blatt", description: "Fotografiere die Blätter" },
    { value: "fruit", label: "🍎 Frucht", description: "Fotografiere Früchte/Beeren" },
    { value: "bark", label: "🌳 Rinde", description: "Fotografiere die Baumrinde" },
    { value: "habit", label: "🌿 Wuchsform", description: "Fotografiere die ganze Pflanze" }
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-green-600" />
            Pflanzenfoto aufnehmen
          </DialogTitle>
        </DialogHeader>
        
        {/* Pflanzenteile-Auswahl */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-stone-700">
            Was möchtest du fotografieren?
          </Label>
          <Select value={selectedOrgan} onValueChange={setSelectedOrgan}>
            <SelectTrigger className="border-2 border-stone-200">
              <SelectValue placeholder="Wähle einen Pflanzenteil" />
            </SelectTrigger>
            <SelectContent>
              {organOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-xs text-stone-500">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                Kamera wird gestartet...
              </div>
            </div>
          )}
          
          {isCompressing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <div className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                Bild wird optimiert...
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 border-4 border-green-400/50 rounded-xl pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/80 rounded-lg" />
          </div>

          {/* Kamera-Wechsel-Button */}
          {isReady && (
            <Button
              onClick={switchCamera}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white text-stone-900 shadow-lg z-10"
              size="icon"
              disabled={isCompressing}
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isCompressing}>
            <X className="w-4 h-4 mr-2" />
            Abbrechen
          </Button>
          <Button
            onClick={capturePhoto}
            disabled={!isReady || isCompressing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isCompressing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verarbeite...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                Aufnehmen
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
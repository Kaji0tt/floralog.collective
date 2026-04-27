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
      <DialogContent className="fixed inset-0 !max-w-full !w-full !h-full !rounded-none !p-0 bg-black/95 flex flex-col justify-between items-stretch z-[100] overflow-hidden">
        {/* Dropdown oben mit Liquid Glass Effekt */}
        <div className="absolute top-0 left-0 w-full flex justify-center z-20 p-4">
          <div className="backdrop-blur-xl bg-black/40 border border-[#f0e5a5]/30 rounded-2xl px-4 py-2 shadow-lg flex flex-col items-center w-full max-w-xs">
            <Label className="text-sm font-semibold text-stone-100 mb-1">Was möchtest du fotografieren?</Label>
            <Select value={selectedOrgan} onValueChange={setSelectedOrgan}>
              <SelectTrigger className="border border-[#f0e5a5]/35 bg-black/40 text-stone-100 rounded-xl">
                <SelectValue placeholder="Wähle einen Pflanzenteil" />
              </SelectTrigger>
              <SelectContent className="border border-[#f0e5a5]/30 bg-black/90 text-stone-100 rounded-xl">
                {organOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-xs text-stone-300">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Kamera-Viewport */}
        <div className="relative flex-1 flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center text-stone-100 bg-black/45 z-30">
              <div className="flex items-center gap-2 rounded-xl border border-[#f0e5a5]/25 bg-black/40 px-4 py-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                Kamera wird gestartet...
              </div>
            </div>
          )}
          {isCompressing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-stone-100 z-30">
              <div className="flex items-center gap-2 rounded-xl border border-[#f0e5a5]/25 bg-black/45 px-4 py-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                Bild wird optimiert...
              </div>
            </div>
          )}
          {/* Kamera-Wechsel-Button */}
          {isReady && (
            <Button
              onClick={switchCamera}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/75 text-stone-100 border border-[#f0e5a5]/35 shadow-lg z-40"
              size="icon"
              disabled={isCompressing}
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Aufnahme- und Abbrechen-Button unten */}
        <div className="relative w-full flex justify-center items-end pb-8 z-40">
          <div className="flex flex-row gap-6 items-center">
            {/* Aufnahme-Button groß, grün */}
            <button
              onClick={capturePhoto}
              disabled={!isReady || isCompressing}
              className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 flex items-center justify-center shadow-xl border-4 border-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 0 8px rgba(16,185,129,0.15)' }}
            >
              <Camera className="w-10 h-10 text-white" />
            </button>
            {/* Abbrechen-Button kleiner, rund, transparent */}
            <button
              onClick={onClose}
              disabled={isCompressing}
              className="w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center border-2 border-red-400/60 text-red-600 transition-all duration-150"
              style={{ backdropFilter: 'blur(6px)' }}
            >
              <X className="w-7 h-7" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
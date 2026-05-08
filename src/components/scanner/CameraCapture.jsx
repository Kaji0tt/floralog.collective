import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, SwitchCamera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Bildkomprimierung
function compressImage(file, maxSizeMB = 1) {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const result = event?.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Fehler beim Lesen der Bilddatei'));
        return;
      }
      const img = new Image();
      img.src = result;
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
        if (!ctx) {
          reject(new Error('Canvas-Context konnte nicht erstellt werden'));
          return;
        }
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
/**
 * @param {{ onCapture: (file: File, organ: string) => void, onClose: () => void }} props
 */
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraViewportRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const trackRef = useRef(null);
  const pinchStartDistanceRef = useRef(null);
  const pinchStartZoomRef = useRef(1);
  const pinchAnimationFrameRef = useRef(null);
  const pendingZoomRef = useRef(null);
  const zoomRangeRef = useRef({ min: 1, max: 1, step: 0.1 });
  const [selectedOrgan, setSelectedOrgan] = useState("auto");
  const [facingMode, setFacingMode] = useState(isMobile ? 'environment' : 'environment'); // Standardmäßig Rückkamera
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomLevel, setZoomLevel] = useState(1);

  const clampZoom = (value) => {
    const range = zoomRangeRef.current;
    return Math.min(range.max, Math.max(range.min, value));
  };

  const getTouchDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const applyZoom = async (nextZoom) => {
    const track = trackRef.current;
    if (!track || !zoomSupported) return;

    const clampedZoom = clampZoom(nextZoom);
    try {
      await track.applyConstraints({ advanced: [{ zoom: clampedZoom }] });
      setZoomLevel(clampedZoom);
    } catch (error) {
      console.warn("Kamera-Zoom konnte nicht gesetzt werden:", error);
    }
  };

  const scheduleZoom = (nextZoom) => {
    pendingZoomRef.current = nextZoom;
    if (pinchAnimationFrameRef.current) return;

    pinchAnimationFrameRef.current = window.requestAnimationFrame(async () => {
      const zoomToApply = pendingZoomRef.current;
      pinchAnimationFrameRef.current = null;
      pendingZoomRef.current = null;
      if (zoomToApply != null) {
        await applyZoom(zoomToApply);
      }
    });
  };

  const initializeZoomSupport = async (stream) => {
    const [track] = stream.getVideoTracks();
    trackRef.current = track || null;

    if (!track || typeof track.getCapabilities !== "function") {
      setZoomSupported(false);
      setZoomLevel(1);
      return;
    }

    const capabilities = track.getCapabilities();
    const zoomCapability = capabilities?.zoom;
    if (!zoomCapability) {
      setZoomSupported(false);
      setZoomLevel(1);
      return;
    }

    const min = Number(zoomCapability.min ?? 1);
    const max = Number(zoomCapability.max ?? min);
    const step = Number(zoomCapability.step ?? 0.1);
    const supportsZoomRange = Number.isFinite(min) && Number.isFinite(max) && max > min;

    const nextRange = {
      min: Number.isFinite(min) ? min : 1,
      max: Number.isFinite(max) ? max : 1,
      step: Number.isFinite(step) && step > 0 ? step : 0.1
    };

    zoomRangeRef.current = nextRange;
    setZoomRange(nextRange);
    setZoomSupported(supportsZoomRange);

    const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
    const initialZoom = supportsZoomRange
      ? clampZoom(Number(settings?.zoom ?? nextRange.min))
      : 1;

    setZoomLevel(initialZoom);
    if (supportsZoomRange) {
      await applyZoom(initialZoom);
    }
  };

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
      await initializeZoomSupport(stream);
      setIsReady(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Kamera konnte nicht gestartet werden. Bitte erlaube den Kamerazugriff.");
    }
  };

  const stopCamera = () => {
    if (pinchAnimationFrameRef.current) {
      window.cancelAnimationFrame(pinchAnimationFrameRef.current);
      pinchAnimationFrameRef.current = null;
    }

    pendingZoomRef.current = null;
    pinchStartDistanceRef.current = null;
    trackRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setZoomSupported(false);
    setZoomLevel(1);
    setIsReady(false);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    const viewport = cameraViewportRef.current;
    if (!viewport) return;

    const onTouchStart = (event) => {
      if (!zoomSupported || event.touches.length !== 2) return;
      pinchStartDistanceRef.current = getTouchDistance(event.touches);
      pinchStartZoomRef.current = zoomLevel;
    };

    const onTouchMove = (event) => {
      if (!zoomSupported || event.touches.length !== 2 || !pinchStartDistanceRef.current) return;
      event.preventDefault();

      const distance = getTouchDistance(event.touches);
      if (!distance) return;

      const scale = distance / pinchStartDistanceRef.current;
      const nextZoom = pinchStartZoomRef.current * scale;
      scheduleZoom(nextZoom);
    };

    const onTouchEnd = () => {
      pinchStartDistanceRef.current = null;
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [zoomSupported, zoomLevel]);

  const capturePhoto = async () => {
    if (!videoRef.current || !isReady) return;

    console.log("🎥 capturePhoto gestartet");
    console.log("  videoRef.current:", videoRef.current);
    console.log("  isReady:", isReady);

    // Prüfe ob Video-Dimensionen gültig sind
    const videoWidth = videoRef.current?.videoWidth;
    const videoHeight = videoRef.current?.videoHeight;
    
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
      if (!ctx || !videoRef.current) throw new Error('Canvas oder Video nicht bereit');
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
    <div className="flex flex-col gap-4 w-full h-full items-center justify-center">
      {/* Dropdown oben */}
      <div className="w-full flex justify-center z-10 p-2">
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
      <div
        ref={cameraViewportRef}
        className="relative w-full flex-1 flex items-center justify-center bg-black rounded-2xl overflow-hidden"
        style={{ minHeight: 260, maxHeight: 420, touchAction: 'none' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: 'block', maxHeight: 400, touchAction: 'none' }}
        />
        {/* Overlays */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-100 bg-black/45 z-20">
            <div className="flex items-center gap-2 rounded-xl border border-[#f0e5a5]/25 bg-black/40 px-4 py-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Kamera wird gestartet...
            </div>
          </div>
        )}
        {isCompressing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-stone-100 z-20">
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
            className="absolute top-3 right-3 bg-black/60 hover:bg-black/75 text-stone-100 border border-[#f0e5a5]/35 shadow-lg z-30"
            size="icon"
            disabled={isCompressing}
          >
            <SwitchCamera className="w-5 h-5" />
          </Button>
        )}

        {isReady && zoomSupported && (
          <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-stone-200 shrink-0 w-10 text-right">{zoomLevel.toFixed(1)}x</span>
            <input
              type="range"
              min={zoomRange.min}
              max={zoomRange.max}
              step={zoomRange.step}
              value={zoomLevel}
              onChange={(event) => applyZoom(Number(event.target.value))}
              className="flex-1 h-1 accent-emerald-400 cursor-pointer"
              aria-label="Kamera-Zoom"
              style={{ accentColor: '#34d399' }}
            />
          </div>
        )}
      </div>

      {/* Aufnahme- und Zurück-Button unten */}
      <div className="w-full flex justify-center items-center gap-6 pt-4">
        {/* Zurück-Button */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.location) {
              window.location.href = '/';
            } else if (typeof navigate === 'function') {
              navigate('/');
            } else {
              onClose();
            }
          }}
          disabled={isCompressing}
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 flex items-center justify-center shadow-xl border-4 border-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 0 0 6px rgba(59,130,246,0.13)' }}
          aria-label="Zurück"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {/* Aufnahme-Button groß, grün */}
        <button
          onClick={capturePhoto}
          disabled={!isReady || isCompressing}
          className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 flex items-center justify-center shadow-xl border-4 border-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 0 0 8px rgba(16,185,129,0.15)' }}
        >
          <Camera className="w-10 h-10 text-white" />
        </button>
      </div>
    </div>
  );
}
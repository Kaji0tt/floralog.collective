import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function MobileBackButton({ backUrl = null, backState = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Position aus localStorage laden oder Standard setzen
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('mobileButtonPosition');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });
  
  // Prüfe ob wir im Freundes-PlantDex sind (via URL-Parameter)
  const urlParams = new URLSearchParams(location.search);
  const friendEmail = urlParams.get('email');
  
  // Wenn backUrl übergeben wurde, nutze diesen
  // Ansonsten: Wenn friendEmail existiert, zurück zur FriendCollection
  // Sonst: Home
  const getTargetUrl = () => {
    if (backUrl) return backUrl;
    if (friendEmail) return createPageUrl(`FriendCollection?email=${friendEmail}`);
    return createPageUrl("Home");
  };
  
  const targetUrl = getTargetUrl();
  const isFriendContext = !!friendEmail || !!backUrl;

  // Position speichern bei Änderung
  const handleDragEnd = (event, info) => {
    const newPosition = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    };
    setPosition(newPosition);
    localStorage.setItem('mobileButtonPosition', JSON.stringify(newPosition));
  };

  return (
    <motion.div 
      className="fixed bottom-4 left-4 z-50"
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      style={{ x: position.x, y: position.y }}
    >
      <Button
        onClick={() => navigate(targetUrl, backState ? { state: backState } : undefined)}
        className="w-16 h-16 bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg border-2 border-stone-200 text-stone-900 rounded-full cursor-move"
      >
        {isFriendContext ? (
          <ArrowLeft className="w-8 h-8" />
        ) : (
          <Home className="w-8 h-8" />
        )}
      </Button>
    </motion.div>
  );
}
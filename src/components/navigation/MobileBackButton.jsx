import { useNavigate, useLocation } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function MobileBackButton({ backUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  
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

  return (
    <div className="md:hidden fixed bottom-4 left-4 z-50">
      <Button
        onClick={() => navigate(targetUrl)}
        className="w-16 h-16 bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg border-2 border-stone-200 text-stone-900 rounded-full"
      >
        {isFriendContext ? (
          <ArrowLeft className="w-8 h-8" />
        ) : (
          <Home className="w-8 h-8" />
        )}
      </Button>
    </div>
  );
}
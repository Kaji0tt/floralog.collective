import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function FloatingHomeButton() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Verstecke auf der Home-Seite
  if (location.pathname === createPageUrl("Home")) {
    return null;
  }

  return (
    <motion.div 
      className="fixed bottom-6 left-6 z-50"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <Button
        onClick={() => navigate(createPageUrl("Home"))}
        className="w-16 h-16 bg-green-600 hover:bg-green-700 shadow-xl text-white rounded-full"
      >
        <Home className="w-8 h-8" />
      </Button>
    </motion.div>
  );
}
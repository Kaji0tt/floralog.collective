import React, { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function ConfirmButton({ currentResultIndex, onClick }) {
  // Position aus localStorage laden oder Standard setzen
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('mobileButtonPosition');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

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
      className="md:hidden fixed bottom-4 left-4 z-50"
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      animate={position}
      style={{ x: position.x, y: position.y }}
    >
      <Button
        onClick={onClick}
        className={`w-16 h-16 shadow-lg border-2 border-white text-white rounded-full cursor-move ${
          currentResultIndex === 0 
            ? "bg-green-600 hover:bg-green-700" 
            : "bg-orange-600 hover:bg-orange-700"
        }`}
      >
        {currentResultIndex === 0 ? (
          <Check className="w-8 h-8" />
        ) : (
          <RefreshCw className="w-8 h-8" />
        )}
      </Button>
    </motion.div>
  );
}
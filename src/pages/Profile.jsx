import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Settings } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function Profile() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl("Home"), {
      replace: true,
      state: { openSettings: true },
    });
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-stone-900 via-emerald-950 to-stone-950 text-stone-200">
      <div className="flex items-center gap-3 rounded-2xl border border-[#f0e5a5]/25 bg-black/35 px-4 py-3 backdrop-blur-sm">
        <div className="relative">
          <Settings className="w-5 h-5 text-[#f0e5a5]" />
          <Loader2 className="absolute -right-2 -bottom-2 w-3 h-3 animate-spin text-lime-200" />
        </div>
        <span className="text-sm font-medium">Einstellungen werden geladen...</span>
      </div>
    </div>
  );
}

import React from "react";
import { Leaf } from "lucide-react";

export default function HomeShellLoader({
  backgroundImageUrl = null,
  backgroundColor = null,
  showProfileCard = true,
}) {
  const pageShellBackgroundStyle = backgroundImageUrl
    ? {
      backgroundImage: `url(${backgroundImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
    : backgroundColor
      ? {
        background: `linear-gradient(160deg, ${backgroundColor} 0%, rgba(12, 20, 15, 0.88) 100%)`,
      }
      : {
        background: "radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)",
      };

  return (
    <div className="fixed inset-0 overflow-hidden" data-ui="home-page-shell">
      <div className="absolute inset-0" style={pageShellBackgroundStyle} />
      <div className="absolute inset-0 backdrop-blur-3xl" />

      <div className="relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center">
        {showProfileCard ? (
          <div className="relative h-[calc(100%-1.50rem)] md:h-[calc(100%-1.50rem)] w-full max-w-md md:max-w-3xl rounded-[2rem] overflow-hidden border border-[#d7cf9c]/65 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 to-black/70" />
            <div className="absolute inset-0 border border-[#f0e5a5]/30 pointer-events-none rounded-[2rem]" />
            <div className="relative z-10 h-full flex items-center justify-center">
              <Leaf className="w-14 h-14 text-[#f0e5a5] animate-spin" />
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center">
            <Leaf className="w-12 h-12 text-[#f0e5a5] animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

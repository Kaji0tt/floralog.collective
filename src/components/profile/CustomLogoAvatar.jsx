import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { hexToFilter } from "@/lib/hexToFilter";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import PlayerInfoCard from "@/components/profile/PlayerInfoCard";

/**
 * @param {{
 *   logoAssets?: {
 *     border?: { imageUrl?: string },
 *     plant?: { imageUrl?: string },
 *     face?: { imageUrl?: string },
 *     borderColor?: string | null,
 *   } | null,
 *   className?: string,
 *   innerClassName?: string,
 *   fallbackText?: string,
 *   fallbackClassName?: string,
 *   leafClassName?: string,
 *   tooltipText?: string,
 *   playerAuthId?: string | null,
 *   noClip?: boolean,
 * }} props
 */
export default function CustomLogoAvatar({
  logoAssets,
  className,
  innerClassName,
  fallbackText,
  fallbackClassName,
  leafClassName,
  tooltipText,
  playerAuthId = null,
  noClip = false,
}) {
  const rootRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isPlayerCardOpen, setIsPlayerCardOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const hasLogoLayers = Boolean(
    logoAssets?.border?.imageUrl || logoAssets?.plant?.imageUrl || logoAssets?.face?.imageUrl
  );
  const resolvedTooltipText = String(tooltipText || "").trim();

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const openTooltip = () => {
    if (!resolvedTooltipText || !rootRef.current) return;

    const rect = rootRef.current.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
    setIsTooltipOpen(true);

    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsTooltipOpen(false);
      closeTimeoutRef.current = null;
    }, 1600);
  };

  const handleAvatarClick = (event) => {
    if (playerAuthId) {
      event.stopPropagation();
      event.preventDefault();
      setIsPlayerCardOpen((open) => !open);
      return;
    }
    if (!resolvedTooltipText) return;
    event.stopPropagation();
    event.preventDefault();
    openTooltip();
  };

  const handleKeyDown = (event) => {
    if (!resolvedTooltipText && !playerAuthId) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (playerAuthId) setIsPlayerCardOpen((open) => !open);
      else openTooltip();
    }
  };

  const renderLogo = (sizeClass = className) => (
    <div
      ref={sizeClass === className ? rootRef : undefined}
      className={cn("relative", !noClip && "rounded-full overflow-hidden", sizeClass)}
      style={{ containerType: "size" }}
      onClick={sizeClass === className ? handleAvatarClick : undefined}
      onKeyDown={sizeClass === className ? handleKeyDown : undefined}
      role={sizeClass === className && (resolvedTooltipText || playerAuthId) ? "button" : undefined}
      tabIndex={sizeClass === className && (resolvedTooltipText || playerAuthId) ? 0 : undefined}
      aria-expanded={sizeClass === className && playerAuthId ? isPlayerCardOpen : undefined}
    >
      <div className={cn("absolute inset-0 flex items-center justify-center", hasLogoLayers && "scale-[1.5]", innerClassName)}>
        {hasLogoLayers && (
          <div className="absolute left-1/2 top-1/2 h-[72cqmin] w-[72cqmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.3)_42%,rgba(0,0,0,0)_70%)]" />
        )}
        {logoAssets?.plant?.imageUrl && <img src={logoAssets.plant.imageUrl} alt="Logo Pflanze" className="absolute inset-0 h-full w-full object-contain" />}
        {logoAssets?.border?.imageUrl && (
          <img
            src={logoAssets.border.imageUrl}
            alt="Logo Rahmen"
            className="absolute inset-0 h-full w-full object-contain"
            style={logoAssets.borderColor ? { filter: `brightness(0) saturate(100%) ${hexToFilter(logoAssets.borderColor)}` } : undefined}
          />
        )}
        {logoAssets?.face?.imageUrl && <img src={logoAssets.face.imageUrl} alt="Logo Gesicht" className="absolute inset-0 h-full w-full object-contain" />}
        {!hasLogoLayers && (
          fallbackText
            ? <span className={cn("text-xs font-semibold text-white", fallbackClassName)}>{fallbackText}</span>
            : <Leaf className={cn("h-full w-full text-white", leafClassName)} />
        )}
      </div>
    </div>
  );

  return (
    <>
      {playerAuthId ? (
        <Popover open={isPlayerCardOpen} onOpenChange={setIsPlayerCardOpen}>
          <PopoverAnchor asChild>{renderLogo()}</PopoverAnchor>
          <PopoverContent
            className="w-auto border-0 bg-transparent p-0 shadow-none"
            sideOffset={10}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <PlayerInfoCard
              playerAuthId={playerAuthId}
              fallbackName={resolvedTooltipText}
              logo={renderLogo("h-24 w-24")}
              onNavigate={() => setIsPlayerCardOpen(false)}
            />
          </PopoverContent>
        </Popover>
      ) : renderLogo()}

      {!playerAuthId && isTooltipOpen && resolvedTooltipText && createPortal(
        <div
          className="fixed z-[1300] pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="rounded-md border border-stone-300/80 bg-stone-950/95 px-2 py-1 text-[11px] font-medium text-stone-50 shadow-lg backdrop-blur-sm">
            {resolvedTooltipText}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { hexToFilter } from "@/lib/hexToFilter";

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
  noClip = false,
}) {
  const rootRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
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
    if (!resolvedTooltipText) return;
    event.stopPropagation();
    event.preventDefault();
    openTooltip();
  };

  const handleKeyDown = (event) => {
    if (!resolvedTooltipText) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      openTooltip();
    }
  };

  return (
    <>
      <div
        ref={rootRef}
        className={cn("relative", !noClip && "rounded-full overflow-hidden", className)}
        style={{ containerType: "size" }}
        onClick={handleAvatarClick}
        onKeyDown={handleKeyDown}
        role={resolvedTooltipText ? "button" : undefined}
        tabIndex={resolvedTooltipText ? 0 : undefined}
      >
        <div className={cn("absolute inset-0 flex items-center justify-center", hasLogoLayers && "scale-[1.5]", innerClassName)}>
          {hasLogoLayers && (
            // cqmin keeps this a true circle even when the container itself isn't square.
            <div className="absolute left-1/2 top-1/2 h-[56cqmin] w-[56cqmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
          )}
          {logoAssets?.border?.imageUrl && (
            <img
              src={logoAssets.border.imageUrl}
              alt="Logo Rahmen"
              className="absolute inset-0 w-full h-full object-contain"
              style={logoAssets.borderColor
                ? { filter: `brightness(0) saturate(100%) ${hexToFilter(logoAssets.borderColor)}` }
                : undefined}
            />
          )}
          {logoAssets?.plant?.imageUrl && (
            <img
              src={logoAssets.plant.imageUrl}
              alt="Logo Pflanze"
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
          {logoAssets?.face?.imageUrl && (
            <img
              src={logoAssets.face.imageUrl}
              alt="Logo Gesicht"
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
          {!hasLogoLayers && (
            fallbackText
              ? <span className={cn("text-xs font-semibold text-white", fallbackClassName)}>{fallbackText}</span>
              : <Leaf className={cn("w-full h-full text-white", leafClassName)} />
          )}
        </div>
      </div>

      {isTooltipOpen && resolvedTooltipText && createPortal(
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
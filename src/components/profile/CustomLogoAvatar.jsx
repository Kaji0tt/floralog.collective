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
 * }} props
 */
export default function CustomLogoAvatar({
  logoAssets,
  className,
  innerClassName,
  fallbackText,
  fallbackClassName,
  leafClassName,
}) {
  const hasLogoLayers = Boolean(
    logoAssets?.border?.imageUrl || logoAssets?.plant?.imageUrl || logoAssets?.face?.imageUrl
  );

  return (
    <div className={cn("relative rounded-full overflow-hidden", className)}>
      <div className={cn("absolute inset-0 flex items-center justify-center", hasLogoLayers && "scale-[1.5]", innerClassName)}>
        {hasLogoLayers && (
          <div className="absolute left-1/2 top-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
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
  );
}
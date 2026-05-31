import { resolveEquippedLogoAssets, resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { hexToFilter } from "@/lib/hexToFilter";

/**
 * Renders the 3-layer Florabot logo (border / plant / face).
 *
 * @param {{ profile?: object, logoAssets?: Array<any>, sizeClass?: string, className?: string, padding?: string }} props
 *   profile     – PublicProfile object (or null for default/guest assets)
 *   logoAssets  – Optional LogoAsset catalog rows for canonical asset URL resolution
 *   sizeClass   – Tailwind w-/h- classes, e.g. "w-24 h-24" (default "w-24 h-24")
 *   className   – Additional wrapper classes
 *   padding     – Inner padding fraction for the assets, e.g. "p-[10%]" (default "p-[8%]")
 */
export default function FlorabotLogo({
  profile = null,
  logoAssets = [],
  sizeClass = "w-24 h-24",
  className = "",
  padding = "p-[8%]",
}) {
  const safeProfile = profile || {};
  const assets = Array.isArray(logoAssets) && logoAssets.length > 0
    ? resolveEquippedLogoAssetsWithCatalog(safeProfile, logoAssets)
    : resolveEquippedLogoAssets(safeProfile);

  const hasAnyLayer =
    assets.border?.imageUrl || assets.plant?.imageUrl || assets.face?.imageUrl;

  return (
    <div
      className={`relative shrink-0 ${sizeClass} ${className}`}
      aria-label="Florabot"
    >
      <div className={`relative w-full h-full ${padding} drop-shadow-[0_0_18px_rgba(190,242,100,0.45)]`}>
        {hasAnyLayer && (
          <div className="absolute left-1/2 top-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
        )}
        {assets.border?.imageUrl && (
          <img
            src={assets.border.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain"
            style={
              assets.borderColor
                ? {
                    filter: `brightness(0) saturate(100%) ${hexToFilter(assets.borderColor)}`,
                  }
                : undefined
            }
          />
        )}
        {assets.plant?.imageUrl && (
          <img
            src={assets.plant.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        {assets.face?.imageUrl && (
          <img
            src={assets.face.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

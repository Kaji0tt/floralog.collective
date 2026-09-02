import { resolveEquippedLogoAssets, resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";
import { hexToFilter } from "@/lib/hexToFilter";
import HomeRarityBorderGlow from "@/components/effects/HomeRarityBorderGlow";

// The border/plant/face source PNGs carry a consistent ~18.75% transparent margin above the
// actual artwork (measured via alpha bounding box), which pushed the rendered logo down relative
// to sibling UI (e.g. nav buttons starting at top:0). Shift the composited layers up by that
// margin (same scale, no zoom) so the artwork starts at the top of its box; the freed space at
// the bottom is clipped via overflow-hidden and lets content below (profile badges) sit higher.
// Use the full measured margin (not a partial value) so no residual gap remains vs. HomeHeroSideNav's buttons.
const LOGO_LAYER_TOP_MARGIN_PERCENT = 8;

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
      <div className={`relative w-full h-full ${padding}`}>
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ transform: `translateY(-${LOGO_LAYER_TOP_MARGIN_PERCENT}%)` }}
          >
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
        {/* Rendered outside the clipped image layer so the glow's blur/box-shadow can bleed past the crop box. */}
        <div
          className="absolute inset-0"
          style={{ transform: `translateY(-${LOGO_LAYER_TOP_MARGIN_PERCENT}%)` }}
        >
          <HomeRarityBorderGlow
            active={safeProfile.selected_profile_effect === "rarity_border_glow"}
            borderColor={assets.borderColor}
            borderImageUrl={assets.border?.imageUrl}
          />
        </div>
      </div>
    </div>
  );
}

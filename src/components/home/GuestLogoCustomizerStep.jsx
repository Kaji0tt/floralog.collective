import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Dices } from "lucide-react";
import {
  LOGO_ACCESSORY_SECTIONS,
  BORDER_COLOR_PRESETS,
  resolveEquippedLogoAssets,
} from "@/lib/logoAccessoryAssets";

// Only the free "default" starter-pack ids are offered pre-registration (no locked/purchasable items).
const GUEST_STARTER_BORDER_IDS = new Set(["border_default", "border_hacked", "border_orbit", "border_triad"]);
const GUEST_STARTER_FACE_IDS = new Set(["face_default", "face_bug", "face_mask", "face_smile"]);

const getSectionOptions = (key, allowedIds) => {
  const section = LOGO_ACCESSORY_SECTIONS.find((entry) => entry.key === key);
  if (!section) return [];
  return section.options.filter((option) => allowedIds.has(option.value));
};

const OptionArea = ({ option, isSelected, onSelect, isFace = false, isLightUi }) => (
  <button
    type="button"
    onClick={() => onSelect(option.value)}
    aria-pressed={isSelected}
    className={`relative aspect-square rounded-xl border p-1.5 transition-all ${
      isSelected
        ? isLightUi ? "border-lime-700 ring-2 ring-lime-600/60 bg-white/80" : "border-amber-200/80 ring-2 ring-amber-200/60 bg-black/45"
        : isLightUi ? "border-stone-300 bg-white/50 hover:bg-white/80" : "border-white/15 bg-black/25 hover:bg-black/35"
    }`}
  >
    <img
      src={option.imageUrl}
      alt={option.label}
      className="h-full w-full object-contain"
      style={isFace ? { transform: "translateY(-14%) scale(1.3)" } : undefined}
    />
  </button>
);

/**
 * @param {{
 *   draft: { bot_name?: string | null, selected_face_asset: string, selected_border_asset: string, selected_border_color: string | null },
 *   onRerollName?: () => void,
 *   onSelectFace: (value: string) => void,
 *   onSelectBorder: (value: string) => void,
 *   onSelectColor: (value: string | null) => void,
 *   onContinue: () => void,
 * }} props
 */
export default function GuestLogoCustomizerStep({ draft, onRerollName, onSelectFace, onSelectBorder, onSelectColor, onContinue }) {
  const { isLightUi } = useUiTheme();
  const labelClass = `mb-2 text-xs uppercase tracking-[0.14em] ${isLightUi ? "text-stone-600" : "text-amber-100/75"}`;
  const previewAssets = resolveEquippedLogoAssets(draft);
  const borderOptions = getSectionOptions("border", GUEST_STARTER_BORDER_IDS);
  const faceOptions = getSectionOptions("face", GUEST_STARTER_FACE_IDS);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <CustomLogoAvatar
          logoAssets={previewAssets}
          className="h-24 w-24"
          innerClassName="scale-[1.5]"
          noClip
        />
      </div>

      {onRerollName && <div className="flex items-center justify-center gap-3">
        <p className="text-lg font-semibold" aria-live="polite">{draft.bot_name}</p>
        <button
          type="button"
          onClick={onRerollName}
          aria-label="Florabot-Namen neu würfeln"
          title="Namen neu würfeln"
          className={`rounded-xl border p-2 ${isLightUi ? "border-stone-300 hover:bg-white/70" : "border-white/20 hover:bg-white/10"}`}
        >
          <Dices className="h-5 w-5" />
        </button>
      </div>}

      <div>
        <p className={labelClass}>Rahmen</p>
        <div className="grid grid-cols-4 gap-2">
          {borderOptions.map((option) => (
            <OptionArea
              key={option.id}
              option={option}
              isSelected={draft.selected_border_asset === option.value}
              onSelect={onSelectBorder}
              isLightUi={isLightUi}
            />
          ))}
        </div>
      </div>

      <div>
        <p className={labelClass}>Gesicht</p>
        <div className="grid grid-cols-4 gap-2">
          {faceOptions.map((option) => (
            <OptionArea
              key={option.id}
              option={option}
              isSelected={draft.selected_face_asset === option.value}
              onSelect={onSelectFace}
              isFace
              isLightUi={isLightUi}
            />
          ))}
        </div>
      </div>

      <div>
        <p className={labelClass}>Rahmenfarbe</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectColor(null)}
            aria-label="Keine Farbe"
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] ${isLightUi ? "text-stone-700" : "text-stone-200"} ${
              !draft.selected_border_color ? isLightUi ? "border-lime-700" : "border-amber-200" : isLightUi ? "border-stone-400" : "border-white/20"
            }`}
            style={{ background: "repeating-conic-gradient(#00000000 0% 25%, #ffffff22 0% 50%)" }}
          >
            ✕
          </button>
          {BORDER_COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onSelectColor(hex)}
              aria-label={hex}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                draft.selected_border_color === hex ? isLightUi ? "border-lime-700 scale-110" : "border-amber-200 scale-110" : isLightUi ? "border-stone-400" : "border-white/20"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/85 via-emerald-500/75 to-emerald-700/85 py-2.5 text-white font-semibold hover:brightness-110 transition-all"
      >
        Weiter
      </button>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Loader2, Leaf } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DEFAULT_VISIBLE_SLOTS = 4;

const getItemLabel = (item) => {
  if (!item) return "";
  return item.title || item.item_key || "Item";
};

const getEffectPercent = (item) => {
  const effectValue = Number(item?.effect_value ?? item?.effectValue ?? 0);
  if (!Number.isFinite(effectValue) || effectValue <= 0) return null;
  return Math.round(effectValue * 100);
};

/**
 * @typedef {Object} InventoryPickerItem
 * @property {string} id
 * @property {string=} title
 * @property {string=} item_key
 * @property {number=} effect_value
 * @property {number=} effectValue
 */

/**
 * @param {{
 *  items?: InventoryPickerItem[],
 *  activeItemId?: string | null,
 *  disabled?: boolean,
 *  isPending?: boolean,
 *  isLightUi?: boolean,
 *  emptyText?: string,
 *  emptyActionLabel?: string,
 *  visibleSlots?: number,
 *  onUseItem?: (itemId: string) => void,
 *  onOpenShop?: () => void,
 *  children: import("react").ReactElement
 * }} props
 */
export default function InventorySlotPickerPopover({
  items = [],
  activeItemId = null,
  disabled = false,
  isPending = false,
  isLightUi = false,
  emptyText = "Keine Items vorhanden.",
  emptyActionLabel = "Zum Shop ->",
  visibleSlots = DEFAULT_VISIBLE_SLOTS,
  onUseItem = () => {},
  onOpenShop = () => {},
  children,
}) {
  const [open, setOpen] = useState(false);

  const normalizedItems = useMemo(
    () => (Array.isArray(items) ? items.filter((item) => item && item.id) : []),
    [items]
  );

  const visibleItems = normalizedItems.slice(0, visibleSlots);
  const missingSlots = Math.max(0, visibleSlots - visibleItems.length);

  const handleUseItem = (itemId) => {
    if (!itemId || isPending) return;
    onUseItem(itemId);
    setOpen(false);
  };

  const handleOpenShop = () => {
    onOpenShop();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        className={
          isLightUi
            ? "w-[15rem] rounded-2xl p-3 border-[#c8ac62]/60 bg-white/95 text-stone-800"
            : "w-[15rem] rounded-2xl p-3 border-[#f0e5a5]/45 bg-black/90 text-stone-100"
        }
      >
        {normalizedItems.length === 0 ? (
          <button
            type="button"
            onClick={handleOpenShop}
            className={
              "w-full text-left text-[11px] font-medium underline underline-offset-2 transition-colors " +
              (isLightUi ? "text-stone-700 hover:text-stone-900" : "text-stone-200 hover:text-white")
            }
          >
            {emptyText} {emptyActionLabel}
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className={"text-[10px] " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
              Wähle einen Dünger aus dem Inventar.
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {visibleItems.map((item) => {
                const isActive = activeItemId && item.id === activeItemId;
                const effectPercent = getEffectPercent(item);
                const label = getItemLabel(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUseItem(item.id)}
                    disabled={isPending}
                    title={label}
                    className={
                      "relative h-9 w-9 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-60 " +
                      (isActive
                        ? (isLightUi
                          ? "border-emerald-600/75 bg-emerald-100/85 text-emerald-800"
                          : "border-emerald-300/70 bg-emerald-900/45 text-emerald-100")
                        : (isLightUi
                          ? "border-[#c8ac62]/45 bg-white/80 text-stone-700 hover:bg-white"
                          : "border-[#f0e5a5]/35 bg-black/45 text-stone-100 hover:bg-black/60"))
                    }
                    aria-label={`${label} anwenden`}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Leaf className="w-3.5 h-3.5" />
                    )}

                    {effectPercent !== null && (
                      <span className={"absolute -bottom-1 -right-1 h-3.5 min-w-3.5 px-1 rounded-full border text-[8px] font-bold leading-[14px] " + (
                        isLightUi
                          ? "border-[#c8ac62]/55 bg-white text-stone-700"
                          : "border-[#f0e5a5]/45 bg-black text-stone-100"
                      )}>
                        {effectPercent}
                      </span>
                    )}
                  </button>
                );
              })}

              {Array.from({ length: missingSlots }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className={
                    "h-9 w-9 rounded-xl border " +
                    (isLightUi ? "border-[#c8ac62]/25 bg-white/45" : "border-white/20 bg-black/25")
                  }
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
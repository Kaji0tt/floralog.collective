import { useMemo, useState } from "react";
import { Loader2, Heart, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * @param {{
 *  candidates?: Array<{ email?: string, name?: string, title?: string }>,
 *  currentPartnerLabel?: string | null,
 *  isUnlocked?: boolean,
 *  isPending?: boolean,
 *  isLoading?: boolean,
 *  isLightUi?: boolean,
 *  emptyText?: string,
 *  emptyActionLabel?: string,
 *  onRequestPartner?: (partnerEmail: string) => boolean | Promise<boolean>,
 *  children: import("react").ReactElement
 * }} props
 */
export default function PartnerSelectionPopover({
  candidates = [],
  currentPartnerLabel = null,
  isUnlocked = false,
  isPending = false,
  isLoading = false,
  isLightUi = false,
  emptyText = "Noch keine Partner verfügbar.",
  emptyActionLabel = "",
  onRequestPartner = () => true,
  children,
}) {
  const [open, setOpen] = useState(false);

  const normalizedCandidates = useMemo(
    () => (Array.isArray(candidates) ? candidates.filter((candidate) => candidate && candidate.email) : []),
    [candidates]
  );

  const handleRequest = async (partnerEmail) => {
    if (!partnerEmail || isPending || !isUnlocked) return;
    const shouldClose = await Promise.resolve(onRequestPartner(partnerEmail));
    if (shouldClose !== false) {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={isPending || !isUnlocked}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className={
          isLightUi
            ? "w-[16rem] rounded-2xl p-3 border-[#c8ac62]/60 bg-white/95 text-stone-800"
            : "w-[16rem] rounded-2xl p-3 border-[#f0e5a5]/45 bg-black/90 text-stone-100"
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-[11px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Partner-Liste wird geladen...</span>
          </div>
        ) : normalizedCandidates.length === 0 ? (
          <div className="space-y-2">
            <div className={"text-[11px] font-medium " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{emptyText}</div>
            <div className={"text-[10px] " + (isLightUi ? "text-stone-500" : "text-stone-400")}>
              {currentPartnerLabel ? `Aktueller Partner: ${currentPartnerLabel}` : emptyActionLabel}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className={"text-[10px] " + (isLightUi ? "text-stone-600" : "text-stone-300")}>Wähle einen Partner aus deiner Freundesliste.</div>

            {currentPartnerLabel && (
              <div className={"rounded-xl border px-3 py-2 text-[10px] " + (isLightUi ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100") }>
                Aktueller Partner: {currentPartnerLabel}
              </div>
            )}

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {normalizedCandidates.map((candidate) => (
                <button
                  key={candidate.email}
                  type="button"
                  onClick={() => handleRequest(candidate.email)}
                  disabled={isPending}
                  className={
                    "w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 " +
                    (isLightUi
                      ? "border-[#c8ac62]/40 bg-white/80 hover:bg-white"
                      : "border-[#f0e5a5]/25 bg-black/40 hover:bg-black/55")
                  }
                >
                  <div className={"h-8 w-8 rounded-full flex items-center justify-center " + (isLightUi ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-100")}>
                    <Heart className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{candidate.name || candidate.email}</div>
                    <div className={"truncate text-[10px] " + (isLightUi ? "text-stone-500" : "text-stone-300")}>{candidate.title || candidate.email}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className={"text-[10px] " + (isLightUi ? "text-stone-500" : "text-stone-400")}>Partner-Anfragen werden im Freunde-Bereich angenommen.</div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import CommunityEventGlowBorder, { COMMUNITY_EVENT_GLOW_SHADOW } from "@/components/community/CommunityEventGlowBorder";
import {
  formatCommunityEventPeriod,
  formatCommunityEventRemaining,
  useCommunityEvent,
} from "@/lib/communityEvents";

const SCAN_PAGE_SIZE = 200;

/**
 * Explorer-Log "Community" entry for the running (or just ended) community event.
 * Tapping the entry expands the list of every counted event scan.
 */
export default function CommunityEventExplorerSection({ userId, isLightUi = false, onOpenScan }) {
  const { event, phase, progress, target, contributedCount } = useCommunityEvent(userId, { enabled: Boolean(userId) });
  const [isOpen, setIsOpen] = useState(false);

  const { data: scans = [], isLoading: isScansLoading } = useQuery({
    queryKey: ["communityEventScans", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_community_quest_scans", {
        p_quest_id: event.id,
        p_limit: SCAN_PAGE_SIZE,
        p_offset: 0,
      });
      if (error) {
        console.warn("[CommunityEvent] Scan list RPC failed:", error);
        return [];
      }
      return data || [];
    },
    enabled: Boolean(event?.id) && isOpen,
    staleTime: 60 * 1000,
  });

  if (!event) return null;

  const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
  const statusLabel = phase === "active"
    ? formatCommunityEventRemaining(event)
    : phase === "succeeded" ? "Erfolgreich abgeschlossen"
    : phase === "failed" ? "Ziel verfehlt"
    : "Beendet";

  const titleClass = isLightUi ? "text-stone-900" : "text-stone-100";
  const mutedClass = isLightUi ? "text-stone-500" : "text-stone-400";

  return (
    <div className="mb-4">
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ boxShadow: COMMUNITY_EVENT_GLOW_SHADOW }}
      >
        <CommunityEventGlowBorder radius="1rem" borderWidth={2} />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative w-full rounded-2xl p-3.5 text-left ${isLightUi ? "bg-gradient-to-br from-amber-50 to-white" : "bg-gradient-to-br from-amber-900/40 via-stone-950/80 to-black/80"}`}
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">{event.icon_emoji || "🌰"}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLightUi ? "text-amber-700" : "text-amber-300"}`}>
                Community Event · {formatCommunityEventPeriod(event)}
              </p>
              <p className={`truncate text-sm font-bold ${titleClass}`}>{event.title}</p>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""} ${mutedClass}`} />
          </div>
          <div className={`mt-2 flex items-center justify-between text-[11px] ${mutedClass}`}>
            <span className={isLightUi ? "text-amber-800" : "text-amber-200"}>Dein Beitrag: {contributedCount}</span>
            <span>{progress} / {target} · {statusLabel}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, background: "linear-gradient(90deg, #78350f, #d97706, #fde68a)" }}
            />
          </div>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {isScansLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className={`h-6 w-6 animate-spin ${mutedClass}`} />
              </div>
            ) : scans.length === 0 ? (
              <p className={`px-1 py-6 text-center text-sm ${mutedClass}`}>
                Noch keine gezählten Scans – sei der erste Florabot-Partner, der eine {event.target_genus_name || "Zielpflanze"} kartiert!
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-3">
                {scans.map((scan) => (
                  <button
                    key={scan.contribution_id}
                    type="button"
                    onClick={() => onOpenScan?.({
                      id: scan.discovery_id,
                      plant_id: scan.plant_id,
                      actorEmail: scan.actor_email,
                      plant: {
                        id: scan.plant_id,
                        species_name: scan.plant_species_name,
                        scientific_name: scan.plant_scientific_name,
                        genus_category: scan.genus_category,
                        genus_number: scan.genus_number,
                      },
                    })}
                    className={`overflow-hidden rounded-xl border text-left transition-colors ${isLightUi ? "border-amber-200 bg-white hover:bg-amber-50" : "border-amber-200/15 bg-black/30 hover:bg-black/45"}`}
                  >
                    <div className="relative" style={{ aspectRatio: "4/3" }}>
                      {scan.image_url ? (
                        <img src={scan.image_url} alt={scan.plant_species_name || "Scan"} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-3xl ${isLightUi ? "bg-amber-50" : "bg-amber-500/10"}`}>
                          {event.icon_emoji || "🌰"}
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className={`truncate text-xs font-semibold ${titleClass}`}>{scan.plant_species_name || "Unbekannte Pflanze"}</p>
                      <div className={`flex items-center justify-between gap-1 text-[10px] ${mutedClass}`}>
                        <span className="truncate">{scan.actor_name}</span>
                        {scan.discovered_date && (
                          <span className="shrink-0">{formatDistanceToNow(new Date(scan.discovered_date), { addSuffix: true, locale: de })}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

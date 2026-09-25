import { Coins, Gift, Loader2, PackageOpen, Users, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listActiveZoneLootboxPools } from "@/api/zoneLootboxService";

const formatChance = (weight, totalWeight) => {
  const chance = totalWeight > 0 ? (Number(weight || 0) / totalWeight) * 100 : 0;
  return `${chance.toFixed(chance < 1 ? 2 : 1)}%`;
};

const getEntryLabel = (entry) => (
  entry.reward?.display_name
  || entry.reward?.name
  || entry.reward_id
  || `${entry.currency_amount || 0} ${entry.currency_code || "Währung"}`
);

const getEntryIdentity = (entry) => (
  entry.reward_id
    ? `reward:${entry.reward_id}`
    : `currency:${entry.sync_key || `${entry.currency_code}:${entry.currency_amount}`}`
);

const getRewardPreviewUrl = (entry, logoAssetCatalog) => {
  if (!entry.reward_id) return null;
  const assetId = String(entry.reward?.value || "").trim();
  const matchingAsset = assetId
    ? logoAssetCatalog.find((asset) => String(asset?.asset_id || "").trim() === assetId)
    : null;
  return matchingAsset?.public_url || entry.reward?.image_url || null;
};

export default function ZoneLootboxInfoDialog({ open, isLightUi, logoAssetCatalog = [], onClose }) {
  const { data: pools = [], isLoading } = useQuery({
    queryKey: ["zoneLootboxInfoPools"],
    queryFn: listActiveZoneLootboxPools,
    enabled: open,
    staleTime: 60_000,
  });

  if (!open) return null;

  const allEntries = pools.flatMap((pool) => (pool.entries || []).map((entry) => ({ ...entry, pool })));
  const groupedEntries = ["guaranteed", "bonus"].map((selectionGroup) => {
    const entriesByIdentity = new Map();
    allEntries
      .filter((entry) => (entry.selection_group || "bonus") === selectionGroup)
      .forEach((entry) => {
        const identity = getEntryIdentity(entry);
        const existing = entriesByIdentity.get(identity) || { entry, pools: [] };
        existing.pools.push(entry.pool);
        entriesByIdentity.set(identity, existing);
      });
    const entries = [...entriesByIdentity.values()].sort(
      (left, right) => Number(right.entry.weight || 0) - Number(left.entry.weight || 0)
    );
    const totalWeight = (pools[0]?.entries || [])
      .filter((entry) => (entry.selection_group || "bonus") === selectionGroup)
      .reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
    return { selectionGroup, entries, totalWeight };
  });

  return (
    <div className="absolute inset-0 z-[1450] flex items-end justify-center bg-black/50 px-4 pb-4">
      <div className={`flex max-h-[calc(100%-2rem)] w-full max-w-md flex-col rounded-3xl border p-5 ${
        isLightUi
          ? "border-[#c8ac62]/50 bg-white/95 text-stone-800"
          : "border-[#f0e5a5]/25 bg-[#0c0e11]/95 text-stone-100"
      }`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold">Knospen-Inhalt</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
              isLightUi
                ? "border-stone-300/70 bg-stone-100 text-stone-700 hover:bg-white"
                : "border-[#f0e5a5]/25 bg-black/40 text-stone-200 hover:bg-black/60"
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Knospen werden geladen...
          </div>
        ) : pools.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">Derzeit sind keine aktiven Knospen verfügbar.</p>
        ) : (
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <p className={isLightUi ? "text-sm text-stone-700" : "text-sm text-stone-300"}>
              Jede abgeschlossene Geozone enthält eine Knospe. Die Chancen gelten innerhalb der jeweiligen Auswahlgruppe.
            </p>

            {groupedEntries.map(({ selectionGroup, entries, totalWeight }) => entries.length > 0 && (
              <section key={selectionGroup} className={`border-t pt-3 ${isLightUi ? "border-stone-200" : "border-[#f0e5a5]/15"}`}>
                <h4 className="mb-2 text-sm font-semibold">
                  {selectionGroup === "guaranteed" ? "Garantiert" : "Bonus"}
                </h4>
                <div className="space-y-2">
                  {entries.map(({ entry, pools: entryPools }) => {
                    const isPoolExclusiveReward = entryPools.length < pools.length;
                    const poolLabels = entryPools.map((pool) => pool.name || pool.zone_theme || "Knospe").join(", ");
                    const rewardPreviewUrl = getRewardPreviewUrl(entry, logoAssetCatalog);

                    return (
                      <div key={entry.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                        isLightUi ? "border-stone-200 bg-stone-50" : "border-white/10 bg-black/25"
                      }`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border ${
                            isLightUi ? "border-stone-200 bg-white" : "border-white/10 bg-black/35"
                          }`}>
                            {rewardPreviewUrl ? (
                              <img src={rewardPreviewUrl} alt="" className="h-full w-full scale-[2] object-contain" />
                            ) : entry.currency_code ? (
                              <Coins className="h-4 w-4 text-amber-300" />
                            ) : (
                              <Gift className="h-4 w-4 text-amber-300" />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{getEntryLabel(entry)}</span>
                            {isPoolExclusiveReward && (
                              <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                                Nur in {poolLabels}
                              </span>
                            )}
                            {entry.shared_only && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                <Users className="h-2.5 w-2.5" /> Duo
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-300">
                          {formatChance(entry.weight, totalWeight)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
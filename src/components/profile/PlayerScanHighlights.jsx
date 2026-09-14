import { Leaf, ScanLine, Sprout, Trees } from "lucide-react";
import GoldGradientCard from "@/components/home/GoldGradientCard";

const formatCount = (value) => Math.max(0, Number(value) || 0).toLocaleString("de-DE");

export default function PlayerScanHighlights({ highlights, compact = false, className = "" }) {
  const topPlant = highlights?.top_plant || null;
  const topGenus = highlights?.top_genus || null;
  const latestScan = highlights?.latest_scan || null;

  const items = [
    {
      id: "top-plant",
      label: "Häufigste Pflanze",
      value: topPlant?.name || "Noch keine Scans",
      detail: topPlant ? `${formatCount(topPlant.scan_count)} Scans` : null,
      Icon: Sprout,
    },
    {
      id: "top-genus",
      label: "Häufigste Gattung",
      value: topGenus?.name || "Noch keine Gattung",
      detail: topGenus ? `${formatCount(topGenus.scan_count)} Scans` : null,
      Icon: Trees,
    },
    {
      id: "species-count",
      label: "Entdeckte Arten",
      value: formatCount(highlights?.discovered_species_count),
      detail: null,
      Icon: Leaf,
    },
    {
      id: "latest-scan",
      label: "Letzter Scan",
      value: latestScan?.plant_name || "Noch kein Scan",
      detail: latestScan ? `${formatCount(latestScan.seeds)} Samen` : null,
      Icon: ScanLine,
    },
  ];

  return (
    <GoldGradientCard
      blur
      shadow={false}
      rounded="2xl"
      borderClassName="gold-gradient-border-mask-thin"
      className={className}
      contentClassName={compact ? "p-2.5" : "p-4 sm:p-5"}
    >
      <div className={compact ? "space-y-2" : "grid grid-cols-2 gap-3 sm:gap-4"}>
        {items.map(({ id, label, value, detail, Icon }) => (
          <div key={id} className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#f0e5a5]/30 bg-black/25">
              <Icon className="h-5 w-5 text-[#f0e5a5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">{label}</p>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
                <p className="truncate text-sm font-semibold sm:text-base">{value}</p>
                {detail && <span className="shrink-0 text-[10px] text-stone-400">{detail}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GoldGradientCard>
  );
}
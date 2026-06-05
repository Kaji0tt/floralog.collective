import React from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Leaf } from "lucide-react";

const NATURADB_BASE_URL = "https://www.naturadb.de/pflanzen/";

const normalizeSlug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const buildNaturaDbUrl = (plant) => {
  if (plant?.naturadb_url) return plant.naturadb_url;
  const slug = normalizeSlug(plant?.scientific_name);
  if (!slug) return NATURADB_BASE_URL;
  return `${NATURADB_BASE_URL}${slug}/`;
};

const toDisplay = (value) => {
  if (value === null || value === undefined || value === "") return "k.A.";
  return String(value);
};

const resolveField = (plant, key) => {
  if (plant?.[key] !== undefined && plant?.[key] !== null && plant?.[key] !== "") {
    return plant[key];
  }
  if (plant?.aiData?.[key] !== undefined && plant?.aiData?.[key] !== null && plant?.aiData?.[key] !== "") {
    return plant.aiData[key];
  }
  return null;
};

const getRegionText = (plant) => {
  const nativeRegion = resolveField(plant, "native_region");
  if (nativeRegion) return String(nativeRegion);

  const distribution = resolveField(plant, "distribution");
  if (!distribution) return null;

  if (typeof distribution === "string") {
    return distribution;
  }

  if (typeof distribution === "object") {
    const isEuropean = distribution?.is_european;
    const countries = Array.isArray(distribution?.regions?.[0]?.countries)
      ? distribution.regions[0].countries.map((c) => c?.code).filter(Boolean).slice(0, 5)
      : [];
    const originLabel = isEuropean === true
      ? "Heimisch oder eingebürgert in Europa"
      : isEuropean === false
        ? "Nicht in Europa heimisch"
        : null;

    if (!originLabel && countries.length === 0) return null;
    if (countries.length === 0) return originLabel;
    return `${originLabel || "Verbreitung"} (${countries.join(" · ")})`;
  }

  return null;
};

const ecologyItems = (plant) => [
  { label: "Wildbienen", value: toDisplay(plant?.wild_bees_count) },
  { label: "Schmetterlinge", value: toDisplay(plant?.butterflies_count) },
  { label: "Raupen", value: toDisplay(plant?.caterpillars_count) },
  { label: "Schwebfliegen", value: toDisplay(plant?.hoverflies_count) },
  { label: "Käfer", value: toDisplay(plant?.beetles_count) },
  { label: "Gefährdung", value: toDisplay(plant?.red_list_threat) },
  { label: "Bestand", value: toDisplay(plant?.red_list_population) },
  { label: "Nektarwert", value: toDisplay(plant?.nectar_value) },
  { label: "Pollenwert", value: toDisplay(plant?.pollen_value) },
];

const getRarityColor = (rarity) => {
  switch (rarity) {
    case "Häufig":
      return "bg-gray-500";
    case "Gelegentlich":
      return "bg-green-500";
    case "Selten":
      return "bg-fuchsia-500";
    case "Sehr Selten":
    case "Sehr selten":
      return "bg-orange-500";
    case "Extrem Selten":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getRarityStars = (rarity) => {
  switch (rarity) {
    case "Häufig":
      return "⭐";
    case "Gelegentlich":
      return "⭐⭐";
    case "Selten":
      return "⭐⭐⭐";
    case "Sehr Selten":
    case "Sehr selten":
      return "⭐⭐⭐⭐";
    case "Extrem Selten":
      return "⭐⭐⭐⭐⭐";
    default:
      return "⭐";
  }
};

export default function SpeciesInfoCard({
  plant,
  imageUrl,
  isLightUi = false,
  compact = false,
  showNarrative = true,
  topRight,
}) {
  const safePlant = plant || {};
  const naturadbUrl = buildNaturaDbUrl(safePlant);
  const image = imageUrl || safePlant.image_url || null;
  const rarity = resolveField(safePlant, "rarity") || "Gelegentlich";
  const regionText = getRegionText(safePlant);
  const descriptionText = resolveField(safePlant, "description");
  const identificationText = resolveField(safePlant, "identification_features");
  const funFactText = resolveField(safePlant, "fun_fact");

  const mergedEcologyPlant = {
    ...safePlant,
    wild_bees_count: resolveField(safePlant, "wild_bees_count"),
    butterflies_count: resolveField(safePlant, "butterflies_count"),
    caterpillars_count: resolveField(safePlant, "caterpillars_count"),
    hoverflies_count: resolveField(safePlant, "hoverflies_count"),
    beetles_count: resolveField(safePlant, "beetles_count"),
    red_list_threat: resolveField(safePlant, "red_list_threat"),
    red_list_population: resolveField(safePlant, "red_list_population"),
    nectar_value: resolveField(safePlant, "nectar_value"),
    pollen_value: resolveField(safePlant, "pollen_value"),
  };

  return (
    <div className={"rounded-xl border p-3 space-y-3 " + (isLightUi
      ? "bg-white border-stone-200"
      : "bg-black/35 border-[#f0e5a5]/30")}>
      <div className={"rounded-lg border p-3 space-y-3 " + (isLightUi
        ? "bg-stone-50 border-stone-200"
        : "bg-black/30 border-stone-600/60")}>
        <div className="flex gap-3">
          <div className="w-20 h-20 rounded-lg overflow-hidden border border-stone-300/50 shrink-0">
            {image ? (
              <img src={image} alt={safePlant.species_name || "Pflanze"} className="w-full h-full object-cover" />
            ) : (
              <div className={"w-full h-full flex items-center justify-center " + (isLightUi ? "bg-stone-100" : "bg-stone-900/70")}>
                <Leaf className={"w-7 h-7 " + (isLightUi ? "text-stone-400" : "text-stone-500")} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={"text-base font-bold truncate " + (isLightUi ? "text-stone-900" : "text-stone-100")}>
                  {safePlant.species_name || "Unbekannte Pflanze"}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className={"text-xs italic truncate " + (isLightUi ? "text-stone-600" : "text-stone-300")}>
                    {safePlant.scientific_name || "-"}
                  </p>
                  <Badge className={`h-5 ${getRarityColor(rarity)} text-white text-[10px] px-1.5 py-0 rounded-full`}>
                    {getRarityStars(rarity)}
                  </Badge>
                </div>
              </div>
              {topRight || null}
            </div>
            <a
              href={naturadbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={"inline-flex items-center gap-1 text-[11px] mt-2 underline underline-offset-2 " + (isLightUi ? "text-emerald-700" : "text-emerald-300")}
            >
              Datenquelle NaturaDB
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className={"rounded-md border p-2 " + (isLightUi ? "bg-white border-stone-200" : "bg-black/30 border-stone-600/50")}>
          <p className={"text-xs font-semibold mb-2 " + (isLightUi ? "text-stone-700" : "text-stone-200")}>
            Ökologie
          </p>
          <div className={compact ? "grid grid-cols-2 gap-x-2 gap-y-1" : "grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1"}>
            {ecologyItems(mergedEcologyPlant).map((item) => (
              <div key={item.label} className="text-[11px] flex items-center justify-between gap-2">
                <span className={isLightUi ? "text-stone-600" : "text-stone-300"}>{item.label}</span>
                <span className={"font-semibold " + (isLightUi ? "text-stone-900" : "text-stone-100")}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNarrative && (
        <div className={"rounded-lg border p-3 space-y-2 " + (isLightUi
          ? "bg-stone-50 border-stone-200"
          : "bg-black/30 border-stone-600/60")}>
          {!!descriptionText && (
            <div>
              <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-stone-700" : "text-stone-200")}>Beschreibung</p>
              <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{descriptionText}</p>
            </div>
          )}
          {!!identificationText && (
            <div>
              <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-stone-700" : "text-stone-200")}>Erkennungsmerkmale</p>
              <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{identificationText}</p>
            </div>
          )}
          {!!funFactText && (
            <div>
              <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-stone-700" : "text-stone-200")}>Fun Fact</p>
              <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{funFactText}</p>
            </div>
          )}
          {!!regionText && (
            <div>
              <p className={"text-xs font-semibold mb-1 " + (isLightUi ? "text-stone-700" : "text-stone-200")}>Verbreitung</p>
              <p className={"text-sm " + (isLightUi ? "text-stone-700" : "text-stone-200")}>{regionText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

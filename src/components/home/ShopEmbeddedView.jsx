import React from "react";

export default function ShopEmbeddedView({
  isLightUi,
  playerSeeds,
  careActionMessage,
  shopCategory,
  onShopCategoryChange,
  filteredShopItems,
  inventoryByItemId,
  onPurchase,
  onUseItem,
  isPurchasePending,
  isUseItemPending,
  activeDecayEffects,
  activeDecayPercent,
}) {
  const isBusy = isPurchasePending || isUseItemPending;

  return (
    <section
      className={`flex-1 min-h-0 rounded-3xl border px-4 py-4 overflow-hidden flex flex-col ${
        isLightUi
          ? "border-[#c0a860]/50 backdrop-blur-xl"
          : "border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs md:text-sm font-semibold">Samen: {playerSeeds}</div>
        {!!careActionMessage && (
          <div
            className={`text-[11px] md:text-xs px-2 py-1 rounded-lg border ${
              isLightUi
                ? "bg-white/55 border-[#c8ac62]/50 text-stone-700"
                : "bg-black/40 border-[#f0e5a5]/45 text-stone-100"
            }`}
          >
            {careActionMessage}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { key: "fertilizer", label: "Duenger" },
          { key: "accessory", label: "Accessoires" },
          { key: "background", label: "Hintergruende" },
          { key: "all", label: "Alle" },
        ].map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => onShopCategoryChange(category.key)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              shopCategory === category.key
                ? isLightUi
                  ? "bg-[#f1e2b8] border-[#c8ac62] text-stone-800"
                  : "bg-[#3b2a18] border-[#f0e5a5]/50 text-amber-100"
                : isLightUi
                  ? "bg-white/45 border-[#c8ac62]/45 text-stone-700"
                  : "bg-black/30 border-[#f0e5a5]/35 text-stone-100"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
        {filteredShopItems.length === 0 ? (
          <div className="text-xs opacity-80">Keine Items in dieser Kategorie.</div>
        ) : (
          filteredShopItems.map((item) => {
            const owned = inventoryByItemId[item.id] || 0;
            const canUse =
              owned > 0 &&
              Number(item.effect_value || 0) > 0 &&
              Number(item.duration_hours || 0) > 0;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3 ${
                  isLightUi
                    ? "border-[#c8ac62]/45 bg-white/45"
                    : "border-[#f0e5a5]/35 bg-black/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-[11px] opacity-75 mt-0.5">
                      {item.description || ""}
                    </div>
                  </div>
                  <div className="text-xs font-bold">{item.seed_cost} Samen</div>
                </div>
                <div className="mt-2 text-[11px] opacity-80">
                  Besitz: {owned}
                  {Number(item.effect_value || 0) > 0 &&
                  Number(item.duration_hours || 0) > 0
                    ? ` | Effekt: -${Math.round(
                        Number(item.effect_value) * 100
                      )}% Decay fuer ${item.duration_hours}h`
                    : " | Platzhalter-Item"}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy || playerSeeds < Number(item.seed_cost || 0)}
                    onClick={() => onPurchase(item.id)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold border disabled:opacity-60 ${
                      isLightUi
                        ? "border-[#c8ac62]/55 bg-white/65 text-stone-800"
                        : "border-[#f0e5a5]/45 bg-black/40 text-stone-100"
                    }`}
                  >
                    Kaufen
                  </button>
                  {canUse && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onUseItem(item.id)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold border disabled:opacity-60 ${
                        isLightUi
                          ? "border-emerald-500/50 bg-emerald-100/70 text-emerald-900"
                          : "border-emerald-400/40 bg-emerald-900/35 text-emerald-100"
                      }`}
                    >
                      Im Slot aktivieren
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        className={`mt-3 rounded-xl border px-3 py-2 text-[11px] md:text-xs ${
          isLightUi
            ? "border-[#c8ac62]/45 bg-white/50 text-stone-700"
            : "border-[#f0e5a5]/35 bg-black/35 text-stone-100"
        }`}
      >
        Aktive Duenger-Effekte: {activeDecayEffects.length} | Gesamtreduktion:{" "}
        {Math.round(activeDecayPercent * 100)}%
      </div>
    </section>
  );
}

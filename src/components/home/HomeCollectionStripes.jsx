import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Heart, Leaf, MapPin, Star, Trophy, Zap } from "lucide-react";
import { hexToFilter } from "@/lib/hexToFilter";

const SWIPE_THRESHOLD_PX = 36;

const clampIndex = (index, size) => {
  if (!Number.isFinite(index) || size <= 0) return 0;
  if (index < 0) return size - 1;
  if (index >= size) return 0;
  return index;
};

const formatMultiplier = (value) => {
  const safeValue = Number.isFinite(value) ? value : 1;
  return `x${safeValue.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
};

const formatCompactValue = (value) => {
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue < 1000) return String(Math.round(safeValue));
  if (safeValue < 1000000) {
    const thousandValue = Math.round(safeValue / 1000);
    return `${thousandValue}k`;
  }
  const millionValue = Math.round(safeValue / 1000000);
  return `${millionValue}m`;
};

const formatDistanceKm = (value) => {
  const safeKm = Math.max(0, Number(value) || 0);
  return String(Math.round(safeKm));
};

export default function HomeCollectionStripes({
  isLightUi,
  equippedLogoAssets,
  onLogoClick,
  playerSeeds,
  discoveryCount,
  totalDistanceKm,
  receivedLikesCount,
  playerSparks,
  playerAmber,
  milestoneFeed,
  onMilestoneAction,
  favoriteCollections,
  onOpenCollection,
  favoriteBackendHint,
  claimedTiles,
  activeZoneLabel,
  isZoneLoading,
  securedMultiplier,
  streakMultiplier,
  zoneMultiplier,
  careMultiplier,
}) {
  const [milestoneIndex, setMilestoneIndex] = useState(0);
  const [collectionIndex, setCollectionIndex] = useState(0);
  const milestoneTouchStartX = useRef(null);
  const collectionTouchStartX = useRef(null);

  const milestoneCount = Array.isArray(milestoneFeed) ? milestoneFeed.length : 0;
  const collectionCount = Array.isArray(favoriteCollections) ? favoriteCollections.length : 0;

  useEffect(() => {
    setMilestoneIndex((prev) => clampIndex(prev, milestoneCount));
  }, [milestoneCount]);

  useEffect(() => {
    setCollectionIndex((prev) => clampIndex(prev, collectionCount));
  }, [collectionCount]);

  useEffect(() => {
    if (milestoneCount <= 1) return undefined;
    const id = window.setInterval(() => {
      setMilestoneIndex((prev) => clampIndex(prev + 1, milestoneCount));
    }, 6500);
    return () => window.clearInterval(id);
  }, [milestoneCount]);

  useEffect(() => {
    if (collectionCount <= 1) return undefined;
    const id = window.setInterval(() => {
      setCollectionIndex((prev) => clampIndex(prev + 1, collectionCount));
    }, 7000);
    return () => window.clearInterval(id);
  }, [collectionCount]);

  const currentMilestone = milestoneCount > 0 ? milestoneFeed[milestoneIndex] : null;
  const currentCollection = collectionCount > 0 ? favoriteCollections[collectionIndex] : null;
  const borderFilter = equippedLogoAssets?.borderColor
    ? `brightness(0) saturate(100%) ${hexToFilter(equippedLogoAssets.borderColor)}`
    : undefined;

  return (
    <div className="mb-[clamp(0.5rem,1.25vh,0.9rem)] space-y-2">
      <div className="rounded-2xl bg-black/50 px-2 py-2 backdrop-blur-sm text-stone-100">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onLogoClick?.()}
            className="relative -my-2 -ml-1 h-[4.5rem] w-[4.5rem] shrink-0"
            aria-label="Florabot Overlay öffnen"
          >
            {equippedLogoAssets?.border?.imageUrl && (
              <img
                src={equippedLogoAssets.border.imageUrl}
                alt="Logo Rahmen"
                className="absolute inset-0 h-full w-full object-contain"
                style={borderFilter ? { filter: borderFilter } : undefined}
              />
            )}
            {equippedLogoAssets?.plant?.imageUrl && (
              <img
                src={equippedLogoAssets.plant.imageUrl}
                alt="Logo Pflanze"
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            {equippedLogoAssets?.face?.imageUrl && (
              <img
                src={equippedLogoAssets.face.imageUrl}
                alt="Logo Gesicht"
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            {!equippedLogoAssets?.border?.imageUrl &&
              !equippedLogoAssets?.plant?.imageUrl &&
              !equippedLogoAssets?.face?.imageUrl && (
                <div className="h-full w-full rounded-full border border-white/35 flex items-center justify-center">
                  <Leaf className="h-4 w-4 text-emerald-300" />
                </div>
              )}
          </button>

          <div className="min-w-0 flex-1 space-y-1.5 text-[11px]">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <Camera className="w-3.5 h-3.5 text-sky-300" />
                <span className="font-semibold">{Math.max(0, Number(discoveryCount) || 0)}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                <span className="font-semibold">{formatDistanceKm(totalDistanceKm)}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <Heart className="w-3.5 h-3.5 text-rose-300" />
                <span className="font-semibold">{Math.max(0, Number(receivedLikesCount) || 0)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <Leaf className="w-3.5 h-3.5 text-emerald-300" />
                <span className="font-semibold">{formatCompactValue(playerSeeds)}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-semibold">{Math.max(0, Number(playerSparks) || 0)}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 min-w-0">
                <Star className="w-3.5 h-3.5 text-orange-300" />
                <span className="font-semibold">{Math.max(0, Number(playerAmber) || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border px-2.5 py-2 backdrop-blur-sm ${
          isLightUi
            ? "border-[#c8ac62]/35 bg-white/58 text-stone-800"
            : "border-[#f0e5a5]/22 bg-black/34 text-stone-100"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLightUi ? "text-emerald-700" : "text-emerald-300"}`}>Milestone Feed</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMilestoneIndex((prev) => clampIndex(prev - 1, milestoneCount))}
              disabled={milestoneCount <= 1}
              className={`h-6 w-6 rounded-full border flex items-center justify-center disabled:opacity-40 ${
                isLightUi ? "border-[#c8ac62]/40 bg-white/75" : "border-white/20 bg-black/35"
              }`}
              aria-label="Vorheriger Milestone"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMilestoneIndex((prev) => clampIndex(prev + 1, milestoneCount))}
              disabled={milestoneCount <= 1}
              className={`h-6 w-6 rounded-full border flex items-center justify-center disabled:opacity-40 ${
                isLightUi ? "border-[#c8ac62]/40 bg-white/75" : "border-white/20 bg-black/35"
              }`}
              aria-label="Nächster Milestone"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          className={`mt-1.5 rounded-xl border px-3 py-2.5 min-h-[4.75rem] ${
            isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-white/15 bg-black/35"
          }`}
          onTouchStart={(event) => {
            milestoneTouchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = milestoneTouchStartX.current;
            const end = event.changedTouches?.[0]?.clientX ?? null;
            milestoneTouchStartX.current = null;
            if (!Number.isFinite(start) || !Number.isFinite(end)) return;
            const delta = end - start;
            if (Math.abs(delta) < SWIPE_THRESHOLD_PX || milestoneCount <= 1) return;
            setMilestoneIndex((prev) => clampIndex(prev + (delta < 0 ? 1 : -1), milestoneCount));
          }}
        >
          {currentMilestone ? (
            <button
              type="button"
              onClick={() => onMilestoneAction?.(currentMilestone)}
              className="w-full text-left"
            >
              <p className="text-sm font-semibold leading-tight">{currentMilestone.title}</p>
              <p className={`mt-1 text-xs leading-snug ${isLightUi ? "text-stone-700" : "text-stone-300"}`}>{currentMilestone.detail}</p>
            </button>
          ) : (
            <p className={`text-xs leading-snug ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
              Noch keine passenden Milestones verfuegbar.
            </p>
          )}
        </div>
      </div>

      <div
        className={`rounded-2xl border px-2.5 py-2 backdrop-blur-sm ${
          isLightUi
            ? "border-[#c8ac62]/35 bg-white/58 text-stone-800"
            : "border-[#f0e5a5]/22 bg-black/34 text-stone-100"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLightUi ? "text-sky-700" : "text-sky-300"}`}>Favorisierte Kollektionen</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollectionIndex((prev) => clampIndex(prev - 1, collectionCount))}
              disabled={collectionCount <= 1}
              className={`h-6 w-6 rounded-full border flex items-center justify-center disabled:opacity-40 ${
                isLightUi ? "border-[#c8ac62]/40 bg-white/75" : "border-white/20 bg-black/35"
              }`}
              aria-label="Vorherige Kollektion"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCollectionIndex((prev) => clampIndex(prev + 1, collectionCount))}
              disabled={collectionCount <= 1}
              className={`h-6 w-6 rounded-full border flex items-center justify-center disabled:opacity-40 ${
                isLightUi ? "border-[#c8ac62]/40 bg-white/75" : "border-white/20 bg-black/35"
              }`}
              aria-label="Nächste Kollektion"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          className={`mt-1.5 rounded-xl border px-3 py-2.5 min-h-[5.2rem] ${
            isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-white/15 bg-black/35"
          }`}
          onTouchStart={(event) => {
            collectionTouchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = collectionTouchStartX.current;
            const end = event.changedTouches?.[0]?.clientX ?? null;
            collectionTouchStartX.current = null;
            if (!Number.isFinite(start) || !Number.isFinite(end)) return;
            const delta = end - start;
            if (Math.abs(delta) < SWIPE_THRESHOLD_PX || collectionCount <= 1) return;
            setCollectionIndex((prev) => clampIndex(prev + (delta < 0 ? 1 : -1), collectionCount));
          }}
        >
          {currentCollection ? (
            <button
              type="button"
              onClick={() => onOpenCollection?.(currentCollection)}
              className="w-full text-left"
            >
              <p className="text-sm font-semibold leading-tight truncate">{currentCollection.title}</p>
              <p className={`mt-1 text-xs ${isLightUi ? "text-stone-700" : "text-stone-300"}`}>
                {currentCollection.discovered}/{currentCollection.total} entdeckt · {currentCollection.missingCount} fehlen
              </p>
              <div className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${isLightUi ? "bg-stone-200" : "bg-white/15"}`}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, currentCollection.percent))}%`,
                    background: "linear-gradient(90deg, rgba(74,222,128,0.95) 0%, rgba(22,163,74,0.95) 100%)",
                  }}
                />
              </div>
            </button>
          ) : (
            <div>
              <p className={`text-xs leading-snug ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
                Noch keine favorisierten Kollektionen. Folge Kollektionen und markiere sie als Favorit.
              </p>
              {favoriteBackendHint && (
                <p className={`mt-1 text-[11px] leading-snug ${isLightUi ? "text-amber-700" : "text-amber-300"}`}>
                  Hinweis: Favoriten werden aktiv, sobald die Migration fuer public.UserCollection.is_favorite auf dem Ziel-Backend ausgerollt ist.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={`rounded-2xl border px-3 py-2.5 backdrop-blur-sm ${
          isLightUi
            ? "border-[#c8ac62]/35 bg-white/58 text-stone-800"
            : "border-[#f0e5a5]/22 bg-black/34 text-stone-100"
        }`}
      >
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLightUi ? "text-amber-700" : "text-amber-300"}`}>Zonen und Multiplikatoren</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[11px]">
          <div className={`rounded-xl border px-2 py-1.5 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-white/15 bg-black/35"}`}>
            <div className="flex items-center gap-1.5 font-semibold"><MapPin className="w-3.5 h-3.5 text-sky-500" />{isZoneLoading ? "..." : claimedTiles}</div>
            <div className="mt-0.5 opacity-80">Geclaimte Tiles</div>
          </div>
          <div className={`rounded-xl border px-2 py-1.5 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-white/15 bg-black/35"}`}>
            <div className="flex items-center gap-1.5 font-semibold"><Camera className="w-3.5 h-3.5 text-amber-500" />{formatMultiplier(securedMultiplier)}</div>
            <div className="mt-0.5 opacity-80">Gesichert</div>
          </div>
          <div className={`rounded-xl border px-2 py-1.5 ${isLightUi ? "border-[#c8ac62]/30 bg-white/72" : "border-white/15 bg-black/35"}`}>
            <div className="flex items-center gap-1.5 font-semibold"><Trophy className="w-3.5 h-3.5 text-emerald-500" />{activeZoneLabel}</div>
            <div className="mt-0.5 opacity-80">Aktive Zone</div>
          </div>
        </div>
        <p className={`mt-2 text-[11px] leading-snug ${isLightUi ? "text-stone-700" : "text-stone-300"}`}>
          Streak {formatMultiplier(streakMultiplier)} · Zone {formatMultiplier(zoneMultiplier)} · Pflege {formatMultiplier(careMultiplier)}
        </p>
      </div>
    </div>
  );
}

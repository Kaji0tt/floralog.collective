import { ArrowLeft, Bug, Loader2, Map as MapIcon, RefreshCw } from "lucide-react";
import MapboxZoneMap from "@/components/map/MapboxZoneMap";
import { TileVisualizationPanel } from "@/components/admin/TileVisualizationPanel";

export default function HomeMapFeatureRoot({
  isLightUi,
  isResolvingLocation,
  isLoadingDiscoveries,
  hasLiveCachedLocation,
  zoneMapError,
  onRequestLocation,
  heroZones,
  nearbyDiscoveryPoints,
  cachedLocation,
  heroMapCenter,
  onDiscoveryImageClick,
  onDiscoveryLike,
  allowDiscoveryLike,
  onTokenError,
  onMapReady,
  heroMapInstance,
  authId,
  isAdminUser,
  showDebugZonePanel,
  onDebugZonePanelChange,
  onClose,
  onRegenerateZones,
  canRegenerateZones,
  isRegeneratingZones,
  zoneRerollsRemaining,
}) {
  return (
    <section
      className={`relative flex-1 min-h-0 rounded-3xl border overflow-hidden ${
        isLightUi
          ? "border-[#c0a860]/50 backdrop-blur-xl"
          : "border-[#f0e5a5]/25 bg-black/25 backdrop-blur-sm"
      }`}
      style={isLightUi ? {
        background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)",
      } : undefined}
    >
      {isResolvingLocation ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
            isLightUi
              ? "border-[#c8ac62]/50 bg-white/70 text-stone-800"
              : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Live-Standort wird geladen...
          </div>
        </div>
      ) : isLoadingDiscoveries ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
            isLightUi
              ? "border-[#c8ac62]/50 bg-white/70 text-stone-800"
              : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Lokale Funde werden geladen...
          </div>
        </div>
      ) : !hasLiveCachedLocation ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={`max-w-md rounded-2xl border p-5 text-center ${
            isLightUi
              ? "border-red-400/45 bg-red-100/75 text-red-800"
              : "border-red-300/45 bg-red-950/55 text-red-100"
          }`}>
            <h3 className="text-base font-semibold mb-2">Zonenkarte nicht verfuegbar</h3>
            <p className="text-sm mb-4">
              {zoneMapError || "Ohne Live-Standort kann die Zonenkarte nicht geladen werden."}
            </p>
            <button
              type="button"
              onClick={onRequestLocation}
              className={`h-10 px-4 rounded-xl border text-sm font-semibold ${
                isLightUi
                  ? "border-red-500/50 bg-white/70 text-red-800 hover:bg-white"
                  : "border-red-300/45 bg-red-900/45 text-red-100 hover:bg-red-900/60"
              }`}
            >
              Standort erneut anfragen
            </button>
          </div>
        </div>
      ) : (
        <MapboxZoneMap
          zones={heroZones}
          userLocation={cachedLocation}
          fallbackCenter={{ lat: heroMapCenter[0], lng: heroMapCenter[1] }}
          discoveryPoints={nearbyDiscoveryPoints}
          onDiscoveryImageClick={onDiscoveryImageClick}
          onDiscoveryLike={onDiscoveryLike}
          allowDiscoveryLike={allowDiscoveryLike}
          onTokenError={onTokenError}
          onMapReady={onMapReady}
        />
      )}

      <TileVisualizationPanel
        map={heroMapInstance}
        userLocation={cachedLocation}
        authId={authId}
        isAdmin={isAdminUser}
        open={showDebugZonePanel}
        onOpenChange={onDebugZonePanelChange}
      />

      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 z-[1100] ${
        isLightUi
          ? "bg-gradient-to-b from-white/20 to-transparent"
          : "bg-gradient-to-b from-black/60 to-transparent"
      }`} />

      <div className={`absolute left-4 top-4 z-[1200] rounded-xl border backdrop-blur-sm px-3 py-1.5 text-[11px] md:text-xs font-semibold flex items-center gap-1.5 ${
        isLightUi
          ? "border-[#c8ac62]/50 bg-white/55 text-stone-800"
          : "border-[#f0e5a5]/35 bg-black/55 text-stone-100"
      }`}>
        <MapIcon className="w-3.5 h-3.5" />
        Zonen: {heroZones.length} | Funde: {nearbyDiscoveryPoints.length}
      </div>

      {zoneMapError && (
        <div className={`absolute left-4 right-4 top-16 z-[1200] rounded-xl border backdrop-blur-sm px-3 py-2 text-[11px] md:text-xs font-medium ${
          isLightUi
            ? "border-red-400/40 bg-red-200/65 text-red-800"
            : "border-red-300/50 bg-red-900/55 text-red-100"
        }`}>
          {zoneMapError}
        </div>
      )}

      <div className="absolute left-4 right-4 bottom-4 z-[1200] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
              : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
          } transition-colors`}
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>

        {isAdminUser && (
          <button
            type="button"
            onClick={() => onDebugZonePanelChange(true)}
            className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold ${
              isLightUi
                ? "border-amber-400/60 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80"
                : "border-amber-400/50 bg-amber-900/40 text-amber-200 hover:bg-amber-900/60"
            } transition-colors`}
            title="Admin: Debug Zone Overlay"
          >
            <Bug className="w-4 h-4" />
            Debug-Zone
          </button>
        )}

        <button
          type="button"
          onClick={onRegenerateZones}
          disabled={!canRegenerateZones || isRegeneratingZones}
          className={`h-10 px-3 rounded-xl border backdrop-blur-sm flex items-center gap-2 text-xs md:text-sm font-semibold disabled:opacity-60 ${
            isLightUi
              ? "border-[#c8ac62]/55 bg-white/60 text-stone-800 hover:bg-white/70"
              : "border-[#f0e5a5]/45 bg-black/55 text-stone-100 hover:bg-black/70"
          } transition-colors`}
        >
          {isRegeneratingZones ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {zoneRerollsRemaining !== null && !isAdminUser ? `Neu (${zoneRerollsRemaining})` : "Neu"}
        </button>
      </div>
    </section>
  );
}
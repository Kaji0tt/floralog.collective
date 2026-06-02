import { useEffect, useState } from "react";
import { getOnlinePresenceDisplayName, subscribeToOnlineUsers } from "@/api/onlinePresenceService";

const formatMetricValue = (metric) => {
  if (metric?.type === "percent") {
    return `${Number(metric.value || 0).toFixed(1)}%`;
  }

  return Number(metric?.value || 0).toLocaleString("de-DE");
};

const formatAverage = (value) => Number(value || 0).toFixed(2);

const trendColorClassByDirection = {
  up: "text-emerald-500",
  down: "text-rose-500",
  flat: "text-stone-400",
};

const trendPrefixByDirection = {
  up: "+",
  down: "-",
  flat: "",
};

export default function GlobalKpiPanel({ summary, isLoading = false, isLightUi = false }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isLoadingOnlineUsers, setIsLoadingOnlineUsers] = useState(true);

  useEffect(() => {
    const cleanup = subscribeToOnlineUsers({
      onUsersChange: (users) => {
        setOnlineUsers(Array.isArray(users) ? users : []);
        setIsLoadingOnlineUsers(false);
      },
      onError: () => {
        setIsLoadingOnlineUsers(false);
      },
    });

    return cleanup;
  }, []);

  const generatedAt = summary?.generatedAt ? new Date(summary.generatedAt) : null;
  const generatedAtLabel = generatedAt && !Number.isNaN(generatedAt.getTime())
    ? generatedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "-";

  const metrics = Array.isArray(summary?.metrics) ? summary.metrics : [];
  const totals = summary?.totals || {};
  const scanAverages = summary?.averages?.scansPerUser || { day: 0, week: 0, month: 0 };
  const mapAverages = summary?.averages?.mapViewsPerUser || { day: 0, week: 0, month: 0 };

  return (
    <section
      className={`mt-[clamp(0.5rem,1.2vh,0.9rem)] rounded-2xl border px-3 py-3 backdrop-blur-md ${
        isLightUi
          ? "border-[#c8ac62]/40 bg-white/52 text-stone-700"
          : "border-[#f0e5a5]/25 bg-black/36 text-stone-100"
      }`}
      aria-label="Community KPI"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] uppercase tracking-wide ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
            Community KPI
          </p>
          <p className={`text-xs font-semibold ${isLightUi ? "text-stone-700" : "text-stone-100"}`}>
            Nutzer gesamt: {Number(totals?.users || 0).toLocaleString("de-DE")}
          </p>
        </div>
        <p className={`text-[10px] ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
          Update: {isLoading ? "..." : generatedAtLabel}
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {metrics.map((metric) => {
          const trend = metric?.trend || { direction: "flat", deltaPercent: 0 };
          const trendClass = trendColorClassByDirection[trend.direction] || trendColorClassByDirection.flat;
          const trendPrefix = trendPrefixByDirection[trend.direction] || "";

          return (
            <div
              key={metric.id}
              className={`rounded-xl border px-2.5 py-2 ${
                isLightUi
                  ? "border-[#c8ac62]/35 bg-white/60"
                  : "border-[#f0e5a5]/20 bg-black/25"
              }`}
            >
              <p className={`text-[10px] leading-tight ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
                {metric.label}
              </p>
              <p className={`text-sm font-bold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
                {isLoading ? "..." : formatMetricValue(metric)}
              </p>
              <p className={`text-[10px] ${trendClass}`}>
                {isLoading ? "" : `${trendPrefix}${Number(trend.deltaPercent || 0).toFixed(1)}% vs Vorperiode`}
              </p>
            </div>
          );
        })}
      </div>

      <div className={`mt-2.5 rounded-xl border px-2.5 py-2 text-[11px] ${
        isLightUi ? "border-[#c8ac62]/35 bg-white/60" : "border-[#f0e5a5]/20 bg-black/25"
      }`}>
        <p className={`font-semibold ${isLightUi ? "text-stone-700" : "text-stone-100"}`}>
          Durchschnittliche Scans pro Nutzer
        </p>
        <p className={isLightUi ? "text-stone-600" : "text-stone-300/90"}>
          24h: {isLoading ? "..." : formatAverage(scanAverages.day)} | 7 Tage: {isLoading ? "..." : formatAverage(scanAverages.week)} | 30 Tage: {isLoading ? "..." : formatAverage(scanAverages.month)}
        </p>
      </div>

      <div className={`mt-2 rounded-xl border px-2.5 py-2 text-[11px] ${
        isLightUi ? "border-[#c8ac62]/35 bg-white/60" : "border-[#f0e5a5]/20 bg-black/25"
      }`}>
        <p className={`font-semibold ${isLightUi ? "text-stone-700" : "text-stone-100"}`}>
          Durchschnittliche Kartenaufrufe pro Nutzer
        </p>
        <p className={isLightUi ? "text-stone-600" : "text-stone-300/90"}>
          24h: {isLoading ? "..." : formatAverage(mapAverages.day)} | 7 Tage: {isLoading ? "..." : formatAverage(mapAverages.week)} | 30 Tage: {isLoading ? "..." : formatAverage(mapAverages.month)}
        </p>
      </div>

      <div className={`mt-2 rounded-xl border px-2.5 py-2 text-[11px] ${
        isLightUi ? "border-[#c8ac62]/35 bg-white/60" : "border-[#f0e5a5]/20 bg-black/25"
      }`}>
        <div className="flex items-center justify-between gap-3">
          <p className={`font-semibold ${isLightUi ? "text-stone-700" : "text-stone-100"}`}>
            Aktuell angemeldete Nutzer
          </p>
          <p className={`text-[10px] ${isLightUi ? "text-stone-500" : "text-stone-300/80"}`}>
            {isLoadingOnlineUsers ? "..." : `${onlineUsers.length} online`}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {isLoadingOnlineUsers ? (
            <span className={isLightUi ? "text-stone-500" : "text-stone-300/80"}>
              Online-Status wird geladen...
            </span>
          ) : onlineUsers.length > 0 ? (
            onlineUsers.map((onlineUser) => (
              <span
                key={onlineUser.presenceKey}
                className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium ${
                  isLightUi
                    ? "border-emerald-300/70 bg-emerald-50 text-emerald-800"
                    : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                {getOnlinePresenceDisplayName(onlineUser)}
                {onlineUser.connectionCount > 1 ? ` x${onlineUser.connectionCount}` : ""}
              </span>
            ))
          ) : (
            <span className={isLightUi ? "text-stone-500" : "text-stone-300/80"}>
              Derzeit sind keine angemeldeten Nutzer sichtbar.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, BarChart3, RefreshCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { buildDauWauMauSeries, buildGlobalKpiSummary, buildMonthlyTopScannerSummary } from "@/api/kpiService";
import { getOnlinePresenceDisplayName, subscribeToOnlineUsers } from "@/api/onlinePresenceService";
import { createPageUrl } from "@/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MobileBackButton from "../components/navigation/MobileBackButton";

const formatMetricValue = (metric) => {
  if (metric?.type === "percent") {
    return `${Number(metric.value || 0).toFixed(1)}%`;
  }
  return Number(metric?.value || 0).toLocaleString("de-DE");
};

const formatAvg = (value) => Number(value || 0).toFixed(2);

const formatMonth = (monthKey) => {
  if (!monthKey) return "-";
  const [year, month] = String(monthKey).split("-").map((value) => Number(value));
  if (!year || !month) return monthKey;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const formatDateLabel = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
};

const calcAvg = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
};

const getCurrentYearMayStartIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 4, 1, 0, 0, 0, 0)).toISOString();
};

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

export default function KPIAdmin() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isLoadingOnlineUsers, setIsLoadingOnlineUsers] = useState(true);

  const isAdmin = user && normalizeRole(user?.role) === "admin";

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoadError(null);
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser && normalizeRole(currentUser?.role) !== "admin") {
          setTimeout(() => navigate(createPageUrl("Home")), 500);
        }
      } catch (error) {
        console.error("[KPIAdmin] Error loading user:", error);
        setLoadError("Fehler beim Laden des Profils");
      }
    };

    loadUser();
  }, [navigate]);

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

  const {
    data: discoveries = [],
    isLoading: isLoadingDiscoveries,
    refetch: refetchDiscoveries,
  } = useQuery({
    queryKey: ["kpiAdminDiscoveries"],
    queryFn: () => Query.UserPlantDiscovery.listAll("-created_date"),
    enabled: !!isAdmin,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: profiles = [],
    isLoading: isLoadingProfiles,
    refetch: refetchProfiles,
  } = useQuery({
    queryKey: ["kpiAdminProfiles"],
    queryFn: () => Query.PublicProfile.listAll(),
    enabled: !!isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: likes = [],
    isLoading: isLoadingLikes,
    refetch: refetchLikes,
  } = useQuery({
    queryKey: ["kpiAdminLikes"],
    queryFn: () => Query.ScanLike.listAll("-created_date"),
    enabled: !!isAdmin,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: mapViews = [],
    isLoading: isLoadingMapViews,
    refetch: refetchMapViews,
  } = useQuery({
    queryKey: ["kpiAdminMapViews"],
    queryFn: () => Query.MapViewEvent.listAll("-created_date"),
    enabled: !!isAdmin,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const isKpiLoading = isLoadingDiscoveries || isLoadingProfiles || isLoadingLikes || isLoadingMapViews;

  const summary = useMemo(
    () =>
      buildGlobalKpiSummary({
        discoveries,
        profiles,
        scanLikes: likes,
        mapViews,
      }),
    [discoveries, profiles, likes, mapViews]
  );

  const retentionSeries = useMemo(
    () => buildDauWauMauSeries({ discoveries, days: 365, startDate: getCurrentYearMayStartIso() }),
    [discoveries]
  );

  const monthlyScanSummary = useMemo(
    () => buildMonthlyTopScannerSummary({ discoveries, profiles, topLimit: 12 }),
    [discoveries, profiles]
  );

  const retentionTrendSummary = useMemo(() => {
    if (!retentionSeries.length) return { current: 0, previous: 0, deltaPercent: 0 };

    const recent = retentionSeries.slice(-14);
    const previous = retentionSeries.slice(-28, -14);
    const currentAvg = calcAvg(recent.map((entry) => entry.stickiness));
    const previousAvg = calcAvg(previous.map((entry) => entry.stickiness));

    if (previousAvg <= 0) {
      return {
        current: currentAvg,
        previous: previousAvg,
        deltaPercent: currentAvg > 0 ? 100 : 0,
      };
    }

    const deltaPercent = ((currentAvg - previousAvg) / previousAvg) * 100;
    return { current: currentAvg, previous: previousAvg, deltaPercent };
  }, [retentionSeries]);

  const retentionTableRows = useMemo(
    () => [...retentionSeries].slice(-14).reverse(),
    [retentionSeries]
  );

  const handleRefresh = async () => {
    await Promise.all([refetchDiscoveries(), refetchProfiles(), refetchLikes(), refetchMapViews()]);
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-stone-900 mb-2">Fehler</h2>
          <p className="text-stone-600">{loadError}</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} className="mt-4">
            Zur Startseite
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-2" />
          <p className="text-stone-600">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-stone-900 mb-2">Zugriff verweigert</h2>
          <p className="text-stone-600">Du hast keine Berechtigung für diese Seite.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} className="mt-4">
            Zur Startseite
          </Button>
        </div>
      </div>
    );
  }

  const averages = summary?.averages || {};
  const scanAverages = averages?.scansPerUser || { day: 0, week: 0, month: 0 };
  const mapAverages = averages?.mapViewsPerUser || { day: 0, week: 0, month: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />

      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 md:w-10 md:h-10 text-green-600" />
              KPI Admin
            </h1>
            <p className="text-stone-600 mt-1">
              Globale Kennzahlen für Produkt, Wachstum und Nutzung
            </p>
          </div>

          <Button onClick={handleRefresh} disabled={isKpiLoading} className="bg-green-600 hover:bg-green-700">
            {isKpiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Aktualisieren
          </Button>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Globale Kern-KPI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(summary?.metrics || []).map((metric) => (
                <div key={metric.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs text-stone-500">{metric.label}</p>
                  <p className="text-xl font-bold text-stone-900">{isKpiLoading ? "..." : formatMetricValue(metric)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-2 border-stone-200 shadow-lg bg-white">
            <CardHeader>
              <CardTitle>Durchschnittliche Scans pro Nutzer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-stone-800">
                <p>24h: <strong>{isKpiLoading ? "..." : formatAvg(scanAverages.day)}</strong></p>
                <p>7 Tage: <strong>{isKpiLoading ? "..." : formatAvg(scanAverages.week)}</strong></p>
                <p>30 Tage: <strong>{isKpiLoading ? "..." : formatAvg(scanAverages.month)}</strong></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-stone-200 shadow-lg bg-white">
            <CardHeader>
              <CardTitle>Durchschnittliche Kartenaufrufe pro Nutzer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-stone-800">
                <p>24h: <strong>{isKpiLoading ? "..." : formatAvg(mapAverages.day)}</strong></p>
                <p>7 Tage: <strong>{isKpiLoading ? "..." : formatAvg(mapAverages.week)}</strong></p>
                <p>30 Tage: <strong>{isKpiLoading ? "..." : formatAvg(mapAverages.month)}</strong></p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Scans pro Monat: Top-Spieler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Aktiver Monat</p>
                <p className="text-lg font-semibold text-stone-900">{formatMonth(monthlyScanSummary?.currentMonthKey)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Aktive Scanner (Monat)</p>
                <p className="text-lg font-semibold text-stone-900">{Number(monthlyScanSummary?.currentMonthActivePlayers || 0).toLocaleString("de-DE")}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Monatsrekord (ein Spieler)</p>
                <p className="text-lg font-semibold text-stone-900">{Number(monthlyScanSummary?.monthlyRecord?.scans || 0).toLocaleString("de-DE")}</p>
                <p className="text-xs text-stone-500 mt-1">
                  {monthlyScanSummary?.monthlyRecord
                    ? `${monthlyScanSummary.monthlyRecord.playerName} · ${formatMonth(monthlyScanSummary.monthlyRecord.monthKey)}`
                    : "-"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-100 text-stone-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Rang</th>
                    <th className="text-left px-3 py-2 font-medium">Spieler</th>
                    <th className="text-right px-3 py-2 font-medium">Scans im Monat</th>
                  </tr>
                </thead>
                <tbody>
                  {(monthlyScanSummary?.currentMonthTop || []).length > 0 ? (
                    (monthlyScanSummary.currentMonthTop || []).map((entry, index) => (
                      <tr key={`${entry.userKey}-${index}`} className="border-t border-stone-200">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2">{entry.playerName}</td>
                        <td className="px-3 py-2 text-right font-semibold">{Number(entry.scans || 0).toLocaleString("de-DE")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-stone-500">Keine Scan-Daten im aktuellen Monat vorhanden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Retention-Trend (DAU / WAU / MAU)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-stone-600 mb-3">
              14-Tage Stickiness-Schnitt (DAU/MAU): <strong>{retentionTrendSummary.current.toFixed(2)}%</strong>
              {" "}(vorher: {retentionTrendSummary.previous.toFixed(2)}%, Delta: {retentionTrendSummary.deltaPercent >= 0 ? "+" : ""}{retentionTrendSummary.deltaPercent.toFixed(1)}%)
            </p>

            <div className="h-80 w-full rounded-xl border border-stone-200 bg-stone-50 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={retentionSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                  <XAxis
                    dataKey="dateKey"
                    tickFormatter={formatDateLabel}
                    minTickGap={24}
                    stroke="#78716c"
                  />
                  <YAxis yAxisId="users" stroke="#78716c" allowDecimals={false} />
                  <YAxis yAxisId="percent" orientation="right" stroke="#78716c" domain={[0, 100]} />
                  <RechartsTooltip
                    formatter={(value, name) => {
                      if (name === "Stickiness") return [`${Number(value || 0).toFixed(2)}%`, name];
                      return [Number(value || 0).toLocaleString("de-DE"), name];
                    }}
                    labelFormatter={(label) => formatDateLabel(label)}
                  />
                  <Legend />
                  <Line yAxisId="users" type="monotone" dataKey="dau" name="DAU" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line yAxisId="users" type="monotone" dataKey="wau" name="WAU" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line yAxisId="users" type="monotone" dataKey="mau" name="MAU" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line yAxisId="percent" type="monotone" dataKey="stickiness" name="Stickiness" stroke="#6d28d9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-100 text-stone-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Datum</th>
                    <th className="text-right px-3 py-2 font-medium">DAU</th>
                    <th className="text-right px-3 py-2 font-medium">WAU</th>
                    <th className="text-right px-3 py-2 font-medium">MAU</th>
                    <th className="text-right px-3 py-2 font-medium">Stickiness</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionTableRows.map((row) => (
                    <tr key={row.dateKey} className="border-t border-stone-200">
                      <td className="px-3 py-2">{formatDateLabel(row.dateKey)}</td>
                      <td className="px-3 py-2 text-right">{Number(row.dau || 0).toLocaleString("de-DE")}</td>
                      <td className="px-3 py-2 text-right">{Number(row.wau || 0).toLocaleString("de-DE")}</td>
                      <td className="px-3 py-2 text-right">{Number(row.mau || 0).toLocaleString("de-DE")}</td>
                      <td className="px-3 py-2 text-right font-semibold">{Number(row.stickiness || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Aktuell angemeldete Nutzer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm text-stone-600">
                Live ueber Supabase Presence
              </p>
              <p className="text-xs text-stone-500">
                {isLoadingOnlineUsers ? "..." : `${onlineUsers.length} online`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isLoadingOnlineUsers ? (
                <span className="text-sm text-stone-500">Online-Status wird geladen...</span>
              ) : onlineUsers.length > 0 ? (
                onlineUsers.map((onlineUser) => (
                  <span
                    key={onlineUser.presenceKey}
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                  >
                    {getOnlinePresenceDisplayName(onlineUser)}
                    {onlineUser.connectionCount > 1 ? ` x${onlineUser.connectionCount}` : ""}
                  </span>
                ))
              ) : (
                <span className="text-sm text-stone-500">Derzeit sind keine angemeldeten Nutzer sichtbar.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Datenbasis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Nutzer</p>
                <p className="text-lg font-semibold text-stone-900">{Number(summary?.totals?.users || 0).toLocaleString("de-DE")}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Scans gesamt</p>
                <p className="text-lg font-semibold text-stone-900">{Number(summary?.totals?.discoveries || 0).toLocaleString("de-DE")}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Likes gesamt</p>
                <p className="text-lg font-semibold text-stone-900">{Number(summary?.totals?.likes || 0).toLocaleString("de-DE")}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs text-stone-500">Kartenaufrufe gesamt</p>
                <p className="text-lg font-semibold text-stone-900">{Number(summary?.totals?.mapViews || 0).toLocaleString("de-DE")}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Letztes Update: {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString("de-DE") : "-"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

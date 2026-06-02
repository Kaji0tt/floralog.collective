import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, BarChart3, RefreshCw } from "lucide-react";

import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { buildGlobalKpiSummary } from "@/api/kpiService";
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
    queryFn: () => Query.UserPlantDiscovery.list("-created_date"),
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
    queryFn: () => Query.PublicProfile.list(),
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
    queryFn: () => Query.ScanLike.list("-created_date"),
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
    queryFn: () => Query.MapViewEvent.list("-created_date", 10000),
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

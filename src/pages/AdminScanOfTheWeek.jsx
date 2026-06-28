import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/api/userApi";
import { Query } from "@/api/entities";
import { grantWalletCurrency } from "@/api/walletService";
import { createUserNotification } from "@/api/notificationService";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trophy, Sparkles, Check, ArrowLeft, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export default function AdminScanOfTheWeek() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedDiscovery, setSelectedDiscovery] = useState(null);
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState(null);
  const [awardError, setAwardError] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser && normalizeRole(currentUser?.role) !== "admin") {
          setTimeout(() => navigate(createPageUrl("Home")), 500);
        }
      } catch {
        navigate(createPageUrl("Home"));
      } finally {
        setUserLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["publicProfiles"],
    queryFn: () => Query.PublicProfile.list(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const selectedProfile =
    profiles.find((p) => p.auth_id === selectedProfileId) || null;

  const { data: discoveries = [], isLoading: discoveriesLoading } = useQuery({
    queryKey: ["sotwDiscoveries", selectedProfileId],
    queryFn: () =>
      Query.UserPlantDiscovery.filter({ auth_id: selectedProfileId }),
    enabled: !!selectedProfileId,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["allPlants"],
    queryFn: () => Query.Plant.list(),
    enabled: !!selectedProfileId,
    staleTime: 300_000,
  });

  const plantMap = React.useMemo(() => {
    const map = new Map();
    plants.forEach((p) => map.set(p.id, p));
    return map;
  }, [plants]);

  const sortedDiscoveries = React.useMemo(() => {
    return [...discoveries]
      .filter((d) => d.image_url)
      .sort(
        (a, b) =>
          new Date(b.discovered_date || 0) - new Date(a.discovered_date || 0)
      )
      .slice(0, 60);
  }, [discoveries]);

  const getPlantName = (discovery) => {
    const plant = plantMap.get(discovery.plant_id);
    return (
      plant?.species_name || plant?.common_name || "Unbekannte Pflanze"
    );
  };

  const handleProfileChange = (authId) => {
    setSelectedProfileId(authId);
    setSelectedDiscovery(null);
    setAwardSuccess(null);
    setAwardError(null);
  };

  const handleAward = async () => {
    if (!selectedProfile || !selectedDiscovery) return;
    setIsAwarding(true);
    setAwardError(null);
    try {
      const plantName = getPlantName(selectedDiscovery);

      await grantWalletCurrency({
        authId: selectedProfile.auth_id,
        currencyCode: "sparks",
        eventSource: "scan_of_the_week",
        eventReference: selectedDiscovery.id,
        amount: 10,
        direction: "credit",
        metadata: {
          scanName: plantName,
          discoveryId: selectedDiscovery.id,
          awardedBy: user?.id,
        },
      });

      await createUserNotification({
        authId: selectedProfile.auth_id,
        notificationType: "scan_of_the_week",
        title: "Scan der Woche",
        message: `Dein Scan wurde zur Aufnahme der Woche gekürt. Die Community liebt dein Foto!`,
        description: plantName,
        priority: "high",
        displayLocation: "modal",
        createdBy: "admin",
      });

      setAwardSuccess({
        profileName:
          selectedProfile.display_name ||
          selectedProfile.user_email ||
          "Spieler",
        plantName,
      });
      setSelectedDiscovery(null);
    } catch (err) {
      console.error("[AdminSoTW] Award failed", err);
      setAwardError(err?.message || "Unbekannter Fehler");
    } finally {
      setIsAwarding(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user || normalizeRole(user?.role) !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950 text-red-400 text-sm p-8 text-center">
        Kein Zugriff.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4 pb-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-200 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold text-amber-100">
              Scan der Woche vergeben
            </h1>
          </div>
        </div>

        {/* Success banner */}
        <AnimatePresence>
          {awardSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-900/30 px-5 py-4 flex items-start gap-3"
            >
              <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-emerald-100 font-semibold">
                  Scan der Woche vergeben!
                </p>
                <p className="text-sm text-emerald-200/80 mt-0.5">
                  <span className="font-medium">{awardSuccess.profileName}</span>{" "}
                  erhält 10 Funken für den Scan „
                  <span className="font-medium">{awardSuccess.plantName}</span>
                  ".
                </p>
              </div>
              <button
                onClick={() => setAwardSuccess(null)}
                className="text-emerald-400/60 hover:text-emerald-300 text-lg leading-none ml-2"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {awardError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-5 rounded-2xl border border-red-500/40 bg-red-900/30 px-5 py-4 flex items-start gap-3"
            >
              <span className="text-red-400 text-lg shrink-0">✕</span>
              <div className="flex-1">
                <p className="text-red-100 font-semibold">Fehler beim Vergeben</p>
                <p className="text-sm text-red-200/80 mt-0.5">{awardError}</p>
              </div>
              <button
                onClick={() => setAwardError(null)}
                className="text-red-400/60 hover:text-red-300 text-lg leading-none ml-2"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Select player */}
        <Card className="bg-stone-900 border-stone-700 mb-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-stone-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                1
              </span>
              Spieler auswählen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedProfileId}
              onValueChange={handleProfileChange}
            >
              <SelectTrigger className="bg-stone-800 border-stone-600 text-stone-100 focus:ring-amber-400/40">
                <SelectValue placeholder="Spieler wählen…" />
              </SelectTrigger>
              <SelectContent className="bg-stone-800 border-stone-600 text-stone-100 max-h-72">
                {[...profiles]
                  .sort((a, b) =>
                    (a.display_name || a.user_email || "").localeCompare(
                      b.display_name || b.user_email || ""
                    )
                  )
                  .map((p) => (
                    <SelectItem
                      key={p.auth_id}
                      value={p.auth_id}
                      className="text-stone-100 focus:bg-stone-700 focus:text-stone-50"
                    >
                      {p.display_name || p.user_email || p.auth_id}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: Select scan */}
        {selectedProfileId && (
          <Card className="bg-stone-900 border-stone-700 mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-stone-200 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                  2
                </span>
                <span>
                  Scan auswählen
                  {selectedProfile && (
                    <span className="ml-2 text-amber-300/80 font-normal">
                      –{" "}
                      {selectedProfile.display_name ||
                        selectedProfile.user_email}
                    </span>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discoveriesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : sortedDiscoveries.length === 0 ? (
                <p className="text-stone-400 text-sm text-center py-6">
                  Keine Scans mit Foto vorhanden.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sortedDiscoveries.map((disc) => {
                    const plantName = getPlantName(disc);
                    const isSelected = selectedDiscovery?.id === disc.id;
                    return (
                      <motion.button
                        key={disc.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          setSelectedDiscovery(isSelected ? null : disc)
                        }
                        className={`relative rounded-xl overflow-hidden border-2 text-left transition-colors ${
                          isSelected
                            ? "border-amber-400 ring-2 ring-amber-400/30"
                            : "border-stone-700 hover:border-stone-500"
                        }`}
                      >
                        <div className="aspect-square w-full bg-stone-800">
                          <img
                            src={disc.image_url}
                            alt={plantName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="px-2 py-1.5 bg-stone-900/95">
                          <p className="text-xs font-medium text-stone-100 truncate">
                            {plantName}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {formatDate(disc.discovered_date)}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-amber-400 rounded-full p-0.5 shadow">
                            <Check className="h-3.5 w-3.5 text-stone-900" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirm & Award */}
        <AnimatePresence>
          {selectedDiscovery && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <Card className="bg-stone-900 border-amber-500/35 mb-5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-stone-200 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                      3
                    </span>
                    Bestätigen & vergeben
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-4 mb-4">
                    {selectedDiscovery.image_url && (
                      <img
                        src={selectedDiscovery.image_url}
                        alt=""
                        className="w-20 h-20 rounded-xl object-cover shrink-0 border border-stone-700"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <Badge className="bg-amber-400/15 text-amber-200 border-amber-400/35 mb-2 text-[11px]">
                        <Trophy className="h-3 w-3 mr-1" />
                        Scan der Woche
                      </Badge>
                      <p className="text-stone-100 font-semibold truncate">
                        {getPlantName(selectedDiscovery)}
                      </p>
                      <p className="text-stone-400 text-sm mt-0.5 truncate">
                        {selectedProfile?.display_name ||
                          selectedProfile?.user_email}{" "}
                        · {formatDate(selectedDiscovery.discovered_date)}
                      </p>
                      <p className="text-amber-300 text-sm mt-1.5 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" />
                        +10 Funken werden gutgeschrieben
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleAward}
                    disabled={isAwarding}
                    className="w-full bg-gradient-to-b from-amber-400 to-orange-500 text-stone-900 font-bold hover:from-amber-300 hover:to-orange-400 disabled:opacity-60"
                  >
                    {isAwarding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Wird vergeben…
                      </>
                    ) : (
                      <>
                        <Trophy className="h-4 w-4 mr-2" />
                        Scan der Woche vergeben &amp; 10 Funken gutschreiben
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

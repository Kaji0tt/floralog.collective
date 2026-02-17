import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { awardXP } from "../components/utils/xpSystem";
import { motion } from "framer-motion";

export default function ViewSharedScan() {
  const [user, setUser] = useState(null);
  const [processingXP, setProcessingXP] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const sharedScanId = urlParams.get('id');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: sharedScan, isLoading } = useQuery({
    queryKey: ['sharedScan', sharedScanId],
    queryFn: async () => {
      const scans = await base44.entities.SharedScan.list();
      return scans.find(s => s.id === sharedScanId);
    },
    enabled: !!sharedScanId,
  });

  const { data: plant } = useQuery({
    queryKey: ['plant', sharedScan?.plant_id],
    queryFn: async () => {
      const plants = await base44.entities.Plant.list();
      return plants.find(p => p.id === sharedScan.plant_id);
    },
    enabled: !!sharedScan?.plant_id,
  });

  const { data: genus } = useQuery({
    queryKey: ['genus', plant?.genus_id],
    queryFn: async () => {
      const genera = await base44.entities.PlantGenus.list();
      return genera.find(g => g.id === plant.genus_id);
    },
    enabled: !!plant?.genus_id,
  });

  const { data: senderProfile } = useQuery({
    queryKey: ['profile', sharedScan?.shared_by],
    queryFn: async () => {
      const profiles = await base44.entities.PublicProfile.list();
      return profiles.find(p => p.user_email === sharedScan.shared_by);
    },
    enabled: !!sharedScan?.shared_by,
  });

  const updateScanMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SharedScan.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedScan'] });
      queryClient.invalidateQueries({ queryKey: ['sharedScans'] });
    },
  });

  const updatePublicProfile = async (userData) => {
    try {
      const profiles = await base44.entities.PublicProfile.list();
      const existingProfile = profiles.find(p => p.user_email?.toLowerCase() === userData.email?.toLowerCase());

      const profileData = {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
        level: userData.level || 1,
        xp: userData.xp || 0,
        title: userData.title,
        selected_title: userData.selected_title,
        avatar_url: userData.avatar_url
      };

      if (existingProfile) {
        await base44.entities.PublicProfile.update(existingProfile.id, profileData);
      } else {
        await base44.entities.PublicProfile.create(profileData);
      }
    } catch (error) {
      console.error("PublicProfile Update Fehler:", error);
    }
  };

  useEffect(() => {
    const markAsViewed = async () => {
      if (!sharedScan || !user || processingXP) return;
      if (sharedScan.shared_to !== user.email) return;
      if (sharedScan.viewed && sharedScan.xp_awarded) return;

      setProcessingXP(true);

      try {
        // Markiere als angesehen und vergebe XP
        await updateScanMutation.mutateAsync({
          id: sharedScan.id,
          data: {
            viewed: true,
            viewed_date: new Date().toISOString(),
            xp_awarded: true
          }
        });

        // Vergebe 25 XP an den User
        const currentXP = user.xp || 0;
        const result = awardXP(currentXP, 25);
        
        await base44.auth.updateMe(result);
        
        const freshUser = await getCurrentUser();
        setUser(freshUser);
        await updatePublicProfile(freshUser);

      } catch (error) {
        console.error("Fehler beim Markieren:", error);
      } finally {
        setProcessingXP(false);
      }
    };

    markAsViewed();
  }, [sharedScan, user]);

  const getRarityColor = (rarity) => {
    switch(rarity) {
      case "Häufig": return "bg-green-100 text-green-800";
      case "Gelegentlich": return "bg-blue-100 text-blue-800";
      case "Selten": return "bg-purple-100 text-purple-800";
      case "Sehr Selten": return "bg-amber-100 text-amber-800";
      case "Extrem Selten": return "bg-red-100 text-red-800";
      default: return "bg-stone-100 text-stone-800";
    }
  };

  const getRarityStars = (rarity) => {
    switch(rarity) {
      case "Häufig": return "⭐";
      case "Gelegentlich": return "⭐⭐";
      case "Selten": return "⭐⭐⭐";
      case "Sehr Selten": return "⭐⭐⭐⭐";
      case "Extrem Selten": return "⭐⭐⭐⭐⭐";
      default: return "⭐";
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-stone-600">Lade geteilten Scan...</p>
        </div>
      </div>
    );
  }

  if (!sharedScan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-stone-900 mb-4">Scan nicht gefunden</p>
            <Button onClick={() => navigate(createPageUrl("Home"))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück zur Startseite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sharedScan.shared_to !== user.email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-stone-900 mb-2">Zugriff verweigert</p>
            <p className="text-stone-600 mb-4">Dieser Scan wurde nicht mit dir geteilt.</p>
            <Button onClick={() => navigate(createPageUrl("Home"))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück zur Startseite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        {!sharedScan.xp_awarded && processingXP && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-amber-400 to-amber-600 rounded-xl shadow-lg p-4 text-white text-center"
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 animate-pulse" />
              <p className="font-bold text-lg">+25 XP für das Ansehen!</p>
            </div>
          </motion.div>
        )}

        <Card className="border-2 border-stone-200 shadow-xl bg-white mb-6">
          <CardHeader className="border-b border-stone-200 bg-gradient-to-r from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-white">
                <AvatarImage src={senderProfile?.avatar_url} />
                <AvatarFallback className="bg-green-600 text-white">
                  {senderProfile?.display_name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-stone-600">Geteilt von</p>
                <p className="font-bold text-lg text-stone-900">
                  {senderProfile?.display_name || senderProfile?.full_name || "Unbekannt"}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {sharedScan.image_url && (
              <div className="mb-6 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={sharedScan.image_url}
                  alt="Geteilter Scan"
                  className="w-full h-auto"
                />
              </div>
            )}

            {plant && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900 mb-2">
                    {plant.species_name}
                  </h2>
                  <p className="text-lg italic text-stone-600">
                    {plant.scientific_name}
                  </p>
                  {genus && (
                    <p className="text-sm text-stone-500 mt-1">
                      {genus.category} • {genus.family}
                    </p>
                  )}
                </div>

                {plant.rarity && (
                  <div className="flex gap-2">
                    <Badge className={getRarityColor(plant.rarity)}>
                      {getRarityStars(plant.rarity)} {plant.rarity}
                    </Badge>
                  </div>
                )}

                {plant.description && (
                  <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
                    <h3 className="font-semibold text-stone-900 mb-2">Beschreibung</h3>
                    <p className="text-stone-700 leading-relaxed">{plant.description}</p>
                  </div>
                )}

                {plant.identification_features && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h3 className="font-semibold text-green-900 mb-2">🔍 Erkennungsmerkmale</h3>
                    <p className="text-green-800 leading-relaxed">{plant.identification_features}</p>
                  </div>
                )}

                {plant.fun_fact && (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h3 className="font-semibold text-amber-900 mb-2">💡 Wusstest du?</h3>
                    <p className="text-amber-800 leading-relaxed">{plant.fun_fact}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  {sharedScan.discovery_location && (
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <MapPin className="w-4 h-4" />
                      <span>Fundort gespeichert</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(sharedScan.shared_date).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            variant="outline"
            className="border-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}
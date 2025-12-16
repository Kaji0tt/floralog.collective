import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function ToastNotificationManager({ user }) {
  const { toast } = useToast();
  const [lastChecked, setLastChecked] = useState({
    friendRequests: new Date().toISOString(),
    sharedScans: new Date().toISOString(),
    scanLikes: new Date().toISOString()
  });

  // Freundschaftsanfragen abfragen
  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friendRequests', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await base44.entities.Friend.list();
      return allFriends.filter(f => 
        f.request_sent_to?.toLowerCase() === user.email.toLowerCase() && 
        f.status === 'pending'
      );
    },
    enabled: !!user?.email,
    refetchInterval: 10000, // Alle 10 Sekunden prüfen
  });

  // Geteilte Scans abfragen
  const { data: sharedScans = [] } = useQuery({
    queryKey: ['sharedScans', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allSharedScans = await base44.entities.SharedScan.list();
      return allSharedScans.filter(s => 
        s.shared_to?.toLowerCase() === user.email.toLowerCase() && 
        !s.viewed
      );
    },
    enabled: !!user?.email,
    refetchInterval: 10000,
  });

  // Likes auf eigene Scans abfragen
  const { data: scanLikes = [] } = useQuery({
    queryKey: ['myRecentScanLikes', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      
      // Hole alle Likes
      const allLikes = await base44.entities.ScanLike.list('-created_date');
      
      // Hole alle Discoveries des Users
      const myDiscoveries = await base44.entities.UserPlantDiscovery.filter({
        created_by: user.email
      });
      const myDiscoveryIds = myDiscoveries.map(d => d.id);
      
      // Filtere Likes auf meine Scans (nicht von mir selbst)
      return allLikes.filter(like => 
        myDiscoveryIds.includes(like.discovery_id) && 
        like.liked_by?.toLowerCase() !== user.email.toLowerCase()
      );
    },
    enabled: !!user?.email,
    refetchInterval: 10000,
  });

  // Public Profiles für Anzeigenamen
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.PublicProfile.list(),
    refetchInterval: 30000,
  });

  // Plants für Pflanzennamen
  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  // Freundschaftsanfragen-Benachrichtigungen
  useEffect(() => {
    if (!friendRequests || friendRequests.length === 0) return;

    friendRequests.forEach(request => {
      const requestDate = new Date(request.created_date);
      if (requestDate > new Date(lastChecked.friendRequests)) {
        const senderProfile = publicProfiles.find(p => 
          p.user_email?.toLowerCase() === request.request_sent_by?.toLowerCase()
        );
        const senderName = senderProfile?.display_name || senderProfile?.full_name || 'Jemand';
        
        toast({
          title: "🤝 Neue Freundschaftsanfrage",
          description: `${senderName} möchte dein Freund werden!`,
          duration: 5000,
        });
      }
    });

    setLastChecked(prev => ({ ...prev, friendRequests: new Date().toISOString() }));
  }, [friendRequests?.length]);

  // Geteilte Scans-Benachrichtigungen
  useEffect(() => {
    if (!sharedScans || sharedScans.length === 0) return;

    sharedScans.forEach(scan => {
      const scanDate = new Date(scan.shared_date);
      if (scanDate > new Date(lastChecked.sharedScans)) {
        const senderProfile = publicProfiles.find(p => 
          p.user_email?.toLowerCase() === scan.shared_by?.toLowerCase()
        );
        const senderName = senderProfile?.display_name || senderProfile?.full_name || 'Jemand';
        
        const plant = plants.find(p => p.id === scan.plant_id);
        const plantName = plant?.species_name || 'eine Pflanze';
        
        toast({
          title: "🎁 Neue Pflanze erhalten",
          description: `${senderName} hat dir ${plantName} geschenkt!`,
          duration: 5000,
        });
      }
    });

    setLastChecked(prev => ({ ...prev, sharedScans: new Date().toISOString() }));
  }, [sharedScans?.length]);

  // Scan-Likes-Benachrichtigungen
  useEffect(() => {
    if (!scanLikes || scanLikes.length === 0) return;

    const recentLikes = scanLikes.filter(like => {
      const likeDate = new Date(like.created_date || like.liked_date);
      return likeDate > new Date(lastChecked.scanLikes);
    });

    if (recentLikes.length > 0) {
      const like = recentLikes[0]; // Zeige nur den neuesten Like
      const likerProfile = publicProfiles.find(p => 
        p.user_email?.toLowerCase() === like.liked_by?.toLowerCase()
      );
      const likerName = likerProfile?.display_name || likerProfile?.full_name || 'Jemand';
      
      if (recentLikes.length === 1) {
        toast({
          title: "❤️ Neuer Like",
          description: `${likerName} gefällt dein Scan!`,
          duration: 4000,
        });
      } else {
        toast({
          title: "❤️ Neue Likes",
          description: `${likerName} und ${recentLikes.length - 1} andere gefällt dein Scan!`,
          duration: 4000,
        });
      }

      setLastChecked(prev => ({ ...prev, scanLikes: new Date().toISOString() }));
    }
  }, [scanLikes?.length]);

  return null; // Keine UI, nur Benachrichtigungen
}
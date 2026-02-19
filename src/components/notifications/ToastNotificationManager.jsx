import React, { useEffect, useState } from "react";
import { Query } from "@/api/entities";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function ToastNotificationManager({ user }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastChecked, setLastChecked] = useState({
    friendRequests: new Date().toISOString(),
    sharedScans: new Date().toISOString(),
    scanLikes: new Date().toISOString()
  });

  // Freundschaftsanfragen abfragen (nur initiales Laden)
  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friendRequests', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      return allFriends.filter(f => 
        f.request_sent_to?.toLowerCase() === user.email.toLowerCase() && 
        f.status === 'pending'
      );
    },
    enabled: !!user?.email,
    staleTime: Infinity, // Daten nicht als veraltet markieren
  });

  // Geteilte Scans abfragen (nur initiales Laden)
  const { data: sharedScans = [] } = useQuery({
    queryKey: ['sharedScans', user?.id],
    queryFn: async () => {
      if (!user?.email) return [];
      const allSharedScans = await Query.SharedScan.list();
      return allSharedScans.filter(s => 
        s.shared_to?.toLowerCase() === user.email.toLowerCase() && 
        !s.viewed
      );
    },
    enabled: !!user?.email,
    staleTime: Infinity,
  });

  // Likes auf eigene Scans abfragen (nur initiales Laden)
  const { data: scanLikes = [] } = useQuery({
    queryKey: ['myRecentScanLikes', user?.id],
    queryFn: async () => {
      if (!user?.id || !user?.email) return [];
      
      const allLikes = await Query.ScanLike.list('-created_date');
      const myDiscoveries = await Query.UserPlantDiscovery.filter({
        auth_id: user.id
      });
      const myDiscoveryIds = myDiscoveries.map(d => d.id);
      
      return allLikes.filter(like => 
        myDiscoveryIds.includes(like.discovery_id) && 
        like.liked_by?.toLowerCase() !== user.email.toLowerCase()
      );
    },
    enabled: !!user?.email,
    staleTime: Infinity,
  });

  // Public Profiles für Anzeigenamen
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => Query.PublicProfile.list(),
    staleTime: 5 * 60 * 1000, // 5 Minuten Cache
  });

  // Plants für Pflanzennamen
  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => Query.Plant.list(),
    staleTime: 10 * 60 * 1000, // 10 Minuten Cache
  });

  // Echtzeit-Subscriptions für Friend-Änderungen
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.Friend.subscribe((event) => {
      if (event.type === 'create') {
        const friend = event.data;
        if (friend.request_sent_to?.toLowerCase() === user.email.toLowerCase() && 
            friend.status === 'pending') {
          queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        }
      } else if (event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für SharedScan-Änderungen
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.SharedScan.subscribe((event) => {
      if (event.type === 'create') {
        const scan = event.data;
        if (scan.shared_to?.toLowerCase() === user.email.toLowerCase() && !scan.viewed) {
          queryClient.invalidateQueries({ queryKey: ['sharedScans'] });
        }
      } else if (event.type === 'update' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['sharedScans'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

  // Echtzeit-Subscriptions für ScanLike-Änderungen
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = Query.ScanLike.subscribe((event) => {
      if (event.type === 'create' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['myRecentScanLikes'] });
      }
    });

    return unsubscribe;
  }, [user?.email]);

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
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, AlertCircle } from "lucide-react";

export default function ShareScanDialog({ open, onClose, discovery, plant, user }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Lade Freunde
  const { data: friendRecords = [] } = useQuery({
    queryKey: ['friends', user?.email],
    queryFn: () => base44.entities.Friend.filter({ 
      status: 'accepted'
    }),
    enabled: !!user?.email && open,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.PublicProfile.list(),
    enabled: open,
  });

  // Prüfe ob heute schon geteilt wurde
  const { data: todayShares = [] } = useQuery({
    queryKey: ['todayShares', user?.email],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const allShares = await base44.entities.SharedScan.filter({
        created_by: user.email
      });
      return allShares.filter(s => {
        const shareDate = new Date(s.shared_date);
        shareDate.setHours(0, 0, 0, 0);
        return shareDate.getTime() === today.getTime();
      });
    },
    enabled: !!user?.email && open,
  });

  const friends = friendRecords
    .filter(f => 
      f.request_sent_by === user?.email || f.request_sent_to === user?.email
    )
    .map(f => {
      const friendEmail = f.request_sent_by === user?.email 
        ? f.request_sent_to 
        : f.request_sent_by;
      const profile = publicProfiles.find(p => p.user_email === friendEmail);
      return {
        email: friendEmail,
        name: profile?.display_name || profile?.full_name || friendEmail,
        avatar: profile?.avatar_url,
        level: profile?.level || 1
      };
    });

  const createShareMutation = useMutation({
    mutationFn: (data) => base44.entities.SharedScan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayShares'] });
      queryClient.invalidateQueries({ queryKey: ['sharedScans'] });
      setSharing(false);
      onClose();
    },
  });

  const handleShare = async () => {
    if (!selectedFriend) return;
    
    if (todayShares.length >= 1) {
      setError("Du hast heute bereits einen Scan geteilt. Versuch es morgen wieder!");
      return;
    }

    setSharing(true);
    setError(null);

    try {
      await createShareMutation.mutateAsync({
        discovery_id: discovery.id,
        plant_id: plant.id,
        shared_by: user.email,
        shared_to: selectedFriend.email,
        shared_date: new Date().toISOString(),
        image_url: discovery.image_url,
        discovery_location: discovery.discovery_location,
        viewed: false,
        xp_awarded: false,
      });
    } catch (err) {
      setError("Fehler beim Teilen. Bitte versuche es erneut.");
      setSharing(false);
    }
  };

  const canShareToday = todayShares.length < 1;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Scan mit Freund teilen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!canShareToday && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Tägliches Limit erreicht
                </p>
                <p className="text-xs text-amber-700">
                  Du kannst nur einen Scan pro Tag teilen.
                </p>
              </div>
            </div>
          )}

          <div className="text-sm text-stone-600 mb-2">
            <p className="font-semibold mb-1">Teile: {plant.species_name}</p>
            <p className="text-xs">
              {canShareToday 
                ? "Wähle einen Freund aus (1/1 verbleibend heute)"
                : "Komm morgen wieder, um einen neuen Scan zu teilen"
              }
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {friends.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <p>Du hast noch keine Freunde.</p>
                <p className="text-sm">Füge Freunde hinzu, um Scans zu teilen!</p>
              </div>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend.email}
                  onClick={() => setSelectedFriend(friend)}
                  disabled={!canShareToday}
                  className={`w-full p-3 rounded-lg border-2 transition-all ${
                    selectedFriend?.email === friend.email
                      ? "border-green-600 bg-green-50"
                      : "border-stone-200 hover:border-green-300"
                  } ${!canShareToday ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback className="bg-green-600 text-white">
                        {friend.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-stone-900">{friend.name}</p>
                      <p className="text-xs text-stone-600">Level {friend.level}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={sharing}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleShare}
              disabled={!selectedFriend || sharing || !canShareToday}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {sharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird geteilt...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Teilen
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
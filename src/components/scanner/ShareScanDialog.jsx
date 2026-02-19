import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DAILY_SHARE_LIMIT = 3;

export default function ShareScanDialog({ open, onClose, discovery, plant, user }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const queryClient = useQueryClient();

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      if (!user?.email) return [];
      const allFriends = await Query.Friend.list();
      
      // Filtere akzeptierte Freundschaften in beide Richtungen
      const acceptedFriends = allFriends.filter(f => {
        const isMyFriend = (f.request_sent_by === user.email || f.request_sent_to === user.email);
        const isAccepted = f.status === 'accepted';
        return isMyFriend && isAccepted;
      });

      console.log('Alle Freunde:', allFriends.length);
      console.log('Akzeptierte Freundschaften für', user.email, ':', acceptedFriends);
      
      return acceptedFriends;
    },
    enabled: !!user?.email && open,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => Query.PublicProfile.list(),
    enabled: open,
  });

  const { data: todayShares = [] } = useQuery({
    queryKey: ['todayShares', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const allShares = await Query.SharedScan.list();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return allShares.filter(s => 
        s.auth_id_from === user.id && 
        new Date(s.shared_date) >= today
      );
    },
    enabled: !!user?.id && open,
  });

  const createShareMutation = useMutation({
    mutationFn: (data) => Query.SharedScan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayShares'] });
      queryClient.invalidateQueries({ queryKey: ['sharedScans'] });
    },
  });

  const getFriendEmail = (friend) => {
    if (friend.request_sent_by === user.email) {
      return friend.request_sent_to;
    }
    return friend.request_sent_by;
  };

  const getFriendProfile = (friendEmail) => {
    return publicProfiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
  };

  const handleShare = async () => {
    if (!selectedFriend || !discovery || !plant) return;
    
    if (todayShares.length >= DAILY_SHARE_LIMIT) {
      alert(`Du hast heute bereits ${DAILY_SHARE_LIMIT} Pflanzen geteilt. Versuche es morgen erneut!`);
      return;
    }

    setIsSharing(true);
    try {
      const friendEmail = getFriendEmail(selectedFriend);
      const friendProfile = getFriendProfile(friendEmail);
      
      // Pflanze teilen
      await createShareMutation.mutateAsync({
        auth_id_from: user.id,
        auth_id_to: friendProfile?.auth_id || null,
        discovery_id: discovery.id,
        plant_id: plant.id,
        shared_by: user.email,
        shared_to: friendEmail,
        shared_date: new Date().toISOString(),
        image_url: discovery.image_url,
        discovery_location: discovery.discovery_location,
        viewed: false,
        xp_awarded: false
      });

      // Push Notification senden
      try {
        await supabase.functions.invoke('sendPushNotification', {
          recipientEmail: friendEmail,
          title: '🎁 Neue Pflanze geschenkt!',
          body: `${user.display_name || user.full_name} hat dir "${plant.species_name}" geschenkt!`,
          data: {
            type: 'shared_scan',
            from: user.email
          }
        });
      } catch (notifError) {
        console.error('Push notification failed:', notifError);
        // Fehler bei Notification nicht anzeigen - Teilen war erfolgreich
      }

      alert('Pflanze erfolgreich verschenkt! 🎁');
      onClose();
    } catch (error) {
      console.error('Fehler beim Teilen:', error);
      alert('Fehler beim Teilen der Pflanze. Bitte versuche es erneut.');
    } finally {
      setIsSharing(false);
      setSelectedFriend(null);
    }
  };

  const remainingShares = DAILY_SHARE_LIMIT - todayShares.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-red-600" />
            Pflanze schenken
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {remainingShares <= 0 ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-900">
                Du hast heute bereits {DAILY_SHARE_LIMIT} Pflanzen geteilt. Versuche es morgen erneut! 🌱
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                Wähle einen Freund aus, mit dem du diese Pflanze teilen möchtest.
                <br />
                <span className="text-xs text-stone-500">
                  Noch {remainingShares} von {DAILY_SHARE_LIMIT} Teilungen heute verfügbar
                </span>
              </p>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {friends.length === 0 ? (
                  <p className="text-sm text-stone-500 text-center py-4">
                    Du hast noch keine Freunde. Füge Freunde hinzu, um Pflanzen zu teilen!
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-stone-400 mb-2">
                      {friends.length} Freund{friends.length !== 1 ? 'e' : ''} verfügbar
                    </p>
                    {friends.map((friend) => {
                      const friendEmail = getFriendEmail(friend);
                      const profile = getFriendProfile(friendEmail);
                      const isSelected = selectedFriend?.id === friend.id;

                      return (
                        <button
                          key={friend.id}
                          onClick={() => setSelectedFriend(friend)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-red-500 bg-red-50'
                              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback className="bg-green-600 text-white">
                              {profile?.display_name?.charAt(0).toUpperCase() || profile?.full_name?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-stone-900">
                              {profile?.display_name || profile?.full_name || friendEmail}
                            </p>
                            <p className="text-xs text-stone-500">
                              Level {profile?.level || 1}
                            </p>
                          </div>
                          {isSelected && (
                            <Gift className="w-5 h-5 text-red-600" />
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedFriend || isSharing || remainingShares <= 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird geschenkt...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Pflanze schenken
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
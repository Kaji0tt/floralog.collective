import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/api/userApi";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Star, ChevronRight, ArrowLeft, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MobileBackButton from "../components/navigation/MobileBackButton";

export default function FriendFriendsList() {
  const navigate = useNavigate();
  const [friendUser, setFriendUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isNotFriend, setIsNotFriend] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get('email');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadFriendUser = async () => {
      if (!friendEmail || !currentUser?.email) return;
      
      // Prüfe Freundschaftsstatus
      const allFriends = await base44.entities.Friend.list();
      const currentEmailLower = currentUser.email.toLowerCase();
      const friendEmailLower = friendEmail.toLowerCase();
      
      const friendship = allFriends.find(f =>
        ((f.request_sent_by?.toLowerCase() === currentEmailLower && 
          f.request_sent_to?.toLowerCase() === friendEmailLower) ||
         (f.request_sent_by?.toLowerCase() === friendEmailLower && 
          f.request_sent_to?.toLowerCase() === currentEmailLower)) &&
        f.status === 'accepted'
      );
      
      if (!friendship) {
        setIsNotFriend(true);
        return;
      }
      
      const profiles = await base44.entities.PublicProfile.list();
      const profile = profiles.find(p => p.user_email?.toLowerCase() === friendEmail?.toLowerCase());
      
      if (profile) {
        setFriendUser(profile);
      } else {
        setFriendUser({
          email: friendEmail,
          full_name: friendEmail,
          display_name: friendEmail,
          level: 1
        });
      }
    };
    if (friendEmail) {
      loadFriendUser();
    }
  }, [friendEmail, currentUser?.email]);

  const { data: allFriendRecords = [] } = useQuery({
    queryKey: ['allFriendRecords'],
    queryFn: () => base44.entities.Friend.list(),
    enabled: !!friendEmail,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friendsFriends', friendEmail],
    queryFn: async () => {
      if (!friendEmail) return [];
      return allFriendRecords.filter(f =>
        (f.request_sent_by?.toLowerCase() === friendEmail.toLowerCase() || 
         f.request_sent_to?.toLowerCase() === friendEmail.toLowerCase()) &&
        f.status === 'accepted'
      );
    },
    enabled: !!friendEmail && allFriendRecords.length > 0,
  });

  const { data: allPublicProfiles = [] } = useQuery({
    queryKey: ['allPublicProfiles'],
    queryFn: () => base44.entities.PublicProfile.list(),
  });

  if (isNotFriend) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 max-w-md text-center border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Zugriff verweigert</h2>
          <p className="text-stone-600 mb-6">
            Du musst mit dieser Person befreundet sein, um ihre Freundesliste zu sehen.
          </p>
          <button
            onClick={() => navigate(createPageUrl("Friends"))}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
          >
            Zurück zu Freunden
          </button>
        </div>
      </div>
    );
  }

  if (!friendUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Leaf className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const getFriendData = (friendEntry) => {
    if (!friendEmail) return null;

    const otherEmail = friendEntry.request_sent_by?.toLowerCase() === friendEmail.toLowerCase()
      ? friendEntry.request_sent_to
      : friendEntry.request_sent_by;
    
    const friendProfile = allPublicProfiles.find(p => p.user_email?.toLowerCase() === otherEmail?.toLowerCase());

    return {
      id: friendEntry.id,
      email: otherEmail,
      name: friendProfile?.display_name || friendProfile?.full_name || otherEmail,
      avatar_url: friendProfile?.avatar_url,
      level: friendProfile?.level || 1,
      title: friendProfile?.selected_title || friendProfile?.title || "Pflanzen-Anfänger"
    };
  };

  const handleFriendClick = (friendData) => {
    // Prüfe ob es der eigene User ist
    if (currentUser && friendData.email?.toLowerCase() === currentUser.email?.toLowerCase()) {
      navigate(createPageUrl("Home"));
    } else {
      navigate(createPageUrl(`FriendProfile?email=${friendData.email}`));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton backUrl={createPageUrl(`FriendProfile?email=${friendEmail}`)} />
      
      <div className="max-w-4xl mx-auto">
        {/* Back Button - nur Desktop */}
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl(`FriendProfile?email=${friendEmail}`))}
          className="mb-6 bg-white/80 backdrop-blur-md hover:bg-white/90 text-stone-900 font-semibold border border-stone-200 hidden md:inline-flex"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zum Profil
        </Button>

        <div className="text-center mb-8">
          <div className="flex flex-col items-center relative mb-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedMessage(true);
                setTimeout(() => setCopiedMessage(false), 2000);
              }}
              className="flex items-center justify-center gap-4 p-2 rounded-lg hover:bg-stone-100 transition-colors duration-200 cursor-pointer"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                {friendUser.avatar_url ? (
                  <img src={friendUser.avatar_url} alt={friendUser.full_name} className="w-full h-full object-cover" />
                ) : (
                  <Leaf className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-stone-900">
                  {friendUser.display_name || friendUser.full_name}'s Freunde
                </h1>
                <p className="text-lg text-stone-600">
                  Level {friendUser.level || 1} • {friendUser.selected_title || friendUser.title || "Pflanzen-Anfänger"}
                </p>
              </div>
            </button>
            {copiedMessage && (
              <Badge className="mt-2 bg-green-500 text-white shadow-sm">
                Link kopiert!
              </Badge>
            )}
          </div>
        </div>

        {friends.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 text-lg font-semibold mb-2">
              Noch keine Freunde
            </p>
            <p className="text-stone-500">
              {friendUser.display_name || friendUser.full_name} hat noch keine Freunde hinzugefügt
            </p>
          </div>
        ) : (
          <div className="grid gap-3 max-w-2xl mx-auto">
            {friends.map((friend, index) => {
              const friendData = getFriendData(friend);
              if (!friendData) return null;

              const isCurrentUser = currentUser && friendData.email?.toLowerCase() === currentUser.email?.toLowerCase();

              return (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`border-2 ${isCurrentUser ? 'border-green-300 bg-green-50/80' : 'border-stone-200 bg-white/80'} backdrop-blur-sm hover:border-purple-300 hover:shadow-md transition-all group`}>
                    <CardContent className="p-4">
                      <button
                        onClick={() => handleFriendClick(friendData)}
                        className="flex items-center gap-3 w-full text-left"
                      >
                        <div className={`w-12 h-12 bg-gradient-to-br ${isCurrentUser ? 'from-green-500 to-green-600' : 'from-purple-500 to-purple-600'} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden flex-shrink-0`}>
                          {friendData.avatar_url ? (
                            <img src={friendData.avatar_url} alt={friendData.name} className="w-full h-full object-cover" />
                          ) : (
                            friendData.name?.[0]?.toUpperCase() || friendData.email?.[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-stone-900 group-hover:text-purple-600 transition-colors truncate flex items-center gap-2">
                            {friendData.name}
                            {isCurrentUser && (
                              <Badge className="bg-green-600 text-white text-xs">Du</Badge>
                            )}
                          </div>
                          <div className="text-sm text-stone-600 flex items-center">
                            <Star className="w-3 h-3 mr-1 text-amber-500 flex-shrink-0" />
                            <span className="truncate">Level {friendData.level} • {friendData.title}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
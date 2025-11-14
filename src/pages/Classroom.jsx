
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Users, Plus, LogIn, Crown, Loader2, Trophy, Target, BookOpen, Leaf, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { awardXP } from "../components/utils/xpSystem";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Classroom() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateQuestDialog, setShowCreateQuestDialog] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [questPrompt, setQuestPrompt] = useState("");
  const [generatingQuest, setGeneratingQuest] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: myClassrooms = [] } = useQuery({
    queryKey: ['myClassrooms', user?.email],
    queryFn: () => base44.entities.ClassroomMember.filter({ member_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: allClassrooms = [] } = useQuery({
    queryKey: ['allClassrooms'],
    queryFn: () => base44.entities.Classroom.list(),
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['allMembers'],
    queryFn: () => base44.entities.ClassroomMember.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: classroomQuests = [] } = useQuery({
    queryKey: ['classroomQuests'],
    queryFn: () => base44.entities.ClassroomQuest.list(),
  });

  const { data: myUserQuests = [] } = useQuery({
    queryKey: ['myUserQuests', user?.email],
    queryFn: () => base44.entities.UserQuest.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const createClassroomMutation = useMutation({
    mutationFn: async (data) => {
      const classroom = await base44.entities.Classroom.create(data);
      await base44.entities.ClassroomMember.create({
        classroom_id: classroom.id,
        member_email: user.email,
        member_name: user.full_name,
        joined_date: new Date().toISOString()
      });
      return classroom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClassrooms'] });
      queryClient.invalidateQueries({ queryKey: ['allClassrooms'] });
      setShowCreateDialog(false);
      setClassName("");
      setClassDescription("");
    },
  });

  const joinClassroomMutation = useMutation({
    mutationFn: async (code) => {
      const classroom = allClassrooms.find(c => c.code === code);
      if (!classroom) throw new Error("Klasse nicht gefunden");
      
      const alreadyMember = myClassrooms.some(m => m.classroom_id === classroom.id);
      if (alreadyMember) throw new Error("Du bist bereits Mitglied dieser Klasse");

      return base44.entities.ClassroomMember.create({
        classroom_id: classroom.id,
        member_email: user.email,
        member_name: user.full_name,
        joined_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClassrooms'] });
      queryClient.invalidateQueries({ queryKey: ['allMembers'] });
      setShowJoinDialog(false);
      setJoinCode("");
    },
  });

  const createQuestMutation = useMutation({
    mutationFn: (data) => base44.entities.ClassroomQuest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroomQuests'] });
      setShowCreateQuestDialog(false);
      setQuestPrompt("");
    },
  });

  const completeClassroomQuestMutation = useMutation({
    mutationFn: async ({ questId, xpReward }) => {
      const alreadyCompleted = myUserQuests.some(uq => uq.quest_id === questId && uq.completed);
      
      if (alreadyCompleted) {
        throw new Error("Diese Aufgabe wurde bereits abgeschlossen.");
      }

      await base44.entities.UserQuest.create({
        quest_id: questId,
        completed: true,
        completed_date: new Date().toISOString(),
        created_by: user?.email
      });
      
      const currentUserData = await base44.auth.me();
      const currentXP = currentUserData?.xp || 0;
      
      // Use the new awardXP utility function
      const { xp: newXP, level: newLevel, title: newTitle } = awardXP(currentXP, xpReward);
      
      await base44.auth.updateMe({
        xp: newXP,
        level: newLevel,
        title: newTitle
      });
      
      return { xp: newXP, level: newLevel, title: newTitle };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroomQuests'] });
      queryClient.invalidateQueries({ queryKey: ['myUserQuests'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] }); // Invalidate allUsers to update member stats if they rely on it
      queryClient.invalidateQueries({ queryKey: ['myClassrooms'] }); // Invalidate myClassrooms to reflect potential level changes in UI
    },
    onError: (error) => {
      console.error("Fehler beim Abschließen der Aufgabe:", error);
      alert(`Fehler beim Abschließen der Aufgabe: ${error.message}`);
    }
  });

  const handleCreateClassroom = async () => {
    if (!className) return;
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await createClassroomMutation.mutateAsync({
      name: className,
      code: code,
      admin_email: user.email,
      description: classDescription
    });
  };

  const handleJoinClassroom = async () => {
    if (!joinCode) return;
    try {
      await joinClassroomMutation.mutateAsync(joinCode.toUpperCase());
    } catch (error) {
      alert(error.message);
    }
  };

  const handleGenerateQuest = async () => {
    if (!questPrompt || !selectedClassroom) return;

    setGeneratingQuest(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein Lehrer, der eine Aufgabe für Schüler erstellt, die mit der PlantDex-App die Natur erkunden.
        
Erstelle basierend auf diesem Wunsch eine passende Aufgabe: "${questPrompt}"

Die Aufgabe soll:
- Einen motivierenden Titel haben
- Eine klare Beschreibung, was zu tun ist
- Eine Anforderung definieren (z.B. "Entdecke 3 verschiedene Bäume")
- Eine passende Kategorie haben (Bäume, Sträucher, Blumen & Kräuter, oder Alle)
- Angemessene XP-Belohnung zwischen 50-200
- Eine sinnvolle Anzahl an benötigten Entdeckungen (1-10)

Erstelle eine spannende und lehrreiche Aufgabe!`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            requirement: { type: "string" },
            category: { type: "string" },
            xp_reward: { type: "integer" },
            required_discoveries: { type: "integer" }
          }
        }
      });

      await createQuestMutation.mutateAsync({
        classroom_id: selectedClassroom.id,
        ...result
      });
    } catch (error) {
      console.error("Fehler beim Generieren der Aufgabe:", error);
      alert("Fehler beim Erstellen der Aufgabe");
    }
    setGeneratingQuest(false);
  };

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  const myClassroomDetails = myClassrooms.map(mc => {
    const classroom = allClassrooms.find(c => c.id === mc.classroom_id);
    const members = allMembers.filter(m => m.classroom_id === mc.classroom_id);
    const isAdmin = classroom?.admin_email === user.email;
    
    return {
      ...classroom,
      memberCount: members.length,
      isAdmin,
      members
    };
  }).filter(c => c.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="PlantDex Logo" className="h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">
            Meine Klassen
          </h1>
          <p className="text-lg text-stone-600">
            Lerne gemeinsam mit deiner Klasse die Natur kennen!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer border-2 border-stone-200 hover:border-green-500 hover:shadow-lg transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Klasse erstellen</h3>
                  <p className="text-stone-600">Erstelle eine neue Klasse und lade Schüler ein</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Klasse erstellen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="className">Klassenname</Label>
                  <Input
                    id="className"
                    placeholder="z.B. 5a Biologie"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="classDescription">Beschreibung (optional)</Label>
                  <Textarea
                    id="classDescription"
                    placeholder="Beschreibe deine Klasse..."
                    value={classDescription}
                    onChange={(e) => setClassDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateClassroom}
                  disabled={!className || createClassroomMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {createClassroomMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    "Klasse erstellen"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer border-2 border-stone-200 hover:border-blue-500 hover:shadow-lg transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <LogIn className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Klasse beitreten</h3>
                  <p className="text-stone-600">Tritt einer bestehenden Klasse bei</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Klasse beitreten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="joinCode">Klassencode</Label>
                  <Input
                    id="joinCode"
                    placeholder="6-stelliger Code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
                <Button
                  onClick={handleJoinClassroom}
                  disabled={!joinCode || joinClassroomMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {joinClassroomMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Trete bei...
                    </>
                  ) : (
                    "Beitreten"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {myClassroomDetails.length === 0 ? (
          <Card className="border-2 border-stone-200">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-stone-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                Keine Klassen
              </h3>
              <p className="text-stone-600">
                Erstelle eine Klasse oder tritt einer bei!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {myClassroomDetails.map((classroom, index) => {
              const classroomQuestsFiltered = classroomQuests.filter(q => q.classroom_id === classroom.id);
              
              const memberStats = classroom.members.map(member => {
                const memberUser = allUsers.find(u => u.email === member.member_email);
                const memberPlants = plants.filter(p => p.created_by === member.member_email && p.discovered);
                const memberGenera = genera.filter(g => {
                  const genusPlants = plants.filter(p => p.genus_id === g.id && p.created_by === member.member_email);
                  return genusPlants.some(p => p.discovered);
                });
                
                return {
                  ...member,
                  level: memberUser?.level || 1,
                  xp: memberUser?.xp || 0,
                  avatar_url: memberUser?.avatar_url,
                  discoveredPlants: memberPlants.length,
                  discoveredGenera: memberGenera.length
                };
              }).sort((a, b) => b.xp - a.xp);

              const calculateQuestProgress = (quest) => {
                if (!user || !quest.required_discoveries) return 0;
                
                const userDiscoveredGenera = genera.filter(g => {
                  const genusPlants = plants.filter(p => p.genus_id === g.id && p.created_by === user.email);
                  return genusPlants.some(p => p.discovered);
                });
                
                if (quest.category === "Alle") {
                  return Math.min(userDiscoveredGenera.length, quest.required_discoveries);
                } else {
                  const categoryGenera = userDiscoveredGenera.filter(g => g.category === quest.category);
                  return Math.min(categoryGenera.length, quest.required_discoveries);
                }
              };

              return (
                <motion.div
                  key={classroom.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="border-2 border-stone-200 shadow-lg">
                    <CardHeader className="border-b border-stone-200 bg-gradient-to-r from-green-50 to-emerald-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-2xl">{classroom.name}</CardTitle>
                            {classroom.isAdmin && (
                              <Badge className="bg-amber-500 text-white">
                                <Crown className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          {classroom.description && (
                            <p className="text-stone-600">{classroom.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            <Badge variant="outline" className="border-2 border-stone-300 font-semibold">
                              <Users className="w-3 h-3 mr-1" />
                              {classroom.memberCount} Mitglieder
                            </Badge>
                            <Badge variant="outline" className="border-2 border-green-500 text-green-700 bg-green-50 font-semibold">
                              Code: {classroom.code}
                            </Badge>
                          </div>
                        </div>
                        {classroom.isAdmin && (
                          <Dialog open={showCreateQuestDialog && selectedClassroom?.id === classroom.id} onOpenChange={(open) => {
                            setShowCreateQuestDialog(open);
                            if (open) setSelectedClassroom(classroom);
                          }}>
                            <DialogTrigger asChild>
                              <Button className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-2" />
                                Aufgabe erstellen
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Aufgabe mit KI erstellen</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label htmlFor="questPrompt">Beschreibe die gewünschte Aufgabe</Label>
                                  <Textarea
                                    id="questPrompt"
                                    placeholder="z.B. 'Erstelle eine Aufgabe, bei der die Schüler 5 verschiedene Laubbäume in ihrer Umgebung finden und fotografieren sollen'"
                                    value={questPrompt}
                                    onChange={(e) => setQuestPrompt(e.target.value)}
                                    className="h-32"
                                  />
                                  <p className="text-sm text-stone-500 mt-2">
                                    💡 Die KI erstellt automatisch eine passende Aufgabe mit Titel, Beschreibung und XP-Belohnung
                                  </p>
                                </div>
                                <Button
                                  onClick={handleGenerateQuest}
                                  disabled={!questPrompt || generatingQuest}
                                  className="w-full bg-green-600 hover:bg-green-700"
                                >
                                  {generatingQuest ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Aufgabe wird erstellt...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Mit KI erstellen
                                    </>
                                  )}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <Tabs defaultValue="members">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                          <TabsTrigger value="members">Mitglieder</TabsTrigger>
                          <TabsTrigger value="quests">
                            Aufgaben ({classroomQuestsFiltered.length})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="members" className="space-y-4">
                          {memberStats.map((member, idx) => (
                            <motion.div
                              key={member.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                            >
                              <Card className="border border-stone-200">
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-4">
                                    <div className="relative">
                                      <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center overflow-hidden">
                                        {member.avatar_url ? (
                                          <img src={member.avatar_url} alt={member.member_name} className="w-full h-full object-cover" />
                                        ) : (
                                          <Leaf className="w-6 h-6 text-white" />
                                        )}
                                      </div>
                                      {idx < 3 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white">
                                          <span className="text-white font-bold text-xs">{idx + 1}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-stone-900">{member.member_name}</h4>
                                        <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                                          Level {member.level}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-sm text-stone-600">
                                        <span className="flex items-center gap-1">
                                          <BookOpen className="w-3 h-3" />
                                          {member.discoveredGenera} Gattungen
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Leaf className="w-3 h-3" />
                                          {member.discoveredPlants} Arten
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Trophy className="w-3 h-3" />
                                          {member.xp} XP
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </TabsContent>

                        <TabsContent value="quests" className="space-y-4">
                          {classroomQuestsFiltered.length === 0 ? (
                            <Card className="border-2 border-stone-200">
                              <CardContent className="p-12 text-center">
                                <Target className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-stone-900 mb-2">
                                  Noch keine Aufgaben
                                </h3>
                                <p className="text-stone-600">
                                  {classroom.isAdmin ? "Erstelle die erste Aufgabe für deine Klasse!" : "Der Lehrer hat noch keine Aufgaben erstellt."}
                                </p>
                              </CardContent>
                            </Card>
                          ) : (
                            classroomQuestsFiltered.map((quest, idx) => {
                              const progress = calculateQuestProgress(quest);
                              const isCompletedByCriteria = progress >= (quest.required_discoveries || 0);
                              const isAlreadyClaimed = myUserQuests.some(uq => uq.quest_id === quest.id && uq.completed);
                              const showClaimButton = isCompletedByCriteria && !isAlreadyClaimed;

                              const progressPercentage = (quest.required_discoveries > 0) 
                                ? (progress / quest.required_discoveries) * 100 
                                : 0;
                              const displayProgressPercentage = isNaN(progressPercentage) ? 0 : Math.min(100, progressPercentage);

                              return (
                                <motion.div
                                  key={quest.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                >
                                  <Card className={`border-2 ${isAlreadyClaimed ? 'border-green-400 opacity-70' : 'border-stone-200 hover:border-green-300 hover:shadow-lg'} transition-all`}>
                                    <CardHeader>
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <CardTitle className="text-xl mb-2">{quest.title}</CardTitle>
                                          <p className="text-stone-600 mb-3">{quest.description}</p>
                                          <div className="flex flex-wrap gap-2">
                                            {quest.category && (
                                              <Badge variant="outline" className="border-2 border-stone-300">
                                                {quest.category}
                                              </Badge>
                                            )}
                                            {quest.deadline && (
                                              <Badge variant="outline" className="border-2 border-red-300 text-red-700">
                                                Frist: {new Date(quest.deadline).toLocaleDateString('de-DE')}
                                              </Badge>
                                            )}
                                            {isAlreadyClaimed && ( 
                                              <Badge className="bg-lime-600 text-white">
                                                <Trophy className="w-3 h-3 mr-1" />
                                                Abgeschlossen
                                              </Badge>
                                            )}
                                            {isCompletedByCriteria && !isAlreadyClaimed && (
                                              <Badge className="bg-green-600 text-white">
                                                <Sparkles className="w-3 h-3 mr-1" />
                                                Bereit zum Abschließen!
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg ml-4">
                                          <span className="text-white font-bold text-sm">+{quest.xp_reward}</span>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="bg-green-50 rounded-lg p-3 border border-green-200 mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-sm font-semibold text-stone-700">
                                            🎯 {quest.requirement}
                                          </p>
                                          <span className="text-sm font-bold text-green-700">
                                            {progress} / {quest.required_discoveries || 0}
                                          </span>
                                        </div>
                                        <Progress value={displayProgressPercentage} className="h-2 bg-stone-200" />
                                      </div>

                                      {showClaimButton && (
                                        <Button
                                          onClick={() => completeClassroomQuestMutation.mutate({ 
                                            questId: quest.id,
                                            xpReward: quest.xp_reward 
                                          })}
                                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                                          disabled={completeClassroomQuestMutation.isPending}
                                        >
                                          {completeClassroomQuestMutation.isPending ? (
                                            <>
                                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                              Wird abgeschlossen...
                                            </>
                                          ) : (
                                            <>
                                              <Trophy className="w-5 h-5 mr-2" />
                                              Aufgabe abschließen!
                                            </>
                                          )}
                                        </Button>
                                      )}
                                      {!showClaimButton && isAlreadyClaimed && (
                                        <Button
                                          disabled
                                          className="w-full bg-lime-700 cursor-not-allowed text-white font-bold py-3"
                                        >
                                          <Trophy className="w-5 h-5 mr-2" />
                                          Abgeschlossen
                                        </Button>
                                      )}
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              );
                            })
                          )}
                        </TabsContent>
                      </Tabs>
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

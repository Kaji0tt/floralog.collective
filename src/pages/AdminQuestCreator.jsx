import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Target, Calendar, CalendarDays, Trash2, Loader2, 
  TreeDeciduous, Leaf, Flower2, Sparkles, Check, Edit2, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

const categoryOptions = [
  { value: "Alle", label: "Alle Kategorien", icon: Sparkles },
  { value: "Bäume", label: "Bäume", icon: TreeDeciduous },
  { value: "Sträucher", label: "Sträucher", icon: Leaf },
  { value: "Blumen", label: "Blumen", icon: Flower2 },
];

const difficultyOptions = [
  { value: "Leicht", label: "Leicht", color: "bg-green-100 text-green-700" },
  { value: "Mittel", label: "Mittel", color: "bg-amber-100 text-amber-700" },
  { value: "Schwer", label: "Schwer", color: "bg-red-100 text-red-700" },
];

export default function AdminQuestCreator() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("quest");
  const [editingQuest, setEditingQuest] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.log("User not authenticated");
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);
  
  // Form States
  const [formData, setFormData] = useState({
    quest_number: "",
    title: "",
    description: "",
    requirement: "",
    reward: "",
    category: "Alle",
    difficulty: "Leicht",
    required_discoveries: 1,
    prerequisite_quest_number: "",
    target_genus_name: "",
    target_species_name: "",
    targets: [],
    targets_operator: "UND",
    target_plants: [],
    xp_reward: 50,
    icon_emoji: "🗺️",
    is_active: true
  });

  // Fetch existing quests
  const { data: quests = [], isLoading: questsLoading } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.list(),
  });

  const { data: monthlyQuests = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthlyQuests'],
    queryFn: () => base44.entities.MonthlyQuest.list(),
  });

  const { data: weeklyQuests = [], isLoading: weeklyLoading } = useQuery({
    queryKey: ['weeklyQuests'],
    queryFn: () => base44.entities.WeeklyQuest.list(),
  });

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => base44.entities.Plant.list(),
  });

  const { data: collectionQuests = [] } = useQuery({
    queryKey: ['collectionQuests'],
    queryFn: () => base44.entities.CollectionQuest.list(),
  });

  // Mutations
  const createQuestMutation = useMutation({
    mutationFn: async (data) => {
      const entityName = activeTab === "quest" ? "Quest" : activeTab === "monthly" ? "MonthlyQuest" : activeTab === "weekly" ? "WeeklyQuest" : "CollectionQuest";
      return base44.entities[entityName].create(data);
    },
    onSuccess: () => {
      const queryKey = activeTab === "quest" ? 'quests' : activeTab === "monthly" ? 'monthlyQuests' : activeTab === "weekly" ? 'weeklyQuests' : 'collectionQuests';
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      resetForm();
    },
  });

  const updateQuestMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const entityName = activeTab === "quest" ? "Quest" : activeTab === "monthly" ? "MonthlyQuest" : activeTab === "weekly" ? "WeeklyQuest" : "CollectionQuest";
      return base44.entities[entityName].update(id, data);
    },
    onSuccess: () => {
      const queryKey = activeTab === "quest" ? 'quests' : activeTab === "monthly" ? 'monthlyQuests' : activeTab === "weekly" ? 'weeklyQuests' : 'collectionQuests';
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      resetForm();
      setEditingQuest(null);
    },
  });

  const deleteQuestMutation = useMutation({
    mutationFn: async (id) => {
      const entityName = activeTab === "quest" ? "Quest" : activeTab === "monthly" ? "MonthlyQuest" : activeTab === "weekly" ? "WeeklyQuest" : "CollectionQuest";
      return base44.entities[entityName].delete(id);
    },
    onSuccess: () => {
      const queryKey = activeTab === "quest" ? 'quests' : activeTab === "monthly" ? 'monthlyQuests' : activeTab === "weekly" ? 'weeklyQuests' : 'collectionQuests';
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const resetForm = () => {
    setFormData({
      quest_number: "",
      title: "",
      description: "",
      requirement: "",
      reward: "",
      category: "Alle",
      difficulty: "Leicht",
      required_discoveries: 1,
      prerequisite_quest_number: "",
      target_genus_name: "",
      target_species_name: "",
      targets: [],
      targets_operator: "UND",
      target_plants: [],
      xp_reward: 50,
      icon_emoji: "🗺️",
      is_active: true
    });
    setEditingQuest(null);
  };

  const handleEdit = (quest) => {
    setEditingQuest(quest);
    setFormData({
      quest_number: quest.quest_number || "",
      title: quest.title || "",
      description: quest.description || "",
      requirement: quest.requirement || "",
      reward: quest.reward || "",
      category: quest.category || "Alle",
      difficulty: quest.difficulty || "Leicht",
      required_discoveries: quest.required_discoveries || 1,
      prerequisite_quest_number: quest.prerequisite_quest_number || "",
      target_genus_name: quest.target_genus_name || "",
      target_species_name: quest.target_species_name || "",
      targets: quest.targets || [],
      targets_operator: quest.targets_operator || "UND",
      target_plants: quest.target_plants || [],
      xp_reward: quest.xp_reward || 50,
      icon_emoji: quest.icon_emoji || "🗺️",
      is_active: quest.is_active !== undefined ? quest.is_active : true
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (activeTab === "collection") {
      const collectionData = {
        title: formData.title,
        description: formData.description,
        target_plants: formData.target_plants,
        xp_reward: parseInt(formData.xp_reward),
        icon_emoji: formData.icon_emoji,
        difficulty: formData.difficulty,
        is_active: formData.is_active
      };

      if (editingQuest) {
        updateQuestMutation.mutate({ id: editingQuest.id, data: collectionData });
      } else {
        createQuestMutation.mutate(collectionData);
      }
      return;
    }

    const questData = {
      quest_number: parseInt(formData.quest_number),
      title: formData.title,
      description: formData.description,
      requirement: formData.requirement,
      category: formData.category,
      required_discoveries: parseInt(formData.required_discoveries) || undefined,
    };

    // Add reward if specified
    if (formData.reward) {
      questData.reward = formData.reward;
    }

    // Add fields specific to Quest entity
    if (activeTab === "quest") {
      questData.difficulty = formData.difficulty;
      if (formData.prerequisite_quest_number) {
        questData.prerequisite_quest_number = parseInt(formData.prerequisite_quest_number);
      }
      if (formData.targets && formData.targets.length > 0) {
        questData.targets = formData.targets.map(t => ({
          target_type: t.target_type,
          target_name: t.target_name,
          required_count: parseInt(t.required_count)
        }));
        questData.targets_operator = formData.targets_operator;
      }
    }

    // Add target fields for monthly/weekly
    if (activeTab === "monthly" || activeTab === "weekly") {
      if (formData.target_genus_name) {
        questData.target_genus_name = formData.target_genus_name;
      }
      if (formData.target_species_name) {
        questData.target_species_name = formData.target_species_name;
      }
    }

    if (editingQuest) {
      updateQuestMutation.mutate({ id: editingQuest.id, data: questData });
    } else {
      createQuestMutation.mutate(questData);
    }
  };

  const getCurrentQuests = () => {
    if (activeTab === "quest") return quests.sort((a, b) => (a.quest_number || 0) - (b.quest_number || 0));
    if (activeTab === "monthly") return monthlyQuests.sort((a, b) => (a.quest_number || 0) - (b.quest_number || 0));
    if (activeTab === "weekly") return weeklyQuests.sort((a, b) => (a.quest_number || 0) - (b.quest_number || 0));
    return collectionQuests;
  };

  const getNextQuestNumber = () => {
    const current = getCurrentQuests();
    if (current.length === 0) return 1;
    return Math.max(...current.map(q => q.quest_number || 0)) + 1;
  };

  const dataLoading = questsLoading || monthlyLoading || weeklyLoading;

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <img src={LOGO_URL} alt="PlantDex Logo" className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  // Admin-Check
  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-red-50">
        <div className="text-center p-8">
          <ShieldX className="w-20 h-20 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Zugriff verweigert</h1>
          <p className="text-stone-600">Diese Seite ist nur für Administratoren zugänglich.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Quest Creator</h1>
          <p className="text-stone-600">Erstelle und verwalte Aufgaben für PlantDex</p>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetForm(); }} className="mb-8">
          <TabsList className="bg-white border border-stone-200 p-1 h-auto shadow-sm w-full grid grid-cols-4">
            <TabsTrigger
              value="quest"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-semibold py-3"
            >
              <Target className="w-4 h-4 mr-2" />
              Quests ({quests.length})
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold py-3"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Monatlich ({monthlyQuests.length})
            </TabsTrigger>
            <TabsTrigger
              value="weekly"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold py-3"
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Wöchentlich ({weeklyQuests.length})
            </TabsTrigger>
            <TabsTrigger
              value="collection"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-semibold py-3"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Sammlung
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="border-2 border-stone-200 shadow-lg">
            <CardHeader className="border-b border-stone-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2">
                {editingQuest ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingQuest ? "Quest bearbeiten" : "Neue Quest erstellen"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Quest Number (nicht für Collection) */}
                {activeTab !== "collection" && (
                  <div>
                    <Label>Quest-Nummer *</Label>
                    <Input
                      type="number"
                      value={formData.quest_number}
                      onChange={(e) => setFormData({...formData, quest_number: e.target.value})}
                      placeholder={`z.B. ${getNextQuestNumber()}`}
                      required
                    />
                  </div>
                )}

                {/* Title */}
                <div>
                  <Label>Titel *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="z.B. Baum-Entdecker"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <Label>Beschreibung *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="z.B. Entdecke deine ersten Bäume in der Natur!"
                    rows={2}
                    required
                  />
                </div>

                {/* Requirement (nicht für Collection) */}
                {activeTab !== "collection" && (
                  <>
                    <div>
                      <Label>Anforderung (Anzeige)</Label>
                      <Input
                        value={formData.requirement}
                        onChange={(e) => setFormData({...formData, requirement: e.target.value})}
                        placeholder="z.B. Scanne 3 verschiedene Bäume"
                      />
                    </div>
                    <div>
                      <Label>Belohnung (optional)</Label>
                      <Input
                        value={formData.reward}
                        onChange={(e) => setFormData({...formData, reward: e.target.value})}
                        placeholder="z.B. Titel: Waldläufer oder Hintergrund: Forest"
                      />
                    </div>
                  </>
                )}

                {/* Category & Discoveries */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Kategorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({...formData, category: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="w-4 h-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Benötigte Entdeckungen</Label>
                    <Input
                      type="number"
                      value={formData.required_discoveries}
                      onChange={(e) => setFormData({...formData, required_discoveries: e.target.value})}
                      min={1}
                    />
                  </div>
                </div>

                {/* Quest-specific fields */}
                {activeTab === "quest" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Schwierigkeit</Label>
                        <Select
                          value={formData.difficulty}
                          onValueChange={(v) => setFormData({...formData, difficulty: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {difficultyOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <Badge className={opt.color}>{opt.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Voraussetzung Quest-Nr. (optional)</Label>
                        <Input
                          type="number"
                          value={formData.prerequisite_quest_number}
                          onChange={(e) => setFormData({...formData, prerequisite_quest_number: e.target.value})}
                          placeholder="Leer = keine Voraussetzung"
                        />
                      </div>
                    </div>

                    {/* Ziel Art oder Gattung */}
                    <div className="border-2 border-stone-200 rounded-lg p-4 bg-stone-50">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-bold">Ziel Art oder Gattung?</Label>
                        <div className="flex items-center gap-2">
                          {formData.targets.length > 1 && (
                            <Select
                              value={formData.targets_operator}
                              onValueChange={(v) => setFormData({...formData, targets_operator: v})}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UND">UND</SelectItem>
                                <SelectItem value="ODER">ODER</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                targets: [...formData.targets, { target_type: "genus", target_name: "", required_count: 1 }]
                              });
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Ziel hinzufügen
                          </Button>
                        </div>
                      </div>
                      
                      {formData.targets.length === 0 ? (
                        <p className="text-sm text-stone-500 text-center py-2">
                          Keine spezifischen Ziele - alle Pflanzen der Kategorie zählen
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {formData.targets.map((target, index) => (
                            <div key={index} className="bg-white border border-stone-200 rounded-lg p-3">
                              {index > 0 && (
                                <div className="flex items-center justify-center mb-2">
                                  <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5">
                                    {formData.targets_operator}
                                  </Badge>
                                </div>
                              )}
                              <div className="grid grid-cols-12 gap-2 items-start">
                                <div className="col-span-3">
                                  <Select
                                    value={target.target_type}
                                    onValueChange={(v) => {
                                      const newTargets = [...formData.targets];
                                      newTargets[index].target_type = v;
                                      newTargets[index].target_name = "";
                                      setFormData({...formData, targets: newTargets});
                                    }}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="genus">Gattung</SelectItem>
                                      <SelectItem value="species">Art</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="col-span-5">
                                  <Select
                                    value={target.target_name}
                                    onValueChange={(v) => {
                                      const newTargets = [...formData.targets];
                                      newTargets[index].target_name = v;
                                      setFormData({...formData, targets: newTargets});
                                    }}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {target.target_type === "genus" ? (
                                        genera.map(g => (
                                          <SelectItem key={g.id} value={g.genus_name}>
                                            {g.genus_name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        plants.map(p => (
                                          <SelectItem key={p.id} value={p.species_name}>
                                            {p.species_name}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="col-span-3">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={target.required_count}
                                    onChange={(e) => {
                                      const newTargets = [...formData.targets];
                                      newTargets[index].required_count = e.target.value;
                                      setFormData({...formData, targets: newTargets});
                                    }}
                                    className="h-9"
                                    placeholder="Anz."
                                  />
                                </div>
                                <div className="col-span-1 flex items-center">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      const newTargets = formData.targets.filter((_, i) => i !== index);
                                      setFormData({...formData, targets: newTargets});
                                    }}
                                    className="h-9 w-9 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Collection specific fields */}
                {activeTab === "collection" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Icon Emoji</Label>
                        <Input
                          value={formData.icon_emoji}
                          onChange={(e) => setFormData({...formData, icon_emoji: e.target.value})}
                          placeholder="🗺️"
                        />
                      </div>
                      <div>
                        <Label>XP Belohnung *</Label>
                        <Input
                          type="number"
                          value={formData.xp_reward}
                          onChange={(e) => setFormData({...formData, xp_reward: e.target.value})}
                          min={1}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Schwierigkeit</Label>
                        <Select
                          value={formData.difficulty}
                          onValueChange={(v) => setFormData({...formData, difficulty: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...difficultyOptions, { value: "Extrem", label: "Extrem", color: "bg-purple-100 text-purple-700" }].map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <Badge className={opt.color}>{opt.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Aktiv</span>
                        </label>
                      </div>
                    </div>

                    <div className="border-2 border-stone-200 rounded-lg p-4 bg-stone-50">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-bold">Zielpflanzen</Label>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const newPlants = [...formData.target_plants, ""];
                            setFormData({...formData, target_plants: newPlants});
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Pflanze hinzufügen
                        </Button>
                      </div>
                      
                      {formData.target_plants.length === 0 ? (
                        <p className="text-sm text-stone-500 text-center py-2">
                          Noch keine Zielpflanzen ausgewählt
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {formData.target_plants.map((plantId, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Select
                                value={plantId}
                                onValueChange={(v) => {
                                  const newPlants = [...formData.target_plants];
                                  newPlants[index] = v;
                                  setFormData({...formData, target_plants: newPlants});
                                }}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Pflanze wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {plants.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.species_name} ({p.scientific_name})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const newPlants = formData.target_plants.filter((_, i) => i !== index);
                                  setFormData({...formData, target_plants: newPlants});
                                }}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Monthly/Weekly specific fields */}
                {(activeTab === "monthly" || activeTab === "weekly") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Ziel-Gattung (optional)</Label>
                      <Select
                        value={formData.target_genus_name || ""}
                        onValueChange={(v) => setFormData({...formData, target_genus_name: v === "null" ? "" : v, target_species_name: ""})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Beliebig" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">Beliebig</SelectItem>
                          {genera.map(g => (
                            <SelectItem key={g.id} value={g.genus_name}>
                              {g.genus_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Ziel-Art (optional)</Label>
                      <Select
                        value={formData.target_species_name || ""}
                        onValueChange={(v) => setFormData({...formData, target_species_name: v === "null" ? "" : v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Beliebig" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">Beliebig</SelectItem>
                          {plants
                            .filter(p => !formData.target_genus_name || genera.find(g => g.category_dex_number === p.genus_number && g.category === p.genus_category)?.genus_name === formData.target_genus_name)
                            .map(p => (
                              <SelectItem key={p.id} value={p.species_name}>
                                {p.species_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={createQuestMutation.isPending || updateQuestMutation.isPending}
                    className={`flex-1 ${
                      activeTab === "quest" ? "bg-green-600 hover:bg-green-700" : 
                      activeTab === "monthly" ? "bg-amber-600 hover:bg-amber-700" : 
                      activeTab === "weekly" ? "bg-purple-600 hover:bg-purple-700" :
                      "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {(createQuestMutation.isPending || updateQuestMutation.isPending) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : editingQuest ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {editingQuest ? "Speichern" : "Erstellen"}
                  </Button>
                  {editingQuest && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      <X className="w-4 h-4 mr-2" />
                      Abbrechen
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Quest List */}
          <Card className="border-2 border-stone-200 shadow-lg">
            <CardHeader className="border-b border-stone-200">
              <CardTitle className="flex items-center gap-2">
                {activeTab === "quest" && <Target className="w-5 h-5 text-green-600" />}
                {activeTab === "monthly" && <Calendar className="w-5 h-5 text-amber-600" />}
                {activeTab === "weekly" && <CalendarDays className="w-5 h-5 text-purple-600" />}
                {activeTab === "collection" && <Sparkles className="w-5 h-5 text-indigo-600" />}
                {activeTab === "quest" ? "Alle Quests" : activeTab === "monthly" ? "Monatliche Quests" : activeTab === "weekly" ? "Wöchentliche Quests" : "Sammlungen"}
                <Badge variant="outline">{getCurrentQuests().length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 max-h-[600px] overflow-y-auto">
              <AnimatePresence>
                {getCurrentQuests().length === 0 ? (
                  <div className="text-center py-12 text-stone-500">
                    <Target className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                    <p>Noch keine Quests vorhanden</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getCurrentQuests().map((quest, index) => (
                      <motion.div
                        key={quest.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Card className={`border-2 ${editingQuest?.id === quest.id ? "border-green-500 bg-green-50" : "border-stone-200"} hover:border-stone-300 transition-all`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="font-bold">
                                    #{quest.quest_number}
                                  </Badge>
                                  <span className="font-semibold text-stone-900 truncate">
                                    {quest.title}
                                  </span>
                                </div>
                                <p className="text-sm text-stone-600 line-clamp-1 mb-2">
                                  {quest.description}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {quest.category && (
                                    <Badge variant="outline">
                                      {quest.category}
                                    </Badge>
                                  )}
                                  {quest.required_discoveries && (
                                    <Badge variant="outline">
                                      {quest.required_discoveries}x
                                    </Badge>
                                  )}
                                  {quest.difficulty && (
                                    <Badge className={[...difficultyOptions, { value: "Extrem", color: "bg-purple-100 text-purple-700" }].find(d => d.value === quest.difficulty)?.color}>
                                      {quest.difficulty}
                                    </Badge>
                                  )}
                                  {quest.targets && quest.targets.length > 0 && (
                                    <>
                                      <Badge className="bg-blue-100 text-blue-700">
                                        {quest.targets.length} Ziel{quest.targets.length > 1 ? 'e' : ''}
                                      </Badge>
                                      {quest.targets.length > 1 && (
                                        <Badge className="bg-purple-100 text-purple-700">
                                          {quest.targets_operator || 'UND'}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                  {quest.target_plants && quest.target_plants.length > 0 && (
                                    <Badge className="bg-indigo-100 text-indigo-700">
                                      {quest.target_plants.length} Pflanzen
                                    </Badge>
                                  )}
                                  {quest.xp_reward && (
                                    <Badge className="bg-amber-100 text-amber-700">
                                      +{quest.xp_reward} XP
                                    </Badge>
                                  )}
                                  {quest.is_active !== undefined && !quest.is_active && (
                                    <Badge className="bg-stone-400 text-white">
                                      Inaktiv
                                    </Badge>
                                  )}
                                  {quest.reward && (
                                    <Badge className="bg-amber-100 text-amber-700">
                                      🎁 {quest.reward}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEdit(quest)}
                                  className="w-8 h-8"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm(`Quest "${quest.title}" wirklich löschen?`)) {
                                      deleteQuestMutation.mutate(quest.id);
                                    }
                                  }}
                                  disabled={deleteQuestMutation.isPending}
                                  className="w-8 h-8 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { createPageUrl } from "@/utils";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORY_OPTIONS = [
  { value: "leaderboards", label: "Ranglisten" },
  { value: "quests", label: "Aufgaben" },
  { value: "achievements", label: "Erfolge" },
  { value: "collections", label: "Kollektionen" },
  { value: "map", label: "Map" },
  { value: "friends", label: "Freunde" },
  { value: "infrastructure", label: "Infrastruktur" },
  { value: "customization", label: "Anpassungen" },
  { value: "display", label: "Anzeige" },
  { value: "login", label: "Login" },
  { value: "story", label: "Story" },
  { value: "presentation", label: "Darstellung" },
];

const STATUS_OPTIONS = [
  { value: "not_started", label: "Nicht gestartet" },
  { value: "acknowledged", label: "Zur Kenntnis genommen" },
  { value: "planned", label: "Bearbeitung in Aussicht" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "completed", label: "Bearbeitung abgeschlossen" },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: "1 - Low" },
  { value: 2, label: "2 - Niedrig" },
  { value: 3, label: "3 - Mittel" },
  { value: 4, label: "4 - Hoch" },
  { value: 5, label: "5 - Critical" },
];

const normalizedRole = (value) => String(value || "").trim().toLowerCase();
const getCategoryLabel = (value) => CATEGORY_OPTIONS.find((opt) => opt.value === value)?.label || value || "-";
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function ProjectIssueAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [saveMessageById, setSaveMessageById] = useState({});

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoadError(null);
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser && normalizedRole(currentUser?.role) !== "admin") {
          setTimeout(() => navigate(createPageUrl("Home")), 400);
        }
      } catch (error) {
        console.error("[ProjectIssueAdmin] Error loading user:", error);
        setLoadError("Fehler beim Laden des Profils");
      }
    };

    loadUser();
  }, [navigate]);

  const issuesQuery = useQuery({
    queryKey: ["projectIssues", "admin"],
    enabled: normalizedRole(user?.role) === "admin",
    queryFn: async () => {
      const items = await Query.ProjectIssue.list("-created_at");
      return items || [];
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ issueId, payload }) => {
      const updated = await Query.ProjectIssue.update(issueId, {
        ...payload,
        last_updated_by: user?.id || null,
      });
      return updated;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projectIssues", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["projectIssues", "mine"] });
      setSaveMessageById((prev) => ({ ...prev, [variables.issueId]: "Gespeichert" }));
      window.setTimeout(() => {
        setSaveMessageById((prev) => ({ ...prev, [variables.issueId]: "" }));
      }, 1800);
    },
  });

  const filteredIssues = useMemo(() => {
    const allIssues = Array.isArray(issuesQuery.data) ? issuesQuery.data : [];

    return allIssues.filter((issue) => {
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && Number(issue.priority) !== Number(priorityFilter)) return false;

      const search = searchText.trim().toLowerCase();
      if (!search) return true;

      const haystack = [
        issue.title,
        issue.description,
        issue.reporter_display_name,
        issue.reporter_email,
        issue.iteration_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [issuesQuery.data, statusFilter, categoryFilter, priorityFilter, searchText]);

  const updateDraft = (issue, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [issue.id]: {
        category: issue.category,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: Number(issue.priority || 1),
        iteration_code: issue.iteration_code || "",
        target_date: issue.target_date || "",
        admin_note: issue.admin_note || "",
        ...(prev[issue.id] || {}),
        ...patch,
      },
    }));
  };

  const getDraft = (issue) => {
    const draft = drafts[issue.id];
    if (draft) return draft;

    return {
      category: issue.category,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: Number(issue.priority || 1),
      iteration_code: issue.iteration_code || "",
      target_date: issue.target_date || "",
      admin_note: issue.admin_note || "",
    };
  };

  const handleSaveIssue = (issue) => {
    const draft = getDraft(issue);
    updateIssueMutation.mutate({
      issueId: issue.id,
      payload: {
        category: draft.category,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: Number(draft.priority),
        iteration_code: draft.iteration_code || null,
        target_date: draft.target_date || null,
        admin_note: draft.admin_note || null,
        closed_at: draft.status === "completed" ? new Date().toISOString() : null,
      },
    });
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 flex items-center justify-center">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-stone-700">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
          <p className="text-stone-600">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (normalizedRole(user?.role) !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 flex items-center justify-center">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-stone-700">Du hast keine Berechtigung fuer diese Seite.</p>
          <Button className="mt-4" onClick={() => navigate(createPageUrl("Home"))}>Zur Home-Seite</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />

      <div className="max-w-6xl mx-auto space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 flex items-center justify-center gap-2">
            <ShieldCheck className="w-8 h-8 text-green-700" />
            Projekt-Issues Admin
          </h1>
          <p className="text-stone-600 mt-2">
            Moderation, Priorisierung und Iterationsplanung der User-Meldungen.
          </p>
        </div>

        <Card className="border border-stone-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Filter</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Suche nach Titel, Beschreibung, Reporter..."
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Stati</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger><SelectValue placeholder="Prioritaet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritaeten</SelectItem>
                {PRIORITY_OPTIONS.map((priority) => (
                  <SelectItem key={priority.value} value={String(priority.value)}>{priority.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {issuesQuery.isLoading ? (
          <Card className="border border-stone-200 bg-white">
            <CardContent className="py-8 flex items-center justify-center gap-2 text-stone-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Issues werden geladen...
            </CardContent>
          </Card>
        ) : null}

        {!issuesQuery.isLoading && filteredIssues.length === 0 ? (
          <Card className="border border-stone-200 bg-white">
            <CardContent className="py-8 text-center text-stone-600">
              Keine Issues fuer die aktuellen Filter gefunden.
            </CardContent>
          </Card>
        ) : null}

        {!issuesQuery.isLoading && filteredIssues.map((issue) => {
          const draft = getDraft(issue);
          const isSavingThisIssue = updateIssueMutation.isPending && updateIssueMutation.variables?.issueId === issue.id;

          return (
            <Card key={issue.id} className="border border-stone-200 bg-white">
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-500">
                      {issue.reporter_display_name || "Unbekannt"} • {issue.reporter_email || "-"} • {formatDate(issue.created_at)}
                    </p>
                    <p className="text-sm text-stone-500">Kategorie: {getCategoryLabel(issue.category)}</p>
                  </div>
                  <div className="text-xs text-stone-500">ID: {issue.id}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select value={draft.category} onValueChange={(value) => updateDraft(issue, { category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((category) => (
                        <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={draft.status} onValueChange={(value) => updateDraft(issue, { status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={String(draft.priority)} onValueChange={(value) => updateDraft(issue, { priority: Number(value) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority.value} value={String(priority.value)}>{priority.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Input
                  value={draft.title}
                  onChange={(event) => updateDraft(issue, { title: event.target.value })}
                  placeholder="Titel"
                />

                <Textarea
                  value={draft.description}
                  onChange={(event) => updateDraft(issue, { description: event.target.value })}
                  className="min-h-[120px]"
                  placeholder="Beschreibung"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={draft.iteration_code}
                    onChange={(event) => updateDraft(issue, { iteration_code: event.target.value })}
                    placeholder="Iterationscode, z. B. Sommer26-1.1"
                  />
                  <Input
                    type="date"
                    value={draft.target_date || ""}
                    onChange={(event) => updateDraft(issue, { target_date: event.target.value })}
                  />
                </div>

                <Textarea
                  value={draft.admin_note}
                  onChange={(event) => updateDraft(issue, { admin_note: event.target.value })}
                  className="min-h-[80px]"
                  placeholder="Interne Admin-Notiz"
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-stone-500">
                    {saveMessageById[issue.id] ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {saveMessageById[issue.id]}
                      </span>
                    ) : ""}
                  </p>
                  <Button onClick={() => handleSaveIssue(issue)} disabled={isSavingThisIssue}>
                    {isSavingThisIssue ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Speichert...</span>
                    ) : (
                      "Issue speichern"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

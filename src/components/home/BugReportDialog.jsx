import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, Bug, CheckCircle2, Loader2, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Query } from "@/api/entities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUiTheme } from "@/lib/UiThemeContext";

const ISSUE_CATEGORY_OPTIONS = [
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

const ISSUE_STATUS_LABELS = {
  not_started: "Nicht gestartet",
  acknowledged: "Zur Kenntnis genommen",
  planned: "Bearbeitung in Aussicht",
  in_progress: "In Bearbeitung",
  completed: "Bearbeitung abgeschlossen",
};

const resolveStatusLabel = (status) => ISSUE_STATUS_LABELS[status] || "Nicht gestartet";

const resolveCategoryLabel = (category) => {
  const found = ISSUE_CATEGORY_OPTIONS.find((item) => item.value === category);
  return found?.label || category || "Unbekannt";
};

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

export default function BugReportDialog({ open, onOpenChange, user, displayName }) {
  const queryClient = useQueryClient();
  const { isLightUi } = useUiTheme();
  const location = useLocation();
  const [reporterName, setReporterName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [category, setCategory] = useState(ISSUE_CATEGORY_OPTIONS[0].value);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const ownIssuesQuery = useQuery({
    queryKey: ["projectIssues", "mine", user?.id],
    enabled: Boolean(open && user?.id),
    queryFn: async () => {
      const records = await Query.ProjectIssue.filter({ reporter_auth_id: user.id });
      return [...records].sort((a, b) => {
        const aDate = new Date(a?.created_at || 0).getTime();
        const bDate = new Date(b?.created_at || 0).getTime();
        return bDate - aDate;
      });
    },
  });

  const submitIssueMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("Bitte melde dich an, bevor du eine Meldung erstellst.");
      }

      const createdIssue = await Query.ProjectIssue.create({
        reporter_auth_id: user.id,
        reporter_display_name: reporterName.trim() || displayName || user?.email || "Floralog User",
        reporter_email: contactEmail.trim(),
        category,
        title: title.trim(),
        description: details.trim(),
        source: "home-header-bug-report",
        source_path: location.pathname || "/Home",
      });

      // Optionaler Mail-Hook bleibt als sekundaeres Signal bestehen.
      try {
        await supabase.functions.invoke("sendFeedbackEmail", {
          body: {
            name: reporterName.trim() || displayName || user?.email || "Floralog User",
            email: contactEmail.trim(),
            message: [
              `Kategorie: ${resolveCategoryLabel(category)}`,
              `Titel: ${title.trim()}`,
              "",
              details.trim(),
              "",
              `Quelle: ${location.pathname || "/Home"}`,
            ].join("\n"),
            reportType: "project-issue",
            subjectSuffix: title.trim(),
            source: "home-header-bug-report-db",
          },
        });
      } catch (mailError) {
        console.warn("[BugReportDialog] Optional sendFeedbackEmail hook failed", mailError);
      }

      return createdIssue;
    },
    onSuccess: async () => {
      setSent(true);
      setTitle("");
      setDetails("");
      await queryClient.invalidateQueries({ queryKey: ["projectIssues", "mine", user?.id] });
    },
    onError: (mutationError) => {
      setError(mutationError?.message || "Die Meldung konnte nicht gespeichert werden.");
    },
  });

  useEffect(() => {
    if (!open) return;

    setReporterName(displayName || user?.display_name || user?.full_name || "");
    setContactEmail(user?.email || "");
    setCategory(ISSUE_CATEGORY_OPTIONS[0].value);
    setTitle("");
    setDetails("");
    setSent(false);
    setError("");
  }, [displayName, open, user?.display_name, user?.email, user?.full_name]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!contactEmail.trim() || !title.trim() || !details.trim()) {
      setError("Bitte fuelle Kategorie, Titel, E-Mail und Beschreibung aus.");
      return;
    }

    setError("");
    submitIssueMutation.mutate();
  };

  const surfaceClassName = isLightUi
    ? "border-[#c8ac62]/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(247,244,232,0.98)_100%)] text-stone-800"
    : "border-[#f0e5a5]/25 bg-[linear-gradient(180deg,rgba(18,27,22,0.98)_0%,rgba(11,18,14,0.99)_100%)] text-stone-100";
  const mutedTextClassName = isLightUi ? "text-stone-600" : "text-stone-400";
  const inputClassName = isLightUi
    ? "border-[#c8ac62]/35 bg-white/85 text-stone-800 placeholder:text-stone-400"
    : "border-[#f0e5a5]/20 bg-black/20 text-stone-100 placeholder:text-stone-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto rounded-3xl p-0 ${surfaceClassName}`}>
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div className={`absolute inset-x-0 top-0 h-24 ${isLightUi ? "bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.16),transparent_70%)]" : "bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.12),transparent_70%)]"}`} />
        </div>

        <div className="relative p-6 sm:p-7">
          <DialogHeader className="pr-8 text-left">
            <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${isLightUi ? "border-rose-200 bg-rose-50 text-rose-600" : "border-rose-300/20 bg-rose-500/10 text-rose-200"}`}>
              <Bug className="h-5 w-5" />
            </div>
            <DialogTitle className={isLightUi ? "text-stone-900" : "text-stone-100"}>Task oder Bug melden</DialogTitle>
            <DialogDescription className={mutedTextClassName}>
              Dieses Formular ist die Schnittstelle zwischen User-Feedback und Projektmanagement.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className={`text-base font-semibold ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                Meldung wurde gespeichert.
              </p>
              <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                Dein Eintrag erscheint jetzt im Admin-Reporting.
              </p>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-4 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Schliessen
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                  Kategorie
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className={inputClassName}>
                    <SelectValue placeholder="Kategorie waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                    Name
                  </label>
                  <Input
                    value={reporterName}
                    onChange={(event) => setReporterName(event.target.value)}
                    placeholder="Dein Anzeigename"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                    Rueckfrage-E-Mail
                  </label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="name@beispiel.de"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                  Kurztitel
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="z. B. Rangliste laedt nicht"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                  Beschreibung
                </label>
                <Textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Beschreibe Problem oder Idee moeglichst konkret."
                  className={`min-h-[240px] resize-y ${inputClassName}`}
                />
              </div>

              {error ? (
                <div className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${isLightUi ? "border-red-200 bg-red-50 text-red-700" : "border-red-400/20 bg-red-500/10 text-red-200"}`}>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitIssueMutation.isPending}
                  className={`rounded-xl ${isLightUi ? "border-stone-300 bg-white/70 text-stone-700 hover:bg-stone-100" : "border-[#f0e5a5]/20 bg-white/5 text-stone-200 hover:bg-white/10"}`}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={submitIssueMutation.isPending}
                  className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                >
                  {submitIssueMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Meldung erfassen
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t pt-5 border-stone-400/20">
            <h3 className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
              Meine Meldungen
            </h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>
              Hier siehst du den aktuellen Bearbeitungsstatus deiner letzten Eintraege.
            </p>

            {ownIssuesQuery.isLoading ? (
              <div className={`mt-3 flex items-center gap-2 text-sm ${mutedTextClassName}`}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Meldungen werden geladen...
              </div>
            ) : null}

            {!ownIssuesQuery.isLoading && Array.isArray(ownIssuesQuery.data) && ownIssuesQuery.data.length === 0 ? (
              <p className={`mt-3 text-sm ${mutedTextClassName}`}>Noch keine Meldungen vorhanden.</p>
            ) : null}

            {!ownIssuesQuery.isLoading && Array.isArray(ownIssuesQuery.data) && ownIssuesQuery.data.length > 0 ? (
              <div className="mt-3 space-y-2">
                {ownIssuesQuery.data.slice(0, 6).map((issue) => (
                  <div
                    key={issue.id}
                    className={`rounded-xl border px-3 py-2 ${isLightUi ? "border-stone-300/60 bg-white/70" : "border-[#f0e5a5]/20 bg-white/5"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm font-medium truncate ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{issue.title}</p>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${isLightUi ? "bg-stone-200 text-stone-700" : "bg-stone-700/60 text-stone-100"}`}>
                        {resolveStatusLabel(issue.status)}
                      </span>
                    </div>
                    <div className={`mt-1 flex items-center gap-2 text-xs ${mutedTextClassName}`}>
                      <span>{resolveCategoryLabel(issue.category)}</span>
                      <span>•</span>
                      <span>{formatDate(issue.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
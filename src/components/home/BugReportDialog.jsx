import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, Bug, CheckCircle2, Loader2, Send } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUiTheme } from "@/lib/UiThemeContext";

const createBugTemplate = ({ email, pathname }) => {
  const browserInfo = typeof navigator !== "undefined" ? navigator.userAgent : "unbekannt";

  return [
    "1. Was ist passiert?",
    "- ",
    "",
    "2. Was haette passieren sollen?",
    "- ",
    "",
    "3. Schritte zum Reproduzieren:",
    "1. ",
    "2. ",
    "3. ",
    "",
    "4. Zusatzinfos:",
    `- Seite: ${pathname || "/Home"}`,
    `- Account: ${email || "nicht verfuegbar"}`,
    `- Geraet/Browser: ${browserInfo}`,
  ].join("\n");
};

export default function BugReportDialog({ open, onOpenChange, user, displayName }) {
  const { isLightUi } = useUiTheme();
  const location = useLocation();
  const [reporterName, setReporterName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const template = useMemo(
    () => createBugTemplate({ email: user?.email, pathname: location.pathname }),
    [location.pathname, user?.email],
  );

  useEffect(() => {
    if (!open) return;

    setReporterName(displayName || user?.display_name || user?.full_name || "");
    setContactEmail(user?.email || "");
    setSubject("");
    setDetails(template);
    setSending(false);
    setSent(false);
    setError("");
  }, [displayName, open, template, user?.display_name, user?.email, user?.full_name]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!contactEmail.trim() || !subject.trim() || !details.trim()) {
      setError("Bitte fuelle Titel, E-Mail und Beschreibung aus.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const { error: sendError } = await supabase.functions.invoke("sendFeedbackEmail", {
        body: {
          name: reporterName.trim() || displayName || user?.email || "Floralog User",
          email: contactEmail.trim(),
          message: details.trim(),
          reportType: "bug",
          subjectSuffix: subject.trim(),
          source: "home-header-bug-report",
        },
      });

      if (sendError) {
        throw sendError;
      }

      setSent(true);
    } catch {
      setError("Der Bug-Report konnte nicht gesendet werden. Bitte versuche es erneut.");
    } finally {
      setSending(false);
    }
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
            <DialogTitle className={isLightUi ? "text-stone-900" : "text-stone-100"}>Bug melden</DialogTitle>
            <DialogDescription className={mutedTextClassName}>
              Beschreibe den Fehler moeglichst konkret. Die Maske ist bereits vorbereitet, damit der Report schneller bearbeitet werden kann.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className={`text-base font-semibold ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                Report wurde gesendet.
              </p>
              <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                Der Bug-Report wurde an info@floralog.de uebermittelt.
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
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="z. B. Home friert nach dem Oeffnen der Karte ein"
                  className={inputClassName}
                />
                <p className={`text-xs ${mutedTextClassName}`}>
                  Der Betreff wird automatisch mit [Bug-Report] versehen.
                </p>
              </div>

              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isLightUi ? "text-stone-700" : "text-stone-200"}`}>
                  Fehlerbeschreibung
                </label>
                <Textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
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
                  disabled={sending}
                  className={`rounded-xl ${isLightUi ? "border-stone-300 bg-white/70 text-stone-700 hover:bg-stone-100" : "border-[#f0e5a5]/20 bg-white/5 text-stone-200 hover:bg-white/10"}`}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={sending}
                  className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Senden
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React from "react";
import { FileText, Mail, ShieldAlert, Lock, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useUiTheme } from "@/lib/UiThemeContext";

/** Shared legal-imprint dialog, reused by Settings and the Home hero side nav. */
export default function ImpressumDialog({ open, onOpenChange }) {
  const { isLightUi } = useUiTheme();
  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col p-0 overflow-hidden border shadow-2xl ${
          isLightUi
            ? "bg-stone-50/95 text-stone-800 border-[#c8ac62]/40"
            : "bg-[#121814] text-stone-100 border-[#f0e5a5]/30"
        }`}
      >
        {/* Fixed Modal Header */}
        <div
          className={`p-4 sm:p-5 border-b shrink-0 flex items-center justify-between gap-3 ${
            isLightUi
              ? "bg-white/80 border-stone-200"
              : "bg-[#18211b]/80 border-[#f0e5a5]/20"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isLightUi
                  ? "bg-amber-100 text-amber-800"
                  : "bg-amber-500/15 text-amber-300 border border-amber-400/30"
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className={`text-base sm:text-lg font-bold truncate ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                Impressum
              </DialogTitle>
              <DialogDescription
                className={`text-xs truncate ${
                  isLightUi ? "text-stone-500" : "text-stone-400"
                }`}
              >
                Rechtliche Informationen und Betreiberangaben
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
          {/* Betreiber Card */}
          <Card
            className={`border transition-all ${
              isLightUi
                ? "bg-white/90 border-stone-200/90 shadow-sm"
                : "bg-[#18211b]/70 border-[#f0e5a5]/20"
            }`}
          >
            <CardContent className="p-4 space-y-2">
              <h3
                className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Angaben gemäß § 5 TMG & Betreiber
              </h3>
              <div
                className={`text-xs sm:text-sm leading-relaxed ${
                  isLightUi ? "text-stone-700" : "text-stone-300/90"
                }`}
              >
                <p className="font-semibold">Floralog Collective</p>
                <p>Dorotheenstr. 41</p>
                <p>24939 Flensburg</p>
                <p className="mt-2 text-xs italic">
                  Eigentümer: Jascha Kruse
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Kontakt & Vertretung Card */}
          <Card
            className={`border transition-all ${
              isLightUi
                ? "bg-white/90 border-stone-200/90 shadow-sm"
                : "bg-[#18211b]/70 border-[#f0e5a5]/20"
            }`}
          >
            <CardContent className="p-4 space-y-2">
              <h3
                className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Kontakt & Verantwortlich
              </h3>
              <div
                className={`text-xs sm:text-sm leading-relaxed space-y-2 ${
                  isLightUi ? "text-stone-700" : "text-stone-300/90"
                }`}
              >
                <p>
                  <span className="font-semibold block">E-Mail:</span>
                  <a
                    href="mailto:info@floralog.de"
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    info@floralog.de
                  </a>
                </p>
                <div className="pt-2 border-t border-current border-opacity-10">
                  <p className="font-semibold text-xs mb-1">
                    Verantwortlich i.S.d. § 18 Abs. 2 MStV:
                  </p>
                  <p className="text-xs">
                    Floralog Collective, Dorotheenstr. 41, 24939 Flensburg
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Vertreten durch: Jascha Kruse
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Haftungsausschluss Card */}
          <Card
            className={`border transition-all ${
              isLightUi
                ? "bg-white/90 border-stone-200/90 shadow-sm"
                : "bg-[#18211b]/70 border-[#f0e5a5]/20"
            }`}
          >
            <CardContent className="p-4 space-y-2">
              <h3
                className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                Haftungsausschluss
              </h3>
              <p
                className={`text-xs sm:text-sm leading-relaxed ${
                  isLightUi ? "text-stone-700" : "text-stone-300/90"
                }`}
              >
                Die Inhalte dieser App wurden mit größter Sorgfalt erstellt. Für
                die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
                können wir jedoch keine Gewähr übernehmen. Floralog dient
                ausschließlich zu Bildungszwecken und ersetzt keine
                professionelle botanische Beratung.
              </p>
            </CardContent>
          </Card>

          {/* Datenschutz Card */}
          <Card
            className={`border transition-all ${
              isLightUi
                ? "bg-white/90 border-stone-200/90 shadow-sm"
                : "bg-[#18211b]/70 border-[#f0e5a5]/20"
            }`}
          >
            <CardContent className="p-4 space-y-3">
              <h3
                className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                Datenschutz
              </h3>
              <p
                className={`text-xs sm:text-sm leading-relaxed ${
                  isLightUi ? "text-stone-700" : "text-stone-300/90"
                }`}
              >
                Der Schutz Ihrer persönlichen Daten ist uns wichtig.
                Ausführliche Informationen zur Verarbeitung Ihrer Daten finden
                Sie in unserer{" "}
                <button
                  type="button"
                  onClick={() => (window.location.href = "/Datenschutz")}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-flex items-center gap-0.5"
                >
                  Datenschutzerklärung <ExternalLink className="w-3 h-3" />
                </button>
                .
              </p>

              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
                  isLightUi
                    ? "bg-blue-50/80 border-blue-200 text-stone-700"
                    : "bg-blue-950/30 border-blue-500/30 text-stone-300"
                }`}
              >
                <p className="font-semibold mb-1">In Kürze:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Gespeicherte Daten: E-Mail-Adresse, Anzeigename, Scans und
                    Standortdaten (optional)
                  </li>
                  <li>
                    Backend: Supabase (Auftragsverarbeiter, Server in
                    Frankfurt/EU)
                  </li>
                  <li>Frontend: Cloudflare (CDN zur Inhaltsauslieferung)</li>
                  <li>Pflanzenerkennung: Pl@ntNet & ChatGPT von OpenAI</li>
                  <li>Keine dateneigene Speicherung auf unseren Servern</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <p
            className={`text-center text-xs pt-2 italic ${
              isLightUi ? "text-stone-400" : "text-stone-500"
            }`}
          >
            © Floralog Collective, {currentYear}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

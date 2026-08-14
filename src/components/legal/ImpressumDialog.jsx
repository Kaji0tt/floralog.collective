import { FileText, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUiTheme } from "@/lib/UiThemeContext";

/** Shared legal-imprint dialog, reused by Settings and the Home hero side nav. */
export default function ImpressumDialog({ open, onOpenChange }) {
  const { isLightUi } = useUiTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-3xl max-h-[80vh] overflow-y-auto border ${
          isLightUi ? "bg-white text-stone-800 border-[#c8ac62]/40" : "bg-[#121b16] border-[#f0e5a5]/35 text-stone-100"
        }`}
      >
        <DialogHeader>
          <DialogTitle className={isLightUi ? "text-stone-800" : "text-stone-100"}>Impressum</DialogTitle>
        </DialogHeader>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              Angaben gemäß § 5 TMG
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-2">Betreiber</h3>
              <p className="text-stone-700">
                Floralog Collective<br />
                Dorotheenstr. 41<br />
                24939 Flensburg<br />
                <br />
                Eigentümer: Jascha Kruse
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-600" />
                Kontakt
              </h3>
              <p className="text-stone-700">
                E-Mail: <br />
                info@floralog.de<br />
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-2">Verantwortlich i.S.d. § 18 Abs. 2 MStV</h3>
              <p className="text-stone-700">
                Floralog Collective<br />
                Dorotheenstr. 41<br />
                24939 Flensburg<br />
                <br />
                Vertreten durch: Jascha Kruse
              </p>
            </div>

            <div className="pt-4 border-t border-stone-200">
              <h3 className="font-bold text-lg text-stone-900 mb-2">Haftungsausschluss</h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Die Inhalte dieser App wurden mit größter Sorgfalt erstellt.
                Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
                Floralog dient ausschließlich zu Bildungszwecken und ersetzt keine professionelle botanische Beratung.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-2">Datenschutz</h3>

              <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
                <p>
                  Der Schutz Ihrer persönlichen Daten ist uns wichtig.
                  Ausführliche Informationen zur Verarbeitung Ihrer Daten finden Sie in unserer
                  <button
                    onClick={() => window.location.href = '/Datenschutz'}
                    className="text-blue-600 hover:underline font-semibold ml-1"
                  >
                    Datenschutzerklärung
                  </button>.
                </p>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="font-semibold text-stone-800 mb-2">In Kürze:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Gespeicherte Daten: E-Mail-Adresse, Anzeigename, Scans und Standortdaten (optional)</li>
                    <li>Backend: Supabase (Auftragsverarbeiter, Server in Frankfurt/EU)</li>
                    <li>Frontend: Cloudflare (CDN zur Inhaltsauslieferung)</li>
                    <li>Pflanzenerkennung: Pl@ntNet und ChatGPT von OpenAI</li>
                    <li>Keine dateneigene Speicherung auf unseren Servern</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-right text-sm text-stone-600 mt-4">© Floralog Collective, {new Date().getFullYear()}</p>
      </DialogContent>
    </Dialog>
  );
}

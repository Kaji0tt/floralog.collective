
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, FileText } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Impressum() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">
            Impressum
          </h1>
        </div>

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
                Jascha Kruse<br />
                Dorotheenstr. 41<br />
                24939, Flensburg
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-600" />
                Kontakt
              </h3>
              <p className="text-stone-700">
                E-Mail: <br />
                jascha.kruse@web.de<br />
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h3>
              <p className="text-stone-700">
                Jascha Kruse<br />
                Dorotheenstr. 41
              </p>
            </div>

            <div className="pt-4 border-t border-stone-200">
              <h3 className="font-bold text-lg text-stone-900 mb-2">Haftungsausschluss</h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Die Inhalte dieser App wurden mit größter Sorgfalt erstellt. 
                Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. 
                PlantDex dient ausschließlich zu Bildungszwecken und ersetzt keine professionelle botanische Beratung.
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
                    <li>Login und Datenspeicherung erfolgen über base44</li>
                    <li>Pflanzenerkennung nutzt Pl@ntNet und interne KI</li>
                    <li>Keine Datenspeicherung auf eigenen Servern</li>
                    <li>Einsehbar: E-Mail, Spielfortschritt, Kontaktformular-Daten</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, FileText } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

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

        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardContent className="p-6">
            <div className="space-y-4 text-stone-700 leading-relaxed">
              <p>
                <strong className="text-stone-900">Floralog</strong> verbindet moderne Technologie mit der Faszination für die Natur. 
                Ziel dieser App ist es, Interessierten die heimische Pflanzenwelt auf spielerische und motivierende Weise näherzubringen. 
                Durch den Einsatz künstlicher Intelligenz und gamifizierte Elemente soll die Entdeckung und das Kennenlernen von Pflanzen zu einem unterhaltsamen und lehrreichen Erlebnis werden.
              </p>

              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                <p className="font-semibold text-amber-900 mb-2">⚠️ Wichtige Hinweise zur KI-gestützten Pflanzenerkennung</p>
                <p className="text-sm text-amber-800">
                  Die Pflanzenerkennung basiert auf künstlicher Intelligenz und kann sich irren – dies geschieht auch regelmäßig. 
                  Insbesondere bei ähnlich aussehenden Pflanzen oder verschiedenen Arten derselben Gattung stößt die KI aktuell an ihre Grenzen. 
                  <strong className="block mt-2">Es gibt keine Garantie für die Richtigkeit der Scan-Ergebnisse.</strong>
                  Dies gilt insbesondere für Einschätzungen zur Giftigkeit oder Essbarkeit von Pflanzen. 
                  Verlassen Sie sich niemals ausschließlich auf die App-Ergebnisse in sicherheitsrelevanten Fragen.
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <p className="font-semibold text-blue-900 mb-2">🚧 Entwicklungsstand</p>
                <p className="text-sm text-blue-800">
                  Floralog befindet sich im Anfangsstadium der Entwicklung. Features, Design und Funktionen können sich noch erheblich ändern. 
                  Die Pflanzenerkennung nutzt die PlantNet-API, deren kostenlose Nutzung derzeit auf 500 Scans pro Tag beschränkt ist. 
                  Bei Erreichen dieses Limits kann es zu Einschränkungen kommen.
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                <p className="font-semibold text-green-900 mb-2">🎮 Philosophie & Fair Play</p>
                <p className="text-sm text-green-800">
                  Floralog ist sich bewusst, dass bei gamifizierten Systemen Möglichkeiten zum "Schummeln" existieren können. 
                  Dies soll jedoch nicht gezielt unterbunden werden. Die sozialen und spielerischen Komponenten dienen ausschließlich der Motivation 
                  und sollen die Entdeckung der Natur begleiten – nicht im Wettbewerb gegeneinander, sondern mit einem <strong>didaktisch-pädagogischen Ansatz</strong>. 
                  Der Fokus liegt auf persönlichem Lernen und Naturerfahrung, nicht auf Konkurrenz.
                </p>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded">
                <p className="font-semibold text-purple-900 mb-2">👶 Altersempfehlung</p>
                <p className="text-sm text-purple-800">
                  Es wird <strong>nicht empfohlen, Kindern unter 14 Jahren unbeaufsichtigt ein Mobiltelefon auszuhändigen</strong>. 
                  Die Nutzung von Floralog wird für Personen ab 14 Jahren empfohlen. 
                  Bei jüngeren Nutzern sollte die App stets unter elterlicher Aufsicht verwendet werden.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    <li>Login und Datenspeicherung erfolgen über base44</li>
                    <li>Pflanzenerkennung nutzt Pl@ntNet</li>
                    <li>Keine Datenspeicherung auf eigenen Servern</li>
                    <li>Einsehbar: E-Mail, Freischaltungen und Errungenschaften, Standortdaten der Scans sofern aktiviert, Kontaktformular-Daten</li>
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
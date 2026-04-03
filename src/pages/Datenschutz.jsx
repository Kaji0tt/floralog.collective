import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, Lock, Eye, Database, ExternalLink } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">
            Datenschutzerklärung
          </h1>
          <p className="text-lg text-stone-600">
            Informationen zur Verarbeitung Ihrer Daten
          </p>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader className="border-b border-stone-200 bg-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Datenschutz in Kürze
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Floralog respektiert Ihre Privatsphäre. Diese Datenschutzerklärung erläutert, 
              welche Daten wir erheben, wie wir sie verwenden und welche Rechte Sie haben. 
              Die App befindet sich noch in der Entwicklung, diese Datenschutzerklärung wird 
              entsprechend aktualisiert.
            </p>
          </CardContent>
        </Card>

        {/* Verantwortlicher */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              1. Verantwortlicher
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 mb-2">
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:
            </p>
            <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
              <p className="text-stone-800 font-semibold">
                Floralog Collective<br />
                Dorotheenstr. 41<br />
                24939 Flensburg<br />
                <br />
                Vertreten durch: Jascha Kruse<br />
                E-Mail: info@floralog.de
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Datenerhebung und Speicherung */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-green-600" />
              2. Welche Daten werden erhoben?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-3">2.1 Authentifizierung und Datenspeicherung</h3>
              <p className="text-stone-700 leading-relaxed mb-3">
                Die Authentifizierung (Login) erfolgt über die Plattform <strong>Supabase</strong>. 
                Sämtliche Nutzerdaten, einschließlich Ihrer Spielfortschritte und hochgeladenen Inhalte, 
                werden ausschließlich auf den Servern von Supabase gespeichert und verarbeitet.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-stone-700 mb-2">
                  <strong>Wichtig:</strong> Floralog selbst speichert keine personenbezogenen Daten auf eigenen Servern. 
                  Die Datenverarbeitung erfolgt durch Supabase als Auftragsverarbeiter.
                </p>
                <p className="text-sm text-stone-700">
                  Weitere Informationen zu Supabase's Datenverarbeitung finden Sie in der{" "}
                  <a 
                    href="https://supabase.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Datenschutzerklärung von Supabase
                  </a>.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-3">2.2 Beim Login erhobene Daten</h3>
              <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4">
                <li>E-Mail-Adresse</li>
                <li>Benutzername</li>
                <li>Profilbild (optional)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-3">2.3 Bei Nutzung der App erhobene Daten</h3>
              <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4">
                <li>Spielfortschritt (Level, XP, entdeckte Pflanzen)</li>
                <li>Hochgeladene Pflanzenfotos</li>
                <li>Standortdaten (optional, nur wenn manuell angegeben)</li>
                <li>Notizen zu Entdeckungen</li>
                <li>Freundschaftsverbindungen</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-3">2.4 Kontaktformular</h3>
              <p className="text-stone-700 leading-relaxed">
                Bei Nutzung des Kontaktformulars werden die von Ihnen eingegebenen Daten 
                (Name, E-Mail-Adresse, Nachricht) ausschließlich zum Zweck der Kontaktaufnahme 
                verwendet und nicht an Dritte weitergegeben.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Externe Dienste */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-6 h-6 text-green-600" />
              3. Externe Dienste und Datenübermittlung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-3">3.1 Pflanzenerkennung mit Pl@ntNet</h3>
              <p className="text-stone-700 leading-relaxed mb-3">
                Zur Identifizierung von Pflanzen nutzt Floralog die externe Analysesoftware <strong>Pl@ntNet</strong> 
                für die ersten 500 Scans pro Tag. Hochgeladene Bilder werden zu diesem Zweck an die Pl@ntNet-API übermittelt.
              </p>
              <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4 mb-3">
                <li>Zweck: Automatische Pflanzenerkennung</li>
                <li>Übermittelte Daten: Pflanzenfotos</li>
                <li>Anbieter: Pl@ntNet (CIRAD, INRIA, INRA, IRD)</li>
                <li>Serverstandort: Frankreich</li>
              </ul>
              <p className="text-sm text-stone-600">
                Weitere Informationen finden Sie in der{" "}
                <a 
                  href="https://www.cirad.fr/en/personal-data-protection" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:underline"
                >
                  Datenschutzerklärung von CIRAD/Pl@ntNet
                </a>.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg text-stone-900 mb-3">3.2 KI-basierte Pflanzenerkennung (LLM)</h3>
              <p className="text-stone-700 leading-relaxed mb-3">
                Nach Überschreitung des Pl@ntNet-Kontingents wird auf eine interne LLM-basierte Methode 
                (Large Language Model) zurückgegriffen. Bilder werden dabei an KI-Dienste übermittelt.
              </p>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-stone-700">
                  <strong>Hinweis:</strong> Die verwendeten KI-Dienste können sich außerhalb der EU befinden. 
                  Wir arbeiten daran, eine vollständige Transparenz über alle verwendeten Dienste zu gewährleisten.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Einsehbare Daten durch Betreiber */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6 text-green-600" />
              4. Einsehbare Daten durch den Betreiber
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed mb-3">
              Der Betreiber (Floralog Collective, vertreten durch Jascha Kruse) hat ausschließlich Zugriff auf folgende Informationen:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4 mb-3">
              <li>E-Mail-Adresse der Nutzenden</li>
              <li>Spielfortschritt (Level, Anzahl entdeckter Pflanzen, XP)</li>
              <li>Im Kontaktformular freiwillig angegebene Daten (Name, E-Mail, Nachricht)</li>
            </ul>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-stone-700">
                <strong>Keine weiteren Daten:</strong> Es werden keine weiteren personenbezogenen Daten 
                (wie Passwörter, detaillierte Nutzungsstatistiken, IP-Adressen) durch den Betreiber 
                gespeichert oder verarbeitet.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rechtsgrundlage */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              5. Rechtsgrundlage der Verarbeitung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed mb-3">
              Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4">
              <li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong> – Vertragserfüllung (Bereitstellung der App-Funktionen)</li>
              <li><strong>Art. 6 Abs. 1 lit. a DSGVO</strong> – Einwilligung (z.B. bei optionalen Standortangaben)</li>
              <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong> – Berechtigtes Interesse (z.B. Verbesserung der App)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Ihre Rechte */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-green-600" />
              6. Ihre Rechte
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed mb-3">
              Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4 mb-4">
              <li><strong>Auskunft</strong> – Sie können Auskunft über Ihre gespeicherten Daten verlangen</li>
              <li><strong>Berichtigung</strong> – Sie können unrichtige Daten berichtigen lassen</li>
              <li><strong>Löschung</strong> – Sie können die Löschung Ihrer Daten verlangen</li>
              <li><strong>Einschränkung</strong> – Sie können die Verarbeitung einschränken lassen</li>
              <li><strong>Datenübertragbarkeit</strong> – Sie können Ihre Daten in strukturierter Form erhalten</li>
              <li><strong>Widerspruch</strong> – Sie können der Verarbeitung widersprechen</li>
            </ul>
            <p className="text-stone-700 leading-relaxed">
              Zur Ausübung dieser Rechte wenden Sie sich bitte an: <strong>info@floralog.de</strong>
            </p>
          </CardContent>
        </Card>

        {/* Speicherdauer */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-green-600" />
              7. Speicherdauer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Ihre Daten werden gespeichert, solange Sie die App aktiv nutzen. 
              Nach Löschung Ihres Accounts werden alle personenbezogenen Daten 
              unverzüglich gelöscht, sofern keine gesetzlichen Aufbewahrungsfristen bestehen.
            </p>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              8. Cookies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed mb-3">
              Floralog verwendet ausschließlich technisch notwendige Cookies für die 
              Authentifizierung über Supabase. Diese Cookies sind für die Funktionsfähigkeit 
              der App erforderlich und können nicht deaktiviert werden.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Es werden keine Tracking- oder Marketing-Cookies verwendet.
            </p>
          </CardContent>
        </Card>

        {/* Änderungen */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              9. Änderungen dieser Datenschutzerklärung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an 
              geänderte Rechtslage oder Änderungen unserer Dienstleistungen anzupassen. 
              Wir empfehlen Ihnen, diese Seite regelmäßig zu besuchen, um über 
              Änderungen informiert zu bleiben.
            </p>
            <p className="text-sm text-stone-600 mt-4">
              Stand: Januar 2025
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
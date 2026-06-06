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

        {/* Verarbeitung personenbezogener Daten bei Nutzung der App */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-green-600" />
              2. Verarbeitung personenbezogener Daten bei Nutzung der App
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-stone-700 leading-relaxed">
              Bei der Nutzung der App werden folgende personenbezogene Daten verarbeitet:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4">
              <li>E-Mail-Adresse</li>
              <li>Anzeigename</li>
              <li>Standortdaten im Zusammenhang mit durchgeführten Scans (sofern diese Funktion nicht deaktiviert wurde)</li>
              <li>Bildaufnahmen, die im Rahmen von Scans erstellt werden</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-4">
              Die Verarbeitung dieser Daten erfolgt zum Zweck der Bereitstellung der Funktionen der App sowie zur Durchführung und Verbesserung der angebotenen Dienste.
            </p>
          </CardContent>
        </Card>

        {/* Rechtsgrundlagen der Verarbeitung */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              3. Rechtsgrundlagen der Verarbeitung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-stone-700 leading-relaxed">
              Die Verarbeitung der personenbezogenen Daten erfolgt auf Grundlage von <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertragserfüllung), soweit die Daten zur Bereitstellung der App-Funktionen erforderlich sind.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Sofern Standortdaten verarbeitet werden, erfolgt dies auf Grundlage einer Einwilligung gemäß <strong>Art. 6 Abs. 1 lit. a DSGVO</strong>, die jederzeit widerrufen werden kann.
            </p>
          </CardContent>
        </Card>

        {/* Einsatz externer Dienstleister */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-6 h-6 text-green-600" />
              4. Einsatz externer Dienstleister
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <p className="text-stone-700 leading-relaxed">
              Zur Bereitstellung der App nutzen wir externe Dienstleister im Rahmen einer Auftragsverarbeitung gemäß <strong>Art. 28 DSGVO</strong>:
            </p>
            
            <div className="border-l-4 border-blue-600 pl-4">
              <h3 className="font-bold text-lg text-stone-900 mb-2">Cloudflare (Cloudflare, Inc., USA)</h3>
              <p className="text-stone-700 leading-relaxed">
                Das Frontend der Anwendung wird über Cloudflare bereitgestellt. Cloudflare betreibt ein globales Content Delivery Network (CDN), über das Inhalte ausgeliefert werden. Dabei werden insbesondere technische Verbindungsdaten (z. B. IP-Adresse) verarbeitet. Eine Übermittlung personenbezogener Daten in die USA kann nicht ausgeschlossen werden. Die Datenübermittlung erfolgt auf Grundlage geeigneter Garantien gemäß <strong>Art. 46 DSGVO</strong>.
              </p>
            </div>

            <div className="border-l-4 border-blue-600 pl-4">
              <h3 className="font-bold text-lg text-stone-900 mb-2">Supabase (Supabase Pte. Ltd., Singapur)</h3>
              <p className="text-stone-700 leading-relaxed">
                Die Speicherung und Verarbeitung der Nutzerdaten erfolgt über Supabase. Die Datenbanken werden in Rechenzentren innerhalb der Europäischen Union (Frankfurt am Main, Deutschland) betrieben. Supabase nutzt zur technischen Umsetzung Infrastruktur von Drittanbietern (z. B. Cloud-Provider), wodurch eine Weitergabe an Unterauftragsverarbeiter erfolgen kann.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Speicherdauer */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-green-600" />
              5. Speicherdauer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Personenbezogene Daten werden nur so lange gespeichert, wie dies für die jeweiligen Verarbeitungszwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
            </p>
          </CardContent>
        </Card>

        {/* Weitergabe von Daten */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              6. Weitergabe von Daten
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Eine Weitergabe personenbezogener Daten erfolgt ausschließlich im Rahmen der oben beschriebenen Auftragsverarbeitung oder wenn wir gesetzlich dazu verpflichtet sind.
            </p>
          </CardContent>
        </Card>

        {/* Ihre Rechte / Rechte der betroffenen Personen */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-green-600" />
              7. Rechte der betroffenen Personen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-stone-700 leading-relaxed">
              Nutzerinnen und Nutzer haben im Rahmen der gesetzlichen Bestimmungen folgende Rechte:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 ml-4">
              <li>Auskunft über die verarbeiteten personenbezogenen Daten (<strong>Art. 15 DSGVO</strong>)</li>
              <li>Berichtigung unrichtiger Daten (<strong>Art. 16 DSGVO</strong>)</li>
              <li>Löschung personenbezogener Daten (<strong>Art. 17 DSGVO</strong>)</li>
              <li>Einschränkung der Verarbeitung (<strong>Art. 18 DSGVO</strong>)</li>
              <li>Datenübertragbarkeit (<strong>Art. 20 DSGVO</strong>)</li>
              <li>Widerspruch gegen die Verarbeitung (<strong>Art. 21 DSGVO</strong>)</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-4">
              Sofern die Verarbeitung auf einer Einwilligung beruht, kann diese jederzeit mit Wirkung für die Zukunft widerrufen werden.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Anleitung zur Kontoloeschung: <a href="/AccountDeletion" className="text-blue-700 underline">/AccountDeletion</a>
            </p>
          </CardContent>
        </Card>

        {/* Beschwerderecht */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              8. Beschwerderecht
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Es besteht das Recht, sich bei einer Datenschutzaufsichtsbehörde über die Verarbeitung personenbezogener Daten zu beschweren.
            </p>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              9. Cookies
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
              10. Änderungen dieser Datenschutzerklärung
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
              Stand: April 2026
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
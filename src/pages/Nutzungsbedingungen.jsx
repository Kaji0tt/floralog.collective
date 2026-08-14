import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield, Scale, AlertTriangle } from "lucide-react";
import MobileBackButton from "../components/navigation/MobileBackButton";

// TODO: Platzhaltertext - vor Veroeffentlichung juristisch pruefen lassen.
export default function Nutzungsbedingungen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">
            Nutzungsbedingungen
          </h1>
          <p className="text-lg text-stone-600">
            Bedingungen für die Nutzung von Floralog
          </p>
        </div>

        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader className="border-b border-stone-200 bg-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              In Kürze
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Diese Nutzungsbedingungen regeln die Nutzung der Floralog-App und -Website.
              Mit der Registrierung eines Accounts erklärst du dich mit den folgenden
              Bedingungen einverstanden. Die App befindet sich noch in der Entwicklung,
              diese Nutzungsbedingungen werden entsprechend aktualisiert.
            </p>
          </CardContent>
        </Card>

        {/* Geltungsbereich */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              1. Geltungsbereich
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Diese Nutzungsbedingungen gelten für alle Nutzerinnen und Nutzer der
              Floralog-App (Web, Android, iOS) und regeln das Vertragsverhältnis
              zwischen dir und Floralog Collective, Dorotheenstr. 41, 24939 Flensburg,
              vertreten durch Jascha Kruse.
            </p>
          </CardContent>
        </Card>

        {/* Registrierung und Account */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              2. Registrierung und Nutzerkonto
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <p className="text-stone-700 leading-relaxed">
              Für die Nutzung bestimmter Funktionen ist ein Nutzerkonto erforderlich.
              Die Registrierung kann per E-Mail/Passwort oder über einen unterstützten
              Drittanbieter-Login (z.&nbsp;B. Google) erfolgen. Du bist verpflichtet,
              wahrheitsgemäße Angaben zu machen und deine Zugangsdaten geheim zu halten.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Du bist für alle Aktivitäten verantwortlich, die über dein Konto
              vorgenommen werden, solange du keine unautorisierte Nutzung angezeigt hast.
            </p>
          </CardContent>
        </Card>

        {/* Nutzungsrechte / erlaubte Nutzung */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-green-600" />
              3. Erlaubte Nutzung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <p className="text-stone-700 leading-relaxed">
              Floralog dient der spielerischen Erkundung und Dokumentation von Pflanzen
              sowie dem Austausch mit anderen Nutzerinnen und Nutzern. Du verpflichtest
              dich, die App nicht zu missbrauchen, insbesondere:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-700">
              <li>keine falschen, beleidigenden oder rechtswidrigen Inhalte zu teilen</li>
              <li>keine automatisierten Systeme (Bots, Scraper) ohne Erlaubnis einzusetzen</li>
              <li>keine Rechte Dritter (Urheberrecht, Persönlichkeitsrechte) zu verletzen</li>
              <li>Spielmechaniken (z.&nbsp;B. Quests, Belohnungen) nicht durch Manipulation auszunutzen</li>
            </ul>
          </CardContent>
        </Card>

        {/* Inhalte der Nutzer */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              4. Von dir bereitgestellte Inhalte
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Für Inhalte, die du hochlädst (z.&nbsp;B. Scans, Kollektionsnotizen, Profilbilder),
              räumst du Floralog Collective das Recht ein, diese im Rahmen des Betriebs der
              App zu speichern, anzuzeigen und mit anderen Nutzerinnen und Nutzern zu teilen,
              soweit du dies über die jeweilige Funktion (z.&nbsp;B. öffentliche Kollektionen,
              Freundesliste) selbst auslöst.
            </p>
          </CardContent>
        </Card>

        {/* Verfügbarkeit / Haftung */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-green-600" />
              5. Verfügbarkeit und Haftung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <p className="text-stone-700 leading-relaxed">
              Floralog befindet sich in aktiver Entwicklung. Es besteht kein Anspruch auf
              ständige Verfügbarkeit, Fehlerfreiheit oder den Fortbestand einzelner Funktionen.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Inhalte zur Pflanzenbestimmung werden teilweise KI-gestützt erzeugt und dienen
              ausschließlich Bildungszwecken; sie ersetzen keine professionelle botanische
              oder medizinische Beratung. Es wird keine Gewähr für Richtigkeit, Vollständigkeit
              oder Aktualität übernommen.
            </p>
          </CardContent>
        </Card>

        {/* Kündigung / Löschung */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              6. Kündigung und Kontolöschung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Du kannst dein Konto jederzeit über die Konto-Löschfunktion in der App
              entfernen lassen. Floralog Collective behält sich vor, Konten bei Verstoß
              gegen diese Nutzungsbedingungen zu sperren oder zu löschen.
            </p>
          </CardContent>
        </Card>

        {/* Änderungen */}
        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              7. Änderungen dieser Nutzungsbedingungen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-700 leading-relaxed">
              Wir behalten uns vor, diese Nutzungsbedingungen anzupassen, um sie an
              geänderte Rechtslage oder Änderungen unserer Dienstleistungen anzupassen.
              Wir empfehlen dir, diese Seite regelmäßig zu besuchen, um über Änderungen
              informiert zu bleiben.
            </p>
            <p className="text-sm text-stone-600 mt-4">
              Stand: August 2026
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

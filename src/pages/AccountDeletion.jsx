import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Settings, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MobileBackButton from "@/components/navigation/MobileBackButton";
import { deleteMyAccount } from "@/api/accountDeletionService";
import { supabase } from "@/api/supabaseClient";

export default function AccountDeletion() {
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadAccount = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAccountEmail(data?.user?.email || "");
    };

    loadAccount();

    return () => {
      mounted = false;
    };
  }, []);

  const canDelete = useMemo(() => password.trim().length > 0, [password]);

  const handleDeleteAccount = async () => {
    if (!canDelete || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage("");

    try {
      await deleteMyAccount(password);
      setDeleted(true);

      // Session client-side clean-up after backend account removal.
      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = "/";
      }, 1800);
    } catch (error) {
      setErrorMessage(error?.message || "Konto konnte nicht gelöscht werden.");
      setIsDeleting(false);
    }
  };

  if (deleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8 flex items-center justify-center">
        <Card className="border-2 border-green-200 shadow-xl bg-white max-w-xl w-full">
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-stone-900 mb-3">Konto gelöscht</h1>
            <p className="text-stone-700 leading-relaxed">
              Dein Konto sowie alle Daten mit Bezug zu deiner Auth-ID wurden entfernt.
              Du wirst jetzt zur Startseite weitergeleitet.
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-green-700 mx-auto mt-5" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3">Konto löschen</h1>
          <p className="text-lg text-stone-600">
            So löschst du dein Konto in der App Schritt für Schritt.
          </p>
        </div>

        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription className="text-amber-900">
            <strong>Aktuell eingeloggt:</strong> {accountEmail || "Kein Konto erkannt"}
          </AlertDescription>
        </Alert>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader className="bg-stone-50 border-b border-stone-200">
            <CardTitle className="flex items-center gap-2 text-stone-900">
              <Settings className="w-5 h-5 text-green-700" />
              Anleitung in der App
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ol className="list-decimal list-inside space-y-3 text-stone-700 leading-relaxed">
              <li>Melde dich in Floralog mit deinem Konto an.</li>
              <li>Gehe auf den Home-Screen.</li>
              <li>Tippe oben rechts auf das Zahnrad, um die Einstellungen zu öffnen.</li>
              <li>Scrolle in den Einstellungen nach unten zum Bereich Konto.</li>
              <li>Tippe auf Konto dauerhaft löschen.</li>
              <li>Gib das Passwort des aktuell eingeloggten Kontos ein.</li>
              <li>Führe die endgültige Löschung aus.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-300 shadow-lg bg-white">
          <CardHeader className="bg-red-50 border-b border-red-200">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Wichtiger Hinweis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-stone-700 leading-relaxed">
              Bei der Kontolöschung wird dein Auth-Konto entfernt. Zusätzlich werden alle Datensätze,
              die mit deiner Auth-ID verknüpft sind, aus den öffentlichen Tabellen gelöscht.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden.
            </p>
            <p className="text-stone-700 leading-relaxed">
              Die Löschung betrifft das aktuell eingeloggte Konto: <strong>{accountEmail || "unbekannt"}</strong>.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-stone-200 shadow-lg bg-white">
          <CardHeader>
            <CardTitle>Jetzt löschen</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <label className="block text-sm font-semibold text-stone-700">
              Bitte gib dein Passwort zur Bestätigung ein:
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              disabled={isDeleting}
              className="border-2 border-stone-300"
              autoComplete="current-password"
            />

            {errorMessage ? (
              <Alert className="border-red-300 bg-red-50">
                <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              onClick={handleDeleteAccount}
              disabled={!canDelete || isDeleting}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Konto wird gelöscht...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Konto dauerhaft löschen
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signIn, signUp, signInWithGoogle } from "@/api/authService";
import { fetchRemoteConfig } from "@/lib/remoteConfigService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function GuestAccountDialog({ open, onClose, hasReward = false }) {
  const { authError } = useAuth();
  const [register, setRegister] = useState(hasReward);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) setRegister(hasReward);
  }, [open, hasReward]);
  const field = (name) => ({ value: form[name], onChange: (event) => setForm({ ...form, [name]: event.target.value }) });

  const authenticate = async (google = false) => {
    if (busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const config = await fetchRemoteConfig();
      if (config.loginDisabled) throw new Error(config.loginDisabledMessage || "Anmeldungen sind gerade wegen Wartungsarbeiten pausiert.");
      if (google) {
        await signInWithGoogle();
      } else if (register) {
        if (!form.name.trim()) throw new Error("Bitte gib einen Anzeigenamen ein.");
        if (form.password !== form.confirm) throw new Error("Die Passwoerter stimmen nicht ueberein.");
        const result = await signUp(form.email.trim(), form.password, form.name.trim());
        if (!result?.session) {
          setMessage("Bitte bestaetige deine E-Mail und melde dich danach hier an. Dein Fund bleibt in diesem Browser vorgemerkt.");
          setRegister(false);
          setForm((previous) => ({ ...previous, password: "", confirm: "" }));
        }
      } else {
        const result = await signIn(form.email.trim(), form.password);
        if (!result?.session) throw new Error("Die Anmeldung konnte nicht abgeschlossen werden.");
      }
    } catch (cause) {
      console.error("[GuestAccount] Authentication failed:", cause);
      setError(cause instanceof Error ? cause.message : "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md rounded-3xl border-amber-100/30 bg-stone-950 text-stone-100">
        <DialogHeader>
          <DialogTitle>{hasReward ? "Sichere euren ersten Fund!" : "Willkommen zurueck!"}</DialogTitle>
          <DialogDescription className="text-stone-300">
            {hasReward ? "Behalte deinen Florabot, deine Entdeckung und deine Samen mit einem kostenlosen Konto." : "Melde dich an oder erstelle ein kostenloses Konto."}
          </DialogDescription>
        </DialogHeader>
        <Button disabled={busy} onClick={() => authenticate(true)} className="w-full bg-white text-stone-900 hover:bg-stone-200">
          Mit Google fortfahren
        </Button>
        <p className="text-center text-xs text-stone-400">oder mit E-Mail</p>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); authenticate(); }}>
          {register && <label className="block text-sm">Anzeigename<input {...field("name")} required autoComplete="nickname" className="mt-1 w-full rounded-xl bg-white/10 p-3" /></label>}
          <label className="block text-sm">E-Mail<input {...field("email")} type="email" required autoComplete="email" className="mt-1 w-full rounded-xl bg-white/10 p-3" /></label>
          <label className="block text-sm">Passwort<input {...field("password")} type="password" required minLength={register ? 6 : undefined} autoComplete={register ? "new-password" : "current-password"} className="mt-1 w-full rounded-xl bg-white/10 p-3" /></label>
          {register && <label className="block text-sm">Passwort bestaetigen<input {...field("confirm")} type="password" required minLength={6} autoComplete="new-password" className="mt-1 w-full rounded-xl bg-white/10 p-3" /></label>}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {authError?.type === "native_oauth_error" && <p role="alert" className="text-sm text-red-300">{authError.message}</p>}
          {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
          <Button disabled={busy} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{register ? "Kostenlos registrieren" : "Mit E-Mail anmelden"}
          </Button>
        </form>
        <button type="button" onClick={() => { setRegister(!register); setError(""); }} className="text-sm text-lime-200">
          {register ? "Schon ein Konto? Anmelden" : "Noch kein Konto? Kostenlos registrieren"}
        </button>
        <Link to="/forgot-password" onClick={onClose} className="text-center text-xs text-stone-400">Passwort vergessen?</Link>
        <p className="text-xs text-stone-400">Mit der Registrierung akzeptierst du die <Link to="/Nutzungsbedingungen" className="underline">Nutzungsbedingungen</Link>. Hinweise zum Datenschutz findest du in der <Link to="/Datenschutz" className="underline">Datenschutzerklaerung</Link>.</p>
        <button type="button" onClick={onClose} className="py-2 text-sm text-stone-400">Spaeter - Home ansehen</button>
      </DialogContent>
    </Dialog>
  );
}

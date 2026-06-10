import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const PLATFORM_OPTIONS = [
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
];

export default function GuestPlaytestSignup() {
  const [googleEmail, setGoogleEmail] = useState("");
  const [platform, setPlatform] = useState("android");
  const [notifyUpdates, setNotifyUpdates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = String(googleEmail || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMessage("Bitte gib eine gueltige Google-E-Mail-Adresse ein.");
      return;
    }

    if (!platform) {
      setErrorMessage("Bitte waehle dein Geraet aus.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.functions.invoke("sendFeedbackEmail", {
        body: {
          reportType: "playtest_signup",
          email: normalizedEmail,
          platform,
          notifyUpdates,
          source: "guest-playtest-direct",
        },
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
    } catch {
      setErrorMessage("Anmeldung fehlgeschlagen. Bitte versuche es gleich erneut.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(22,101,52,0.22),transparent_46%),linear-gradient(180deg,#08130f_0%,#050906_68%,#040604_100%)] text-stone-100">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
        <section className="rounded-3xl border border-emerald-300/20 bg-black/30 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-7">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">Play Store Closed Test</p>
          <h1 className="mt-2 text-2xl font-semibold text-emerald-50 sm:text-3xl">Teilnahme anfragen</h1>
          <p className="mt-2 text-sm text-stone-300">
            Gib bitte die Google-E-Mail-Adresse ein, mit der dein Play-Store-Konto verknuepft ist.
          </p>

          {isSuccess ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="font-medium text-emerald-100">Vielen Dank, du bist registriert.</p>
                  <p className="mt-1 text-sm text-emerald-50/85">
                    Wir haben deine Angaben erfasst und an das Team weitergeleitet.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="google-email" className="mb-2 block text-sm font-medium text-stone-200">
                  Google-E-Mail-Adresse
                </label>
                <input
                  id="google-email"
                  type="email"
                  autoComplete="email"
                  value={googleEmail}
                  onChange={(event) => setGoogleEmail(event.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full rounded-xl border border-stone-600/60 bg-stone-900/70 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400"
                />
              </div>

              <div>
                <label htmlFor="platform" className="mb-2 block text-sm font-medium text-stone-200">
                  Geraet
                </label>
                <select
                  id="platform"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  className="w-full rounded-xl border border-stone-600/60 bg-stone-900/70 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400"
                >
                  {PLATFORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-stone-700/70 bg-stone-900/45 px-3 py-2.5 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={notifyUpdates}
                  onChange={(event) => setNotifyUpdates(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-500 bg-stone-800"
                />
                <span>Ueber Neuigkeiten informieren</span>
              </label>

              {platform === "ios" ? (
                <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                  Eine App fuer iOS wird derzeit leider nicht unterstuetzt. Du kannst das Spiel aber weiterhin im Browser spielen:
                  <div className="mt-2">
                    <Link to="/" className="font-semibold underline underline-offset-4">
                      Zum Browser-Start (Guest Funnel)
                    </Link>
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{errorMessage}</span>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Anmeldung wird gespeichert...
                  </>
                ) : (
                  "Anmeldung bestaetigen"
                )}
              </button>
            </form>
          )}
        </section>

        <footer className="mt-5 text-center text-xs text-stone-400">
          by <a href="https://floralog.de" className="underline underline-offset-4">Floralog Collective</a>, enabled with <a href="https://identify.plantnet.org/" target="_blank" rel="noreferrer" className="underline underline-offset-4">Pl@ntNet</a>
        </footer>
      </main>
    </div>
  );
}

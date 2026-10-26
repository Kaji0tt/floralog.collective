import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, MapPin, Trophy, Users, BookOpen } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";
import GuestLogoCustomizerStep from "./GuestLogoCustomizerStep";
import GuestAccountDialog from "./GuestAccountDialog";
import HomeEventStripe from "./HomeEventStripe";
import HomeBottomNavigation from "@/components/navigation/HomeBottomNavigation";
import ScanFeedbackNotification from "@/components/notifications/ScanFeedbackNotification";
import { readGuestFunnel, updateGuestFunnel, subscribeGuestFunnel, hasGuestStorageWarning, needsGuestAccount } from "@/lib/guestFunnelStorage";
import { readGuestLogoCustomizationDraft, persistGuestLogoCustomizationDraft } from "@/lib/guestLogoCustomizationStorage";
import { LOGO_ACCESSORY_DEFAULTS } from "@/lib/logoAccessoryAssets";
import { callGuestScan } from "@/api/guestScanService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { STORY_COPY } from "@/lib/story/storyDefinition";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";

const background = new URL("../../../guestfunnel-bg.png", import.meta.url).href;
const navItems = [
  { label: "Map", icon: MapPin, isDisabled: true },
  { label: "Aufgaben", icon: Trophy, isDisabled: true },
  { label: "Community", icon: Users, isDisabled: true },
  { label: "Log", icon: BookOpen, isDisabled: true },
];

export default function GuestHomeLite() {
  const navigate = useNavigate();
  const { isLightUi } = useUiTheme();
  const [state, setState] = useState(readGuestFunnel);
  const [draft, setDraft] = useState(() => readGuestLogoCustomizationDraft() || { ...LOGO_ACCESSORY_DEFAULTS, selected_border_color: null });
  const [authOpen, setAuthOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(hasGuestStorageWarning);
  const [retry, setRetry] = useState(0);
  const releaseFeedbackRef = useRef(null);
  const [feedbackElsewhere, setFeedbackElsewhere] = useState(false);
  const { data: events = [], error: eventsError } = useQuery({
    queryKey: ["guestHomeEvents"],
    queryFn: async () => {
      const data = await callGuestScan("events");
      const weekly = getCurrentWeeklyQuest(data.weeklyQuests);
      const monthly = getCurrentMonthlyQuest(data.monthlyQuests);
      return [
        ...data.events,
        ...(weekly ? [{ id: weekly.id, kind: "weekly", label: "Pflanze der Woche", title: weekly.target_species_name || weekly.target_genus_name || weekly.title, description: weekly.description }] : []),
        ...(monthly ? [{ id: monthly.id, kind: "monthly", title: monthly.title, description: monthly.description }] : []),
      ];
    },
    staleTime: 60000,
    retry: 1,
  });

  useEffect(() => subscribeGuestFunnel(() => {
    setState({ ...readGuestFunnel() });
    setStorageFailed(hasGuestStorageWarning());
  }), []);
  useEffect(() => {
    const failed = () => setStorageFailed(true);
    window.addEventListener("guestLogoStorageFailed", failed);
    return () => window.removeEventListener("guestLogoStorageFailed", failed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFeedbackElsewhere(false);
    if (state.phase === "account_required") setFeedback(null);
    if (!state.token || state.phase === "claimed") return;
    callGuestScan("status").then(async (receipt) => {
      if (cancelled) return;
      setError("");
      if (receipt.status === "confirmed") {
        if (state.phase !== "account_required") {
          if (state.phase !== "reward_pending") {
            updateGuestFunnel({ phase: "reward_pending" });
            return;
          }
          const showFeedback = async () => {
            if (cancelled) return;
            setFeedback(receipt.feedback);
            await new Promise((resolve) => { releaseFeedbackRef.current = resolve; });
            releaseFeedbackRef.current = null;
          };
          if (navigator.locks) {
            await navigator.locks.request("floralog:guestScanFeedback", { ifAvailable: true }, async (lock) => {
              if (lock) await showFeedback();
              else if (!cancelled) setFeedbackElsewhere(true);
            });
          } else {
            await showFeedback();
          }
        }
      } else if (["open", "identified"].includes(receipt.status) && needsGuestAccount(state)) {
        updateGuestFunnel({ phase: "scan_pending" });
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause.message);
    });
    return () => {
      cancelled = true;
      releaseFeedbackRef.current?.();
    };
  }, [state.token, state.phase, retry]);

  const changeDraft = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    persistGuestLogoCustomizationDraft(next);
  };
  const completeIntro = () => updateGuestFunnel({ phase: "home_ready", introSeen: true });
  const scan = () => {
    if (readGuestFunnel().phase === "reward_pending") {
      setRetry((value) => value + 1);
      return;
    }
    if (needsGuestAccount(readGuestFunnel())) setAuthOpen(true);
    else navigate("/Scanner");
  };
  const finishFeedback = () => {
    setFeedback(null);
    updateGuestFunnel({ phase: "account_required" });
    releaseFeedbackRef.current?.();
    setAuthOpen(true);
  };
  const onboarding = state.phase === "intro" || state.phase === "customization";
  const copy = STORY_COPY.guestFunnel;

  return (
    <div className={`min-h-dvh ${isLightUi ? "text-stone-900" : "text-stone-100"}`} style={{ backgroundImage: `linear-gradient(${isLightUi ? "rgba(245,240,220,.7),rgba(225,235,210,.8)" : "rgba(4,14,8,.55),rgba(4,14,8,.9)"}),url(${background})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between text-sm">
          <span className="font-semibold">floralog.collective</span>
          <button onClick={() => setAuthOpen(true)} className="rounded-lg border border-current/20 px-3 py-2 text-xs">Anmelden</button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center py-6">
          <FlorabotLogo profile={draft} sizeClass={onboarding ? "h-36 w-36" : "h-[min(65vw,34vh)] w-[min(65vw,34vh)]"} className="drop-shadow-[0_0_25px_rgba(190,242,100,.3)]" />
          {state.phase === "intro" ? (
            <section className="w-full space-y-4 rounded-3xl border border-current/15 bg-black/10 p-5 text-center">
              <h1 className="text-xl font-semibold">{copy.welcomeTitle}</h1>
              <p className="text-sm leading-relaxed">{copy.welcomeBody}</p>
              <button onClick={() => updateGuestFunnel({ phase: "customization" })} className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950">Deinen Florabot gestalten</button>
              <button onClick={completeIntro} className="text-xs opacity-70">Ueberspringen</button>
            </section>
          ) : state.phase === "customization" ? (
            <section className="w-full rounded-3xl border border-current/15 bg-black/20 p-5 text-stone-100">
              <h1 className="mb-4 text-center text-lg font-semibold">Dein eigener Naturbegleiter</h1>
              <GuestLogoCustomizerStep draft={draft} onSelectFace={(value) => changeDraft({ selected_face_asset: value })} onSelectBorder={(value) => changeDraft({ selected_border_asset: value })} onSelectColor={(value) => changeDraft({ selected_border_color: value })} onContinue={completeIntro} />
            </section>
          ) : (
            <section className="w-full space-y-4 text-center">
              <h1 className="text-2xl font-semibold">{needsGuestAccount(state) ? "Euer Abenteuer hat begonnen!" : copy.scanTitle}</h1>
              <button onClick={scan} className="w-full rounded-2xl border border-current/15 bg-black/10 p-4 text-sm leading-relaxed">
                {needsGuestAccount(state) ? "Sichere euren Fund und eure Samen mit einem kostenlosen Konto." : copy.scanBody}
              </button>
              <button onClick={scan} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-semibold text-white shadow-lg hover:bg-emerald-400">
                <Camera className="h-5 w-5" />{needsGuestAccount(state) ? "Fund sichern und weiterscannen" : "Erste Pflanze scannen"}
              </button>
              {!needsGuestAccount(state) && <p className="text-xs opacity-70">Ohne Konto ausprobieren. Erst entdecken, dann entscheiden.</p>}
            </section>
          )}
        </div>
        {storageFailed && <p role="alert" className="mb-3 text-sm">Dein Browser kann den Fortschritt nicht dauerhaft speichern. Bitte lasse diese Seite bis zur Anmeldung geoeffnet.</p>}
        {feedbackElsewhere && <p role="status" className="mb-3 text-sm">Dein Scan-Feedback ist in einem anderen Tab geoeffnet. Schliesse es dort ab oder schliesse den anderen Tab und tippe hier erneut auf die Kamera.</p>}
        {error && <div role="alert" className="mb-3 text-sm">{error} <button className="underline" onClick={() => setRetry((value) => value + 1)}>Erneut versuchen</button>{error.includes("abgelaufen") && <button className="ml-2 underline" onClick={() => { updateGuestFunnel({ token: null, phase: "home_ready" }); setError(""); }}>Abgelaufenen Versuch verwerfen</button>}</div>}
        {!onboarding && <div className="mb-8"><HomeEventStripe isLightUi={isLightUi} events={events.map((event) => ({ ...event, onClick: scan }))} />{eventsError && <p role="status" className="mt-2 text-xs">Aktuelle Aktionen konnten nicht geladen werden.</p>}</div>}
        {!onboarding && <HomeBottomNavigation navItems={navItems} onCenterAction={scan} highlightCenterAction={!needsGuestAccount(state)} />}
        <footer className="mt-5 flex justify-center gap-4 pb-[env(safe-area-inset-bottom)] text-xs opacity-70">
          <Link to="/Impressum">Impressum</Link><Link to="/Datenschutz">Datenschutz</Link><Link to="/guest-landing">Hilfe &amp; App</Link>
        </footer>
      </main>
      <AnimatePresence>{feedback && <ScanFeedbackNotification feedback={feedback} profile={draft} onComplete={finishFeedback} />}</AnimatePresence>
      <GuestAccountDialog open={authOpen && !feedback} hasReward={needsGuestAccount(state)} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

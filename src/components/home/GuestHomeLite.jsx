import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Trophy, Leaf, BookOpen } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import FlorabotMilestoneOverlay from "@/components/florabot/FlorabotMilestoneOverlay";
import FlorabotOverlayShell from "@/components/florabot/FlorabotOverlayShell";
import FlorabotContextBubble from "@/components/florabot/FlorabotContextBubble";
import { HomeScreenLayout, HomeHeroHeading, HomeHeroSection, HomeBottomArea } from "./HomeScreenLayout";
import HomeCollectionStripes from "./HomeCollectionStripes";
import HomeHeroSideNav from "./HomeHeroSideNav";
import GuestLogoCustomizerStep from "./GuestLogoCustomizerStep";
import GuestAccountDialog from "./GuestAccountDialog";
import HomeEventStripe from "./HomeEventStripe";
import GoldGradientCard from "./GoldGradientCard";
import HomeBottomNavigation from "@/components/navigation/HomeBottomNavigation";
import ScanFeedbackNotification from "@/components/notifications/ScanFeedbackNotification";
import { readGuestFunnel, updateGuestFunnel, subscribeGuestFunnel, hasGuestStorageWarning, needsGuestAccount } from "@/lib/guestFunnelStorage";
import { readGuestLogoCustomizationDraft, persistGuestLogoCustomizationDraft } from "@/lib/guestLogoCustomizationStorage";
import { LOGO_ACCESSORY_DEFAULTS } from "@/lib/logoAccessoryAssets";
import { createRandomBotName } from "@/lib/botNames";
import { callGuestScan } from "@/api/guestScanService";
import { useUiTheme } from "@/lib/UiThemeContext";
import { STORY_COPY } from "@/lib/story/storyDefinition";
import { getCurrentWeeklyQuest, getCurrentMonthlyQuest } from "@/components/quests/QuestRotationHelper";

const navItems = [
  { label: "Map", icon: MapPin, isDisabled: true },
  { label: "Aufgaben", icon: Trophy, isDisabled: true },
  { label: "Sammlung", icon: Leaf, isDisabled: true },
  { label: "Log", icon: BookOpen, isDisabled: true },
];

export default function GuestHomeLite() {
  const navigate = useNavigate();
  const { isLightUi } = useUiTheme();
  const [state, setState] = useState(readGuestFunnel);
  const [draft, setDraft] = useState(() => {
    const saved = readGuestLogoCustomizationDraft();
    return {
      ...(saved || { ...LOGO_ACCESSORY_DEFAULTS, selected_border_color: null }),
      bot_name: saved?.bot_name || createRandomBotName(),
    };
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(hasGuestStorageWarning);
  const [retry, setRetry] = useState(0);
  const releaseFeedbackRef = useRef(null);
  const [feedbackElsewhere, setFeedbackElsewhere] = useState(false);
  const { data: events = [], error: eventsError, isPending: eventsPending, refetch: refetchEvents } = useQuery({
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
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
    persistGuestLogoCustomizationDraft(draft);
  }, [draft]);

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
    <>
      <HomeScreenLayout user={draft}>
        <HomeHeroHeading>
          <h1 className="-m-3 truncate p-3 font-bold leading-tight text-2xl md:text-3xl [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.75),0_0_20px_rgba(0,0,0,0.55)]">
            Neuling
          </h1>
          <p className={`-mx-3 -mb-3 -mt-2.5 truncate p-3 text-sm md:text-base [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.7)] ${isLightUi ? "text-stone-700/90" : "text-stone-200/85"}`}>
            und {draft.bot_name}
          </p>
        </HomeHeroHeading>
        <div className="relative flex flex-1 min-h-0 flex-col overflow-visible py-[clamp(0.5rem,1.5vh,1rem)]" data-ui="home-content-stack">
          <HomeHeroSection>
            <HomeHeroSideNav guestMode isLightUi={isLightUi} onOpenSettings={() => setAuthOpen(true)} />
            <div className="relative flex min-h-0 flex-1 flex-col gap-2">
              <HomeCollectionStripes profile={draft} className="flex-1 min-h-0" logoInteractive={false} />
            </div>
          </HomeHeroSection>
        </div>
        <HomeBottomArea>
          {storageFailed && <p role="alert" className="mb-3 text-sm">Dein Browser kann den Fortschritt nicht dauerhaft speichern. Bitte lasse diese Seite bis zur Anmeldung geöffnet.</p>}
          {feedbackElsewhere && <p role="status" className="mb-3 text-sm">Dein Scan-Feedback ist in einem anderen Tab geöffnet. Schließe es dort ab oder schließe den anderen Tab und tippe hier erneut auf die Kamera.</p>}
          {error && <div role="alert" className="mb-3 text-sm">{error} <button className="underline" onClick={() => setRetry((value) => value + 1)}>Erneut versuchen</button>{error.includes("abgelaufen") && <button className="ml-2 underline" onClick={() => { updateGuestFunnel({ token: null, phase: "home_ready" }); setError(""); }}>Abgelaufenen Versuch verwerfen</button>}</div>}
          <div className="mb-[clamp(0.35rem,0.8vh,0.55rem)]">
            {events.length > 0 && <HomeEventStripe isLightUi={isLightUi} events={events.map((event) => ({ ...event, onClick: scan }))} />}
            {(events.length === 0 || eventsError) && (
              <GoldGradientCard blur contentClassName="px-4 py-3 text-sm">
                <p role={eventsError ? "alert" : "status"}>
                  {eventsError ? "Aktuelle Aktionen konnten nicht geladen werden." : eventsPending ? "Aktuelle Aktionen werden geladen …" : "Gerade sind keine Aktionen verfügbar."}
                </p>
                {eventsError && <button type="button" onClick={() => refetchEvents()} className="mt-1 underline">Aktionen erneut laden</button>}
              </GoldGradientCard>
            )}
          </div>
          <HomeBottomNavigation navItems={navItems} onCenterAction={scan} highlightCenterAction={!state.scanHintDismissed && !needsGuestAccount(state)} />
        </HomeBottomArea>
      </HomeScreenLayout>
      <AnimatePresence mode="wait">
        {state.phase === "intro" && (
          <FlorabotMilestoneOverlay
            key="guest-intro"
            milestone={{ id: "guest_intro", threshold: 0, eyebrow: "Willkommen", messages: [{ title: copy.welcomeTitle, body: copy.welcomeBody }] }}
            profile={draft}
            finalButtonLabel="Deinen Florabot gestalten"
            onDismiss={() => updateGuestFunnel({ phase: "customization" })}
          />
        )}
        {state.phase === "customization" && (
          <FlorabotOverlayShell key="guest-customization" showLogo={false} overlayClassName="overflow-y-auto px-5 !justify-start">
            <div className={`my-auto w-full max-w-sm py-6 ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
              <h1 className="mb-4 text-center text-xl font-semibold">Dein eigener Naturbegleiter</h1>
              <GuestLogoCustomizerStep draft={draft} onRerollName={() => changeDraft({ bot_name: createRandomBotName(draft.bot_name) })} onSelectFace={(value) => changeDraft({ selected_face_asset: value })} onSelectBorder={(value) => changeDraft({ selected_border_asset: value })} onSelectColor={(value) => changeDraft({ selected_border_color: value })} onContinue={completeIntro} />
            </div>
          </FlorabotOverlayShell>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!onboarding && !state.scanHintDismissed && !needsGuestAccount(state) && !authOpen && (
          <FlorabotContextBubble
            message={copy.scanBody}
            profile={draft}
            onDismiss={() => updateGuestFunnel({ scanHintDismissed: true })}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{feedback && <ScanFeedbackNotification feedback={feedback} profile={draft} onComplete={finishFeedback} />}</AnimatePresence>
      <GuestAccountDialog open={authOpen && !feedback} hasReward={needsGuestAccount(state)} onClose={() => setAuthOpen(false)} />
    </>
  );
}

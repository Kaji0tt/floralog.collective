// @ts-nocheck
import React, { useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Haptics } from "@capacitor/haptics";
import FlorabotLogo from "@/components/florabot/FlorabotLogo";
// Hilfsfunktionen und Konstanten

// Punkteschwellen, ab denen die Punkte-Card zusaetzlich vibriert/leuchtet.
const REWARD_MILESTONES = {
  shake: 500,
  glow: 800,
};
// Farbe des bestehenden Punkte-Card-Rahmens (border-[#f0e5a5]), fuer den Glow bei 800 Punkten.
const REWARD_MILESTONE_GLOW_COLOR = "rgba(240, 229, 165, 0.92)";

// Gold/Lime-Impulsfarbe fuers Logo, wenn ein Multiplikator angewendet wird (Kartenakzentfarbe).
const MULTIPLIER_PULSE_COLOR = "#e8dd8c";
// Identisch zu den Stat-Farben im Home-Overlay (Home.jsx healthStats: Energie/Daten/Pflege),
// damit Badge- und Logo-Impulsfarben mit dem PlantHealth-Panel uebereinstimmen.
const PLANT_HEALTH_STAT_COLORS = {
  energy: "#10b981",
  "data-quality": "#06b6d4",
  care: "#f59e0b",
};

// Kurze Erklaerungen zur Herkunft jedes Multiplikator-Schritts, als Tooltip-Inhalt.
const MULTIPLIER_STEP_TOOLTIPS = {
  health: "Bonus/Abzug je nach Gesundheitszustand der gescannten Pflanze.",
  zone: "Bonus, weil sich die Pflanze in einer aktiven Sammel-Zone befindet.",
  rarity: "Bonus abhaengig von der Seltenheit dieser Pflanzenart.",
  novelty: "Bonus fuer neue oder lange nicht bestaetigte Entdeckungen.",
  care: "Bonus durch die Pflege deines Florabots (Scan-Streak, erhaltene Likes).",
  firstScan: "Bonus fuer deinen ersten Scan des heutigen Tages.",
  tiles: "Bonus durch beanspruchte Kartenkacheln in deiner Zone.",
};

// Nativ (Android/iOS) via Capacitor Haptics vibrieren, im Browser per Vibration API.
async function triggerDeviceVibration(durationMs) {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.vibrate({ duration: durationMs });
      return;
    } catch (_err) {
      // Fallback unten versuchen, falls das native Plugin fehlschlaegt.
    }
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(durationMs);
  }
}
function buildRewardSteps(rewardDetails, isInActiveZone) {
  if (!rewardDetails) return [];
  let runningReward = rewardDetails.baseReward ?? 0;
  const preStreakSteps = [];
  const formatTileBonusLabel = (multiplier) => {
    const bonusPercent = Math.max(0, (Number(multiplier) - 1) * 100);
    const roundedPercent = Number.isInteger(bonusPercent)
      ? bonusPercent
      : Math.round(bonusPercent * 10) / 10;
    return `+ ${roundedPercent}% durch Tiles`;
  };

  function pushPreStreakStep(id, label, multiplier) {
    if (multiplier === 1) return;
    runningReward *= multiplier;
    preStreakSteps.push({
      id,
      label,
      multiplier,
      result: Math.round(runningReward),
      positive: multiplier > 1,
    });
  }

  function pushAdditiveStep(id, label, delta) {
    if (!delta) return;
    runningReward += delta;
    preStreakSteps.push({
      id,
      label,
      delta,
      result: Math.round(runningReward),
      positive: delta > 0,
      displayValue: `${delta > 0 ? "+" : ""}${delta}`,
    });
  }

  pushAdditiveStep("health", rewardDetails.healthStateLabel || "Zustand", rewardDetails.healthStateBonus);
  if (isInActiveZone) pushPreStreakStep("zone", "Zone", rewardDetails.zoneMultiplier);
  pushPreStreakStep("rarity", "Raritaet", rewardDetails.rarityMultiplier);
  pushPreStreakStep("novelty", "Neuheit", rewardDetails.noveltyMultiplier);
  pushPreStreakStep("care", "Pflege", rewardDetails.careMultiplier);
  pushPreStreakStep("firstScan", "First Scan", rewardDetails.firstScanOfDayMultiplier);

  if (preStreakSteps.length > 0) {
    preStreakSteps[preStreakSteps.length - 1].result = rewardDetails.preStreakReward;
  }
  const positivePreStreak = preStreakSteps.filter((step) => step.positive);
  const negativePreStreak = preStreakSteps.filter((step) => !step.positive);
  const steps = [...positivePreStreak, ...negativePreStreak];

  const currentReward = rewardDetails.preStreakReward;

  if (rewardDetails.tileClaimMultiplier && rewardDetails.tileClaimMultiplier !== 1) {
    const preTileReward =
      typeof rewardDetails.preTileClaimReward === "number"
        ? rewardDetails.preTileClaimReward
        : currentReward;

    steps.push({
      id: "tiles",
      label: "Tiles",
      multiplier: rewardDetails.tileClaimMultiplier,
      result: rewardDetails.finalReward,
      positive: rewardDetails.tileClaimMultiplier > 1,
      displayValue: formatTileBonusLabel(rewardDetails.tileClaimMultiplier),
      from: preTileReward,
    });
  }
  return steps;
}

function formatMultiplier(mult) {
  if (typeof mult !== "number") return "";
  return mult % 1 === 0 ? mult : mult.toFixed(2);
}

const COUNTER_OUTLINE_STYLE = {
  textShadow:
    "0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
};

async function blobToBase64(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64Part = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64Part);
    };
    reader.onerror = () => reject(new Error("Screenshot-Konvertierung fehlgeschlagen."));
    reader.readAsDataURL(blob);
  });
}

// Native Teilen-Funktion mit Screenshot
async function handleNativeShare(cardRef, { plantName, rewardDetails } = {}) {
  try {
    const resultCard = cardRef.current;
    if (!resultCard) return alert('Fehler: Scan-Ergebnis nicht gefunden.');
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(resultCard, {
      backgroundColor: null,
      useCORS: true,
      scale: Math.max(2, window.devicePixelRatio || 1),
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return alert('Screenshot fehlgeschlagen.');
    const file = new File([blob], 'floralog-scan.png', { type: 'image/png' });
    const seedsAmount = typeof rewardDetails?.finalReward === 'number' ? rewardDetails.finalReward : undefined;
    const shareText = `Schau mal, beim Scan der Pflanze${plantName ? ' ' + plantName : ''} habe ich${seedsAmount !== undefined ? ' ' + seedsAmount : ''} Samen erhalten!\nTeste das Scannen selbst: https://floralog.de`;
    const shareData = {
      title: 'Mein Floralog Scan',
      text: shareText,
      files: [file]
    };

    if (Capacitor.isNativePlatform()) {
      const shareSupport = await Share.canShare();
      if (!shareSupport?.value) {
        alert('Teilen wird auf diesem Gerät nicht unterstützt.');
        return;
      }

      const base64 = await blobToBase64(blob);
      const fileName = `floralog-scan-${Date.now()}.png`;
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: 'Mein Floralog Scan',
        text: shareText,
        url: uri,
        dialogTitle: 'Scan teilen',
      });
      return;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share(shareData);
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: 'Mein Floralog Scan',
        text: shareText,
        url: 'https://floralog.app',
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floralog-scan.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('Teilen wird auf diesem Gerät nicht unterstützt. Der Screenshot wurde heruntergeladen.');
  } catch (err) {
    alert('Teilen fehlgeschlagen: ' + (err?.message || err));
  }
}

// Farbiger Impuls-Bubble-Puls ums Custom-Logo (gleiche Technik wie beim "Streicheln"
// eines Florabot-Freundes in FriendProfile.jsx: radialer Glow + zwei Ring-Borders).
function LogoImpulseRing({ color, nonce }) {
  return (
    <AnimatePresence>
      {color && nonce ? (
        <motion.div
          key={`logo-impulse-${nonce}`}
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-[-10%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${color}55 0%, ${color}2a 38%, transparent 76%)`,
              filter: "blur(9px)",
            }}
            initial={{ opacity: 0, scale: 0.78 }}
            animate={{ opacity: [0, 1, 0], scale: [0.78, 1.1, 1.3] }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: color, boxShadow: `0 0 26px ${color}cc, 0 0 48px ${color}55` }}
            initial={{ opacity: 0, scale: 0.84 }}
            animate={{ opacity: [0, 1, 0], scale: [0.84, 1.03, 1.14] }}
            transition={{ duration: 0.66, ease: "easeOut" }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// Kompaktes PlantHealth-Badge, eingefaerbt in der Farbe des jeweiligen Stats.
// borderColor/textColor koennen den Rahmen/Text unabhaengig von der Hintergrundfarbe uebersteuern.
function PlantHealthBadge({ color, label, borderColor = null, textColor = null }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
      style={{
        backgroundColor: `${color}26`,
        borderColor: borderColor || `${color}66`,
        color: textColor || color,
      }}
    >
      {label}
    </span>
  );
}

// Rotierender Multicolor-Rahmen, exklusiv fuers Funken-Badge wenn der Daily-Login-Reward
// beim ersten Scan des Tages mit ausgeschuettet wurde.
function RainbowFrame({ children }) {
  return (
    <motion.span
      className="inline-flex rounded-full p-[2px]"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #f87171, #fbbf24, #34d399, #38bdf8, #a78bfa, #f87171)",
        backgroundSize: "300% 100%",
      }}
      animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}

export default function ScanFeedbackNotification({
  feedback,
  onComplete,
  profile = null,
  logoAssets = [],
  shareSnapshotBackgroundImageUrl = null,
  shareSnapshotBackgroundColor = null,
}) {
  // Fix: cardRef muss im Funktions-Scope deklariert werden
  const cardRef = React.useRef(null);
  const onCompleteRef = useRef(onComplete);
  // Zeitgeber und AnimationFrame-Referenzen
  /** @type any[] */
  let timeouts = [];
  /** @type any */
  let frameId = null;
  const rewardDetails = feedback?.rewardDetails || null;
  const isInActiveZone = feedback?.isInActiveZone !== false;
  const energyDelta = Math.max(0, Number(feedback?.energyDelta ?? 0));
  const dataQualityDelta = Math.max(0, Number(feedback?.dataQualityDelta ?? 0));
  const scanStreak = feedback?.scanStreak || null;
  const hasScanStreakGains = Boolean(
    scanStreak && (scanStreak.pflegeDelta > 0 || scanStreak.funkenDelta > 0 || scanStreak.bernsteinDelta > 0)
  );
  const hasResourceGains = energyDelta > 0 || dataQualityDelta > 0 || hasScanStreakGains;
  const rewardSteps = useMemo(
    () => buildRewardSteps(rewardDetails, isInActiveZone),
    [rewardDetails, isInActiveZone]
  );

  const [displayReward, setDisplayReward] = useState(rewardDetails?.baseReward ?? 0);
  const [previousReward, setPreviousReward] = useState(null);
  const [isNegativeSwap, setIsNegativeSwap] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [activePopStepId, setActivePopStepId] = useState(/** @type string|null */(null));
  const [vibrateCounter, setVibrateCounter] = useState(false);
  const [vibrateMultiplier, setVibrateMultiplier] = useState(false);
  // 0 = keine, 1 = kurzes Vibrieren (500 Punkte), 2 = laengeres Vibrieren (800 Punkte)
  const [rewardCardShakeLevel, setRewardCardShakeLevel] = useState(0);
  const [rewardCardGlowActive, setRewardCardGlowActive] = useState(false);
  const shakeMilestoneReachedRef = useRef(false);
  const glowMilestoneReachedRef = useRef(false);
  const lastCheckedRewardRef = useRef(rewardDetails?.baseReward ?? 0);

  const [showResourceGains, setShowResourceGains] = useState(false);
  // Welcher Multiplikator-Schritt aktuell per Klick/Tap seine Erklaerung ausklappt.
  const [expandedStepId, setExpandedStepId] = useState(null);
  // Zeigt die Buttons erst nach Abschluss der Animationen und kurzer Wartezeit
  const [showButtons, setShowButtons] = useState(false);

  // Farbiger Impuls am Custom-Logo: bei jedem angewendeten Multiplikator (gold/lime) und
  // bei jedem erscheinenden PlantHealth-Badge (in dessen Stat-Farbe). nonce erzwingt einen
  // Remount des Pop-Wrappers, damit die Scale-Bounce-Animation jedes Mal neu abspielt.
  const [logoPulseColor, setLogoPulseColor] = useState(null);
  const [logoFeedbackNonce, setLogoFeedbackNonce] = useState(0);
  const logoFeedbackCounterRef = useRef(0);

  const triggerLogoFeedback = (color) => {
    logoFeedbackCounterRef.current += 1;
    setLogoPulseColor(color);
    setLogoFeedbackNonce(logoFeedbackCounterRef.current);
  };

  // Scrollt die Multiplikator-Liste an ihr Ende, sobald ein neuer Schritt sichtbar wird.
  const stepsScrollRef = useRef(null);
  useEffect(() => {
    const el = stepsScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleStepCount]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    setDisplayReward(rewardDetails?.baseReward ?? 0);
    setPreviousReward(null);
    setIsNegativeSwap(false);
    setActiveStepIndex(-1);
    setShowButtons(false);
    setRewardCardShakeLevel(0);
    setRewardCardGlowActive(false);
    setExpandedStepId(null);
    shakeMilestoneReachedRef.current = false;
    glowMilestoneReachedRef.current = false;
    lastCheckedRewardRef.current = rewardDetails?.baseReward ?? 0;
    if (!feedback) return;
    // Zeitgeber-Array leeren
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts = [];
    frameId = null;

    // Prueft, ob der aktuelle Punktestand die 500er/800er Schwelle ueberschreitet,
    // und loest dann Card-Vibration + Handy-Vibration (+ Glow ab 800) aus.
    const checkRewardMilestones = (nextValue) => {
      const previousValue = lastCheckedRewardRef.current;
      lastCheckedRewardRef.current = nextValue;

      if (
        !shakeMilestoneReachedRef.current &&
        previousValue < REWARD_MILESTONES.shake &&
        nextValue >= REWARD_MILESTONES.shake
      ) {
        shakeMilestoneReachedRef.current = true;
        setRewardCardShakeLevel(1);
        triggerDeviceVibration(70);
        timeouts.push(window.setTimeout(() => setRewardCardShakeLevel(0), 320));
      }

      if (
        !glowMilestoneReachedRef.current &&
        previousValue < REWARD_MILESTONES.glow &&
        nextValue >= REWARD_MILESTONES.glow
      ) {
        glowMilestoneReachedRef.current = true;
        setRewardCardShakeLevel(2);
        setRewardCardGlowActive(true);
        triggerDeviceVibration(220);
        timeouts.push(window.setTimeout(() => setRewardCardShakeLevel(0), 620));
      }
    };

    checkRewardMilestones(rewardDetails?.baseReward ?? 0);

    if (!rewardDetails || rewardSteps.length === 0) {
      if (hasResourceGains) {
        timeouts.push(
          window.setTimeout(() => {
            setShowResourceGains(true);
          }, 900)
        );
      }
      // Nach kurzer Zeit Buttons einblenden
      timeouts.push(
        window.setTimeout(() => {
          setShowButtons(true);
        }, 1200)
      );
      return () => {
        timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const animateCounter = (fromValue, toValue, durationMs, done) => {
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - startTime) / durationMs, 1);
        const nextValue = Math.round(fromValue + (toValue - fromValue) * progress);
        setDisplayReward(nextValue);
        checkRewardMilestones(nextValue);

        if (progress < 1) {
          frameId = window.requestAnimationFrame(tick);
          return;
        }

        setDisplayReward(toValue);
        done();
      };

      frameId = window.requestAnimationFrame(tick);
    };

    const runStep = (stepIndex, currentValue) => {
      if (stepIndex >= rewardSteps.length) {
        // Nach Abschluss der Multiplikator-Animationen: kurze Pause, dann Buttons einblenden
        if (hasResourceGains) {
          setShowResourceGains(true);
          timeouts.push(window.setTimeout(() => setShowButtons(true), 900));
        } else {
          timeouts.push(window.setTimeout(() => setShowButtons(true), 600));
        }
        return;
      }

      const step = rewardSteps[stepIndex];
      setActiveStepIndex(stepIndex);
      setVisibleStepCount(stepIndex + 1);
      setActivePopStepId(`${step.id}-${stepIndex}`);

      timeouts.push(window.setTimeout(() => setActivePopStepId(null), 260));

      if (step.positive) {
        setVibrateCounter(true);
        setVibrateMultiplier(true);

        triggerDeviceVibration(70);
        triggerLogoFeedback(MULTIPLIER_PULSE_COLOR);

        animateCounter(currentValue, step.result, 550, () => {
          setVibrateCounter(false);
          setVibrateMultiplier(false);
          timeouts.push(window.setTimeout(() => runStep(stepIndex + 1, step.result), 220));
        });
        return;
      }

      // Negative multipliers swap the number instead of vibrating/counting.
      setVibrateCounter(false);
      setVibrateMultiplier(false);
      setPreviousReward(currentValue);
      setDisplayReward(step.result);
      setIsNegativeSwap(true);
      checkRewardMilestones(step.result);

      timeouts.push(
        window.setTimeout(() => {
          setPreviousReward(null);
          setIsNegativeSwap(false);
          runStep(stepIndex + 1, step.result);
        }, 380)
      );
    };

    // Zeige zuerst die Ausgangszahl, dann nach kurzer Pause die Multiplikator-Animationen
    timeouts.push(window.setTimeout(() => runStep(0, rewardDetails.baseReward), 650));

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [feedback, hasResourceGains, rewardDetails, rewardSteps]);

  // Sobald die PlantHealth-Zusatzgewinne erscheinen, pulst das Logo nacheinander in der
  // Farbe jedes aktiven Stats (Datenqualitaet/Energie/Pflege), analog zum Streicheln-Effekt.
  useEffect(() => {
    if (!showResourceGains) return undefined;

    const activeStatColors = [];
    if (dataQualityDelta > 0) activeStatColors.push(PLANT_HEALTH_STAT_COLORS["data-quality"]);
    if (energyDelta > 0) activeStatColors.push(PLANT_HEALTH_STAT_COLORS.energy);
    if (scanStreak?.pflegeDelta > 0) activeStatColors.push(PLANT_HEALTH_STAT_COLORS.care);
    if (activeStatColors.length === 0) return undefined;

    const badgeTimeouts = activeStatColors.map((color, index) =>
      window.setTimeout(() => triggerLogoFeedback(color), index * 260)
    );
    return () => badgeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, [showResourceGains, dataQualityDelta, energyDelta, scanStreak?.pflegeDelta]);

  if (!feedback) return null;

  const { type, plantName, questTitle, rewardName } = feedback;

  let title = "Scan erfolgreich!";
  let containerClasses = "bg-black/55 border-[#f0e5a5]/35";
  let ringClasses = "bg-emerald-400/35";
  let counterClasses = "text-emerald-300";
  let titleClasses = "text-stone-100";
  let emojiSet = ["âœ¨", "âœ¨", "âœ¨"];
  let animationVariant = "rescanned";

  if (type === "rescanned") {
    title = plantName ? `${plantName} erneut gescannt` : "Pflanze erneut gescannt";
    ringClasses = "bg-emerald-300/35";
    emojiSet = ["âœ¨", "ðŸŒ¿", "âœ¨"];
  } else if (type === "newDiscovery") {
    title = plantName ? `${plantName} neu entdeckt!` : "Neue Pflanze entdeckt!";
    containerClasses = "bg-black/60 border-lime-200/35";
    ringClasses = "bg-lime-400/35";
    counterClasses = "text-lime-300";
    emojiSet = ["âœ¨", "ðŸŒ¿", "âœ¨", "ðŸŒ±"];
    animationVariant = "newDiscovery";
  } else if (type === "globalNewPlant") {
    title = plantName ? `${plantName} jetzt global verfuegbar!` : "Neue Pflanze global verfuegbar!";
    containerClasses = "bg-black/60 border-amber-200/35";
    ringClasses = "bg-amber-400/35";
    counterClasses = "text-amber-300";
    emojiSet = ["âœ¨", "ðŸŒŸ", "âœ¨", "ðŸŒ¼"];
    animationVariant = "globalNewPlant";
  } else if (type === "questCompleted") {
    title = questTitle ? `"${questTitle}" abgeschlossen!` : "Quest abgeschlossen!";
    if (rewardName) {
      title += ` Belohnung: ${rewardName}.`;
    }
    containerClasses = "bg-black/60 border-emerald-200/35";
    ringClasses = "bg-emerald-400/35";
    emojiSet = ["âœ¨", "ðŸŽ¯", "ðŸŽ", "âœ¨"];
    animationVariant = "newDiscovery";
  }

  const emojiPositions = emojiSet.map((_, index) => {
    const baseAngle = (index / emojiSet.length) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * (Math.PI / 6);
    const angle = baseAngle + jitter;
    const radius = 80;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius + 10;
    const targetY = y - 35;

    return { x, y, targetY };
  });

  const shareSnapshotStyle = shareSnapshotBackgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(6, 18, 10, 0.34) 0%, rgba(3, 10, 6, 0.74) 100%), url(${shareSnapshotBackgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : shareSnapshotBackgroundColor
      ? {
          background: `linear-gradient(160deg, ${shareSnapshotBackgroundColor} 0%, rgba(10, 20, 14, 0.92) 100%)`,
        }
      : null;

  const variants = {
    rescanned: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    },
    newDiscovery: {
      initial: { opacity: 0, scale: 0.7 },
      animate: { opacity: 1, scale: 1.05 },
      exit: { opacity: 0, scale: 0.9 },
    },
    globalNewPlant: {
      initial: { opacity: 0, scale: 0.6, rotate: -4 },
      animate: { opacity: 1, scale: 1.06, rotate: 0 },
      exit: { opacity: 0, scale: 0.9, rotate: 2 },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 pointer-events-auto"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="flex flex-col items-center w-full max-w-sm px-4">
        <motion.div
          ref={cardRef}
          variants={variants[String(animationVariant)]}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", damping: 16, stiffness: 260 }}
          className={`relative pointer-events-auto ${containerClasses} backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] border px-6 py-4 w-full flex flex-col items-center text-center overflow-hidden`}
          style={shareSnapshotStyle || undefined}
        >
          {shareSnapshotStyle && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-emerald-950/15 to-black/45 pointer-events-none" />
          <div className={`absolute -inset-px rounded-2xl opacity-40 blur-xl pointer-events-none ${ringClasses}`} />
          <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center w-full">
            <h3 className={`text-lg font-bold ${titleClasses}`}>{title}</h3>
          </div>

          {rewardDetails && (
            <motion.div
              className={`mt-4 w-full rounded-2xl bg-black/35 border border-[#f0e5a5]/30 px-4 pt-4 pb-5 shadow-sm ${
                rewardCardGlowActive ? "threat-glow-border threat-effect-level-4" : ""
              }`}
              style={rewardCardGlowActive ? { "--threat-glow-color": REWARD_MILESTONE_GLOW_COLOR } : undefined}
              animate={
                rewardCardShakeLevel === 2
                  ? { x: [0, -3.5, 3.5, -2.6, 2.6, -1.6, 1.6, 0] }
                  : rewardCardShakeLevel === 1
                    ? { x: [0, -2.4, 2.4, -1.6, 1.6, 0] }
                    : { x: 0 }
              }
              transition={
                rewardCardShakeLevel === 2
                  ? { duration: 0.5, ease: "easeInOut" }
                  : rewardCardShakeLevel === 1
                    ? { duration: 0.28, ease: "easeInOut" }
                    : { duration: 0.2 }
              }
            >
            <div
              className={`mb-2 flex w-full items-center gap-3 ${
                showResourceGains && hasResourceGains ? "justify-start" : "justify-center"
              }`}
            >
              <motion.div layout transition={{ duration: 0.32, ease: "easeOut" }} className="relative h-20 w-20 shrink-0">
                <motion.div
                  key={logoFeedbackNonce}
                  initial={{ scale: 1, rotate: 0 }}
                  animate={
                    logoFeedbackNonce
                      ? { scale: [1, 1.22, 0.9, 1.05, 1], rotate: [0, -3, 3, -1.5, 0] }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.46, ease: "easeOut" }}
                >
                  <FlorabotLogo
                    profile={profile}
                    logoAssets={logoAssets}
                    sizeClass="w-20 h-20"
                    padding="p-[6%]"
                  />
                </motion.div>
                <LogoImpulseRing color={logoPulseColor} nonce={logoFeedbackNonce} />
              </motion.div>

              <AnimatePresence>
                {showResourceGains && hasResourceGains && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="flex flex-1 flex-wrap content-start items-start gap-1.5"
                  >
                    {dataQualityDelta > 0 && (
                      <PlantHealthBadge
                        color={PLANT_HEALTH_STAT_COLORS["data-quality"]}
                        label={`Datenqualität +${dataQualityDelta}`}
                      />
                    )}
                    {energyDelta > 0 && (
                      <PlantHealthBadge color={PLANT_HEALTH_STAT_COLORS.energy} label={`Energie +${energyDelta}`} />
                    )}
                    {scanStreak?.pflegeDelta > 0 && (
                      <PlantHealthBadge color={PLANT_HEALTH_STAT_COLORS.care} label={`Pflege +${scanStreak.pflegeDelta}`} />
                    )}
                    {scanStreak?.funkenDelta > 0 && (
                      <RainbowFrame>
                        <PlantHealthBadge
                          color="#f59e0b"
                          borderColor="#ffffff"
                          textColor="#ffffff"
                          label={`Funken +${scanStreak.funkenDelta}`}
                        />
                      </RainbowFrame>
                    )}
                    {scanStreak?.bernsteinDelta > 0 && (
                      <PlantHealthBadge color="#fb923c" label={`Bernstein +${scanStreak.bernsteinDelta}`} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {showResourceGains && hasScanStreakGains && (
              <div className="mb-2 w-full text-center text-[10px] text-emerald-100/70">
                Scan-Streak Tag {scanStreak.streakDays}
                {scanStreak.isBoundaryDay ? " - Wochen-Bonus!" : ""}
                {scanStreak.wasHardReset ? " (neu gestartet)" : ""}
              </div>
            )}

              <div className="relative min-h-[5rem] flex items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  {isNegativeSwap && previousReward !== null ? (
                    <motion.div
                      key={`old-${previousReward}`}
                      initial={{ y: 0, opacity: 1 }}
                      animate={{ y: -32, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.24, ease: "easeInOut" }}
                      className={`absolute text-5xl font-black tracking-tight leading-none ${counterClasses}`}
                    >
                      {previousReward}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <motion.div
                  key={`new-${displayReward}-${isNegativeSwap ? "swap" : "count"}`}
                  initial={isNegativeSwap ? { y: 28, opacity: 0 } : false}
                  animate={
                    vibrateCounter
                      ? { y: 0, x: [0, -1.4, 1.4, -1, 1, 0], opacity: 1 }
                      : { y: 0, x: 0, opacity: 1 }
                  }
                  transition={
                    vibrateCounter
                      ? { duration: 0.18, repeat: Infinity, ease: "linear" }
                      : { duration: 0.26, ease: "easeOut" }
                  }
                  className={`relative text-5xl font-black tracking-tight leading-none ${counterClasses}`}
                  style={COUNTER_OUTLINE_STYLE}
                >
                  {displayReward}
                </motion.div>
              </div>

              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-stone-300">Seeds</div>

              {rewardSteps.length > 0 && (
                <div className="relative mt-4">
                  <div
                    ref={stepsScrollRef}
                    className="max-h-[min(11rem,24vh)] space-y-2 overflow-y-auto overscroll-contain pr-1 text-left"
                  >
                    {rewardSteps.slice(0, visibleStepCount).map((step, index) => {
                      const isActive = index === activeStepIndex;
                      const popKey = `${step.id}-${index}`;
                      const tooltipText = MULTIPLIER_STEP_TOOLTIPS[step.id] || null;
                      const isExpanded = expandedStepId === step.id;
                      return (
                        <div key={step.id}>
                          <motion.button
                            type="button"
                            onClick={() => tooltipText && setExpandedStepId(isExpanded ? null : step.id)}
                            initial={{ opacity: 0, y: 8, scale: 1.25 }}
                            animate={{ opacity: 1, y: 0, scale: isActive ? 1 : 0.94 }}
                            transition={{ type: "spring", stiffness: 280, damping: 20 }}
                            className={`flex w-full items-center justify-between rounded-xl text-left text-sm transition-colors ${
                              isActive ? "px-3 py-2" : "px-2.5 py-1.5 text-[13px] opacity-90"
                            } ${tooltipText ? "cursor-pointer" : ""} ${
                              isActive ? "bg-stone-900/95 text-white" : "bg-black/40 text-stone-200 border border-[#f0e5a5]/20 hover:bg-black/55"
                            }`}
                          >
                            <span className="font-semibold">{step.label}</span>
                            <div className="relative">
                              {activePopStepId === popKey && (
                                <motion.span
                                  initial={{ scale: 0.2, opacity: 0 }}
                                  animate={{ scale: [0.2, 1.25, 1], opacity: [0, 0.85, 0] }}
                                  transition={{ duration: 0.3, ease: "easeOut" }}
                                  className={`absolute inset-0 flex items-center justify-center font-black ${
                                    step.positive ? "text-lime-300/90" : "text-rose-400/90"
                                  }`}
                                  aria-hidden="true"
                                >
                                  {step.displayValue || `x${formatMultiplier(step.multiplier)}`}
                                </motion.span>
                              )}
                              <motion.span
                                animate={
                                  isActive && step.positive && vibrateMultiplier
                                    ? { x: [0, -0.9, 0.9, -0.6, 0.6, 0] }
                                    : { x: 0 }
                                }
                                transition={
                                  isActive && step.positive && vibrateMultiplier
                                    ? { duration: 0.14, repeat: Infinity, ease: "linear" }
                                    : { duration: 0.16 }
                                }
                                className={`relative z-10 font-bold ${
                                  step.positive ? "text-lime-300" : isActive ? "text-amber-200" : "text-rose-500"
                                }`}
                              >
                                {step.displayValue || `x${formatMultiplier(step.multiplier)}`}
                              </motion.span>
                            </div>
                          </motion.button>
                          <AnimatePresence>
                            {isExpanded && tooltipText && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <div className="mt-1 rounded-lg border border-[#f0e5a5]/25 bg-black/60 px-3 py-2 text-xs text-stone-100">
                                  {tooltipText}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-5 rounded-t-xl bg-gradient-to-b from-black/40 to-transparent" />
                </div>
              )}
            </motion.div>
          )}
          {emojiSet.map((emoji, index) => {
            const { x, y, targetY } = emojiPositions[index] || { x: 0, y: 40, targetY: 5 };

            let delayBase = 0.12;
            if (animationVariant === "newDiscovery") delayBase = 0.08;
            if (animationVariant === "globalNewPlant") delayBase = 0.05;

            let scaleKeyframes = [0, 1.05, 0.85, 0];
            if (animationVariant === "rescanned") {
              scaleKeyframes = [0, 0.95, 0.85, 0];
            } else if (animationVariant === "globalNewPlant") {
              scaleKeyframes = [0, 1.3, 0.9, 0];
            }

            return (
              <motion.div
                key={`${emoji}-${index}`}
                initial={{ opacity: 0, scale: 0, x, y }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: scaleKeyframes,
                  x,
                  y: [y, (y + targetY) / 2, targetY],
                }}
                transition={{
                  duration: animationVariant === "rescanned" ? 0.7 : 1.0,
                  delay: delayBase + index * 0.06,
                  ease: "easeOut",
                }}
                className="absolute inset-0 flex items-center justify-center text-xl select-none"
                style={{ transformOrigin: "center" }}
              >
                <span>{emoji}</span>
              </motion.div>
            );
          })}
        </motion.div>
        {/* Buttons jetzt auÃŸerhalb des Containers, direkt darunter */}
        {showButtons && (
          <div className="mt-5 flex flex-row gap-3 w-full justify-center">
            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold shadow border border-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setShowButtons(false);
                window.setTimeout(() => {
                  if (onCompleteRef.current) {
                    onCompleteRef.current();
                  }
                }, 120);
              }}
            >
              Okay
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-base font-semibold shadow border border-amber-600 flex items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleNativeShare(cardRef, {
                  plantName: feedback?.plantName,
                  rewardDetails,
                });
              }}
              title="Teilen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3A2.25 2.25 0 008.25 5.25V9m7.5 6v3.75A2.25 2.25 0 0113.5 21h-3a2.25 2.25 0 01-2.25-2.25V15m10.5-3H17.25m-10.5 0H6.75m7.5 0a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Teilen
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

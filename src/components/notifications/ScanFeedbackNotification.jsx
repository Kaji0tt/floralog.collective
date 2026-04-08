import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const formatMultiplier = (value) => {
  const safeValue = Number(value ?? 1);
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(2);
};

const COUNTER_OUTLINE_STYLE = {
  textShadow:
    "-2px 0 #111827, 2px 0 #111827, 0 -2px #111827, 0 2px #111827, -2px -2px #111827, 2px 2px #111827, -2px 2px #111827, 2px -2px #111827",
};

const buildRewardSteps = (rewardDetails, isInActiveZone) => {
  if (!rewardDetails) {
    return [];
  }

  const preStreakSteps = [];
  let runningReward = rewardDetails.baseReward;

  const pushPreStreakStep = (id, label, multiplier) => {
    if (multiplier === 1) {
      return;
    }

    runningReward *= multiplier;
    preStreakSteps.push({
      id,
      label,
      multiplier,
      result: Math.round(runningReward),
      positive: multiplier > 1,
    });
  };

  const pushAdditiveStep = (id, label, delta) => {
    if (!delta) {
      return;
    }

    runningReward += delta;
    preStreakSteps.push({
      id,
      label,
      delta,
      result: Math.round(runningReward),
      positive: delta > 0,
      displayValue: `${delta > 0 ? "+" : ""}${delta}`,
    });
  };

  pushAdditiveStep("health", rewardDetails.healthStateLabel || "Zustand", rewardDetails.healthStateBonus);

  if (isInActiveZone) {
    pushPreStreakStep("zone", "Zone", rewardDetails.zoneMultiplier);
  }

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

  if (rewardDetails.streakMultiplier !== 1) {
    steps.push({
      id: "streak",
      label: "Streak",
      multiplier: rewardDetails.streakMultiplier,
      result: rewardDetails.finalReward,
      positive: rewardDetails.streakMultiplier > 1,
    });
  }

  return steps;
};

export default function ScanFeedbackNotification({ feedback, onComplete }) {
  const rewardDetails = feedback?.rewardDetails || null;
  const isInActiveZone = feedback?.isInActiveZone !== false;
  const rewardSteps = useMemo(
    () => buildRewardSteps(rewardDetails, isInActiveZone),
    [rewardDetails, isInActiveZone]
  );

  const [displayReward, setDisplayReward] = useState(rewardDetails?.baseReward ?? 0);
  const [previousReward, setPreviousReward] = useState(null);
  const [isNegativeSwap, setIsNegativeSwap] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [activePopStepId, setActivePopStepId] = useState(null);
  const [vibrateCounter, setVibrateCounter] = useState(false);
  const [vibrateMultiplier, setVibrateMultiplier] = useState(false);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    setDisplayReward(rewardDetails?.baseReward ?? 0);
    setPreviousReward(null);
    setIsNegativeSwap(false);
    setActiveStepIndex(-1);
    setVisibleStepCount(0);
    setActivePopStepId(null);
    setVibrateCounter(false);
    setVibrateMultiplier(false);

    const timeouts = [];
    let frameId = null;

    const finalize = (delayMs) => {
      timeouts.push(
        window.setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, delayMs)
      );
    };

    if (!rewardDetails || rewardSteps.length === 0) {
      finalize(2500);
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
        finalize(1500);
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

        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(70);
        }

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

      timeouts.push(
        window.setTimeout(() => {
          setPreviousReward(null);
          setIsNegativeSwap(false);
          runStep(stepIndex + 1, step.result);
        }, 380)
      );
    };

    timeouts.push(window.setTimeout(() => runStep(0, rewardDetails.baseReward), 650));

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [feedback, onComplete, rewardDetails, rewardSteps]);

  if (!feedback) return null;

  const { type, plantName, questTitle, rewardName } = feedback;

  let title = "Scan erfolgreich!";
  let message = "Dein Scan wurde gespeichert.";
  let containerClasses = "bg-black/55 border-[#f0e5a5]/35";
  let ringClasses = "bg-emerald-400/35";
  let counterClasses = "text-emerald-300";
  let messageClasses = "text-stone-200";
  let titleClasses = "text-stone-100";
  let emojiSet = ["✨", "✨", "✨"];
  let animationVariant = "rescanned";

  if (type === "rescanned") {
    title = "Erneut gescannt";
    message = plantName
      ? `${plantName} wurde erneut bestaetigt.`
      : "Deine Pflanze wurde erneut bestaetigt.";
    ringClasses = "bg-emerald-300/35";
    emojiSet = ["✨", "🌿", "✨"];
  } else if (type === "newDiscovery") {
    title = "Neue Entdeckung!";
    message = plantName
      ? `${plantName} wurde zu deinem Floralog hinzugefuegt.`
      : "Eine neue Pflanze wurde deinem Floralog hinzugefuegt.";
    containerClasses = "bg-black/60 border-lime-200/35";
    ringClasses = "bg-lime-400/35";
    counterClasses = "text-lime-300";
    emojiSet = ["✨", "🌿", "✨", "🌱"];
    animationVariant = "newDiscovery";
  } else if (type === "globalNewPlant") {
    title = "Globales Floralog erweitert!";
    message = plantName
      ? `${plantName} ist jetzt im globalen Floralog verfuegbar.`
      : "Eine neue Pflanze ist jetzt im globalen Floralog verfuegbar.";
    containerClasses = "bg-black/60 border-amber-200/35";
    ringClasses = "bg-amber-400/35";
    counterClasses = "text-amber-300";
    messageClasses = "text-stone-200";
    emojiSet = ["✨", "🌟", "✨", "🌼"];
    animationVariant = "globalNewPlant";
  } else if (type === "questCompleted") {
    title = "Quest abgeschlossen!";
    message = questTitle
      ? `Du hast "${questTitle}" erfolgreich abgeschlossen.`
      : "Du hast eine Quest erfolgreich abgeschlossen.";
    if (rewardName) {
      message += ` Belohnung: ${rewardName}.`;
    }
    containerClasses = "bg-black/60 border-emerald-200/35";
    ringClasses = "bg-emerald-400/35";
    emojiSet = ["✨", "🎯", "🎁", "✨"];
    animationVariant = "newDiscovery";
  }

  const emojiPositions = useMemo(() => {
    return emojiSet.map((_, index) => {
      const baseAngle = (index / emojiSet.length) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * (Math.PI / 6);
      const angle = baseAngle + jitter;
      const radius = 80;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius + 10;
      const targetY = y - 35;

      return { x, y, targetY };
    });
  }, [emojiSet]);

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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 pointer-events-none"
    >
      <motion.div
        variants={variants[animationVariant]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 16, stiffness: 260 }}
        className={`relative pointer-events-auto ${containerClasses} backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] border px-6 py-4 max-w-sm w-[90%] flex flex-col items-center text-center overflow-hidden`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-emerald-950/15 to-black/45 pointer-events-none" />
        <div className={`absolute -inset-px rounded-2xl opacity-40 blur-xl ${ringClasses}`} />
        <div className="absolute inset-0 border border-[#f0e5a5]/25 rounded-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center w-full">
          <h3 className={`text-lg font-bold mb-1 ${titleClasses}`}>{title}</h3>
          <p className={`text-sm ${messageClasses}`}>{message}</p>

          {rewardDetails && (
            <div className="mt-4 w-full rounded-2xl bg-black/35 border border-[#f0e5a5]/30 px-4 py-4 shadow-sm">
              <div className="relative min-h-[3.4rem] flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  {isNegativeSwap && previousReward !== null ? (
                    <motion.div
                      key={`old-${previousReward}`}
                      initial={{ y: 0, opacity: 1 }}
                      animate={{ y: -32, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.24, ease: "easeInOut" }}
                      className={`absolute text-5xl font-black tracking-tight ${counterClasses}`}
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
                  className={`relative text-5xl font-black tracking-tight ${counterClasses}`}
                  style={COUNTER_OUTLINE_STYLE}
                >
                  {displayReward}
                </motion.div>
              </div>

              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-stone-300">Seeds</div>

              {rewardSteps.length > 0 && (
                <div className="mt-4 space-y-2 text-left">
                  {rewardSteps.slice(0, visibleStepCount).map((step, index) => {
                    const isActive = index === activeStepIndex;
                    const popKey = `${step.id}-${index}`;
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 8, scale: 1.25 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 280, damping: 20 }}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                          isActive ? "bg-stone-900/95 text-white" : "bg-black/40 text-stone-200 border border-[#f0e5a5]/20"
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
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

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
    </motion.div>
  );
}

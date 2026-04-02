import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const formatMultiplier = (value) => {
  const safeValue = Number(value ?? 1);
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(2);
};

const buildRewardSteps = (rewardDetails, isInActiveZone) => {
  if (!rewardDetails) {
    return [];
  }

  const steps = [];
  let runningReward = rewardDetails.baseReward;

  const pushPreStreakStep = (id, label, multiplier, forcePreStreakReward = false) => {
    if (multiplier === 1) {
      return;
    }

    runningReward *= multiplier;
    steps.push({
      id,
      label,
      multiplier,
      result: forcePreStreakReward ? rewardDetails.preStreakReward : Math.round(runningReward),
      positive: multiplier > 1,
    });
  };

  if (isInActiveZone) {
    pushPreStreakStep("zone", "Zone", rewardDetails.zoneMultiplier);
  }

  pushPreStreakStep("novelty", "Neuheit", rewardDetails.noveltyMultiplier);
  pushPreStreakStep("care", "Pflege", rewardDetails.careMultiplier);
  pushPreStreakStep("energy", "Energie", rewardDetails.energyMultiplier, true);

  const visiblePreStreakSteps = steps.filter((step) => step.id !== "streak");
  if (visiblePreStreakSteps.length > 0) {
    visiblePreStreakSteps[visiblePreStreakSteps.length - 1].result = rewardDetails.preStreakReward;
  }

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
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [visibleStepCount, setVisibleStepCount] = useState(0);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    setDisplayReward(rewardDetails?.baseReward ?? 0);
    setActiveStepIndex(-1);
    setVisibleStepCount(0);

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

      if (step.positive && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(70);
      }

      animateCounter(currentValue, step.result, 550, () => {
        timeouts.push(window.setTimeout(() => runStep(stepIndex + 1, step.result), 220));
      });
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
  let containerClasses = "bg-emerald-50/95 border-emerald-200";
  let ringClasses = "bg-emerald-200";
  let counterClasses = "text-emerald-700";
  let emojiSet = ["✨", "✨", "✨"];
  let animationVariant = "rescanned";

  if (type === "rescanned") {
    title = "Erneut gescannt";
    message = plantName
      ? `${plantName} wurde erneut bestaetigt.`
      : "Deine Pflanze wurde erneut bestaetigt.";
    ringClasses = "bg-emerald-200/70";
    emojiSet = ["✨", "🌿", "✨"];
  } else if (type === "newDiscovery") {
    title = "Neue Entdeckung!";
    message = plantName
      ? `${plantName} wurde zu deinem Floralog hinzugefuegt.`
      : "Eine neue Pflanze wurde deinem Floralog hinzugefuegt.";
    containerClasses = "bg-emerald-50/95 border-emerald-300";
    ringClasses = "bg-emerald-300/80";
    counterClasses = "text-lime-700";
    emojiSet = ["✨", "🌿", "✨", "🌱"];
    animationVariant = "newDiscovery";
  } else if (type === "globalNewPlant") {
    title = "Globales Floralog erweitert!";
    message = plantName
      ? `${plantName} ist jetzt im globalen Floralog verfuegbar.`
      : "Eine neue Pflanze ist jetzt im globalen Floralog verfuegbar.";
    containerClasses = "bg-amber-50/95 border-amber-300";
    ringClasses = "bg-amber-300/80";
    counterClasses = "text-amber-700";
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
    containerClasses = "bg-emerald-50/95 border-emerald-300";
    ringClasses = "bg-emerald-300/80";
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
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      <motion.div
        variants={variants[animationVariant]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 16, stiffness: 260 }}
        className={`relative pointer-events-auto ${containerClasses} backdrop-blur-md rounded-2xl shadow-xl border px-6 py-5 max-w-sm w-[92%] flex flex-col items-center text-center`}
      >
        <div className={`absolute -inset-px rounded-2xl opacity-40 blur-xl ${ringClasses}`} />
        <div className="relative z-10 flex flex-col items-center w-full">
          <h3 className="text-lg font-bold text-stone-900 mb-1">{title}</h3>
          <p className="text-sm text-stone-700">{message}</p>

          {rewardDetails && (
            <div className="mt-4 w-full rounded-2xl bg-white/75 border border-white/80 px-4 py-4 shadow-sm">
              <div className={`text-5xl font-black tracking-tight ${counterClasses}`}>{displayReward}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-stone-500">Seeds</div>

              {rewardSteps.length > 0 && (
                <div className="mt-4 space-y-2 text-left">
                  {rewardSteps.slice(0, visibleStepCount).map((step, index) => {
                    const isActive = index === activeStepIndex;
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                          isActive ? "bg-stone-900 text-white" : "bg-white/80 text-stone-700"
                        }`}
                      >
                        <span className="font-semibold">{step.label}</span>
                        <span className={step.positive ? "text-lime-300" : isActive ? "text-amber-200" : "text-rose-500"}>
                          x{formatMultiplier(step.multiplier)}
                        </span>
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

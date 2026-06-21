import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomNormal(mean, standardDeviation) {
  let first = 0;
  let second = 0;
  while (first === 0) first = Math.random();
  while (second === 0) second = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return mean + gaussian * standardDeviation;
}

/**
 * Spawns a single shimmer particle that travels along the border perimeter.
 */
function useShellBorderSpark(index, active) {
  const [state, setState] = useState({
    visible: false,
    progress: 0,
    size: 4,
    durationS: 6,
    baseGlow: 0.12,
    peakGlow: 0.55,
    pulseTime: 0.5,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    if (!active) {
      setState((prev) => ({ ...prev, visible: false }));
      return undefined;
    }

    mountedRef.current = true;
    let timeoutId;

    const run = () => {
      if (!mountedRef.current) return;

      const durationS = clamp(randomNormal(7.5, 2.0), 4.5, 12.0);
      const startProgress = Math.random();

      setState({
        visible: true,
        progress: startProgress,
        size: randomBetween(2.5, 7.5),
        durationS,
        baseGlow: randomBetween(0.08, 0.18),
        peakGlow: randomBetween(0.4, 0.72),
        pulseTime: randomBetween(0.3, 0.7),
      });

      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, visible: false }));

        const nextDelay = 300 + Math.random() * 1600;
        timeoutId = setTimeout(run, nextDelay);
      }, durationS * 1000);
    };

    const initialDelay = index * 180 + Math.random() * 600;
    timeoutId = setTimeout(run, initialDelay);

    return () => {
      mountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, index]);

  return state;
}

/**
 * Converts a progress value (0-1) into a position on the border rectangle.
 * Uses percent-based positioning relative to the container.
 */
function progressToPosition(progress) {
  const p = ((progress % 1) + 1) % 1;
  // Perimeter segments: top (0-0.3), right (0.3-0.5), bottom (0.5-0.8), left (0.8-1.0)
  if (p < 0.3) {
    return { x: (p / 0.3) * 100, y: 0 };
  } else if (p < 0.5) {
    return { x: 100, y: ((p - 0.3) / 0.2) * 100 };
  } else if (p < 0.8) {
    return { x: (1 - (p - 0.5) / 0.3) * 100, y: 100 };
  } else {
    return { x: 0, y: (1 - (p - 0.8) / 0.2) * 100 };
  }
}

function ShellBorderSparkParticle({ index, active }) {
  const { visible, progress, size, durationS, baseGlow, peakGlow, pulseTime } =
    useShellBorderSpark(index, active);

  const startPos = progressToPosition(progress);
  const endPos = progressToPosition((progress + randomBetween(0.15, 0.35)) % 1);

  const earlySoftTime = Math.max(0.06, pulseTime - 0.1);
  const tailTime = clamp(pulseTime + 0.15, pulseTime + 0.05, 0.92);
  const opacityTimes = [0, earlySoftTime, pulseTime, tailTime, 1];
  const opacityFrames = [0, baseGlow * 0.6, peakGlow, baseGlow * 0.4, 0];
  const scaleFrames = [0.6, 0.85, 1.15, 0.9, 0.65];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${progress.toFixed(3)}-${index}`}
          initial={{
            opacity: 0,
            scale: 0.3,
            left: `${startPos.x}%`,
            top: `${startPos.y}%`,
          }}
          animate={{
            opacity: opacityFrames,
            scale: scaleFrames,
            left: `${endPos.x}%`,
            top: `${endPos.y}%`,
          }}
          transition={{ duration: durationS, ease: "easeInOut", times: opacityTimes }}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            marginLeft: `-${size / 2}px`,
            marginTop: `-${size / 2}px`,
            background:
              "radial-gradient(circle, rgba(255,252,230,0.97) 0%, rgba(240,229,165,0.88) 22%, rgba(200,172,98,0.55) 48%, rgba(240,229,165,0.2) 72%, transparent 100%)",
            boxShadow: `0 0 ${size * 1.4}px rgba(240,229,165,0.7), 0 0 ${size * 3.5}px rgba(200,172,98,${baseGlow}), 0 0 ${size * 6}px rgba(240,229,165,0.18)`,
            filter: `blur(${Math.max(0.12, size * 0.035)}px)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}

/**
 * Animated shimmer glow overlay for the home shell border.
 * Renders a rotating conic gradient that creates a sweeping light effect.
 */
function ShellBorderShimmerOverlay({ active }) {
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none rounded-[2rem] overflow-hidden"
      style={{ zIndex: 2 }}
    >
      {/* Rotating conic shimmer */}
      <motion.div
        className="absolute inset-[-2px] rounded-[2rem]"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, ease: "linear", repeat: Infinity }}
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, rgba(240,229,165,0.35) 8%, rgba(255,252,230,0.55) 12%, rgba(240,229,165,0.35) 16%, transparent 24%, transparent 50%, rgba(200,172,98,0.28) 58%, rgba(255,252,230,0.45) 62%, rgba(200,172,98,0.28) 66%, transparent 74%, transparent 100%)",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "2px",
        }}
      />
      {/* Static ambient glow */}
      <div
        className="absolute inset-0 rounded-[2rem]"
        style={{
          boxShadow:
            "inset 0 0 18px rgba(240,229,165,0.12), 0 0 24px rgba(240,229,165,0.08), 0 0 48px rgba(200,172,98,0.05)",
        }}
      />
    </div>
  );
}

/**
 * HomeShellBorderGlow – renders sparkle particles and shimmer overlay
 * around the home shell border when the "shell_border_glow" profile effect is active.
 */
export default function HomeShellBorderGlow({ active = false, particleCount = 14 }) {
  if (!active) return null;

  return (
    <>
      <ShellBorderShimmerOverlay active={active} />
      <div
        className="absolute inset-0 pointer-events-none overflow-visible rounded-[2rem]"
        style={{ zIndex: 3 }}
      >
        {Array.from({ length: particleCount }, (_, idx) => (
          <ShellBorderSparkParticle key={`shell-spark-${idx}`} index={idx} active={active} />
        ))}
      </div>
    </>
  );
}

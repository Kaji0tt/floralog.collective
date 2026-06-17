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

function useThreatSpark(index, active) {
  const [state, setState] = useState({
    visible: false,
    x: 50,
    y: 30,
    size: 15,
    driftX1: 0,
    driftY1: 0,
    driftX2: 0,
    driftY2: 0,
    durationS: 8.4,
    baseGlow: 0.14,
    peakGlowA: 0.46,
    peakGlowB: 0.5,
    pulseTimeA: 0.4,
    pulseTimeB: 0.8,
    scalePeak: 7.245,
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

      const spawnY = randomBetween(0, 100);
      const durationS = clamp(randomNormal(8.8, 1.5), 6.2, 12.2);
      const pulseTimeA = randomBetween(0.3, 0.5);
      const pulseTimeB = clamp(randomBetween(0.68, 0.95), pulseTimeA + 0.2, 0.97);

      setState({
        visible: true,
        x: 6 + Math.random() * 88,
        y: spawnY,
        size: randomBetween(2.2, 9.8),
        driftX1: randomBetween(-3.9, 3.9),
        driftY1: randomBetween(-3.1, 3.1),
        driftX2: randomBetween(-6.1, 6.1),
        driftY2: randomBetween(-4.7, 4.7),
        durationS,
        baseGlow: randomBetween(0.1, 0.2),
        peakGlowA: randomBetween(0.38, 0.64),
        peakGlowB: randomBetween(0.42, 0.68),
        pulseTimeA,
        pulseTimeB,
        scalePeak: randomBetween(1.02, 1.12),
      });

      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, visible: false }));

        const nextDelay = 420 + Math.random() * 1800;
        timeoutId = setTimeout(run, nextDelay);
      }, durationS * 1000);
    };

    const initialDelay = index * 120 + Math.random() * 460;
    timeoutId = setTimeout(run, initialDelay);

    return () => {
      mountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, index]);

  return state;
}

function ThreatSparkParticle({ index, active }) {
  const {
    visible,
    x,
    y,
    size,
    driftX1,
    driftY1,
    driftX2,
    driftY2,
    durationS,
    baseGlow,
    peakGlowA,
    peakGlowB,
    pulseTimeA,
    pulseTimeB,
    scalePeak,
  } = useThreatSpark(index, active);

  const earlySoftTime = Math.max(0.08, pulseTimeA - 0.09);
  const betweenPulseTime = clamp((pulseTimeA + pulseTimeB) / 2, pulseTimeA + 0.06, pulseTimeB - 0.06);
  const tailTime = clamp(pulseTimeB + 0.08, pulseTimeB + 0.04, 0.95);
  const opacityTimes = [0, earlySoftTime, pulseTimeA, betweenPulseTime, pulseTimeB, tailTime, 1];
  const opacityFrames = [0, baseGlow * 0.75, peakGlowA, baseGlow * 0.52, peakGlowB, baseGlow * 0.35, 0];
  const scaleFrames = [0.72, 0.9, scalePeak, 0.92, scalePeak * 1.02, 0.86, 0.74];
  const xFrames = [0, driftX1 * 0.34, driftX1, driftX1 * 0.52, driftX2, driftX2 * 0.8, driftX2 * 0.65];
  const yFrames = [0, driftY1 * 0.34, driftY1, driftY1 * 0.52, driftY2, driftY2 * 0.8, driftY2 * 0.65];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${x.toFixed(1)}-${y.toFixed(1)}`}
          initial={{ opacity: 0, scale: 0.25, x: 0, y: 0 }}
          animate={{
            opacity: opacityFrames,
            scale: scaleFrames,
            x: xFrames,
            y: yFrames,
          }}
          transition={{ duration: durationS, ease: "easeInOut", times: opacityTimes }}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            marginLeft: `-${size / 2}px`,
            marginTop: `-${size / 2}px`,
            background:
              "radial-gradient(circle, rgba(255,245,245,0.96) 0%, rgba(255,168,168,0.92) 20%, rgba(255,92,92,0.55) 44%, rgba(255,56,56,0.22) 66%, rgba(255,42,42,0.08) 84%, transparent 100%)",
            boxShadow: `0 0 ${size * 1.3}px rgba(255,219,219,0.74), 0 0 ${size * 3.8}px rgba(255,98,98,${baseGlow}), 0 0 ${size * 6.8}px rgba(210,35,35,0.3)`,
            filter: `blur(${Math.max(0.14, size * 0.04)}px)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}

export default function ThreatLevelSparks({ active = false, count = 14, className = "" }) {
  if (!active || count <= 0) return null;

  return (
    <div className={`threat-spark-layer absolute inset-0 pointer-events-none overflow-visible ${className}`}>
      {Array.from({ length: count }, (_, idx) => (
        <ThreatSparkParticle key={`threat-spark-${idx}`} index={idx} active={active} />
      ))}
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const GUEST_BG_IMAGE_URL = new URL("../../../guestfunnel-bg.png", import.meta.url).href;
const GUEST_MG_IMAGE_URL = new URL("../../../guestfunnel-mg.png", import.meta.url).href;
const GUEST_FG_IMAGE_URL = new URL("../../../guestfunnel-fg.png", import.meta.url).href;
const FIREFLY_COUNT = 36;
const SNAP_SECTION_COUNT = 2;
const CONTENT_FADE_OUT_MS = 240;
const CONTENT_FADE_IN_MS = 360;

/**
 * @param {number} min
 * @param {number} max
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} mean
 * @param {number} standardDeviation
 */
function randomNormal(mean, standardDeviation) {
  let first = 0;
  let second = 0;

  while (first === 0) {
    first = Math.random();
  }

  while (second === 0) {
    second = Math.random();
  }

  const gaussian = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return mean + gaussian * standardDeviation;
}

/**
 * @param {number} index
 */
function useFirefly(index) {
  const [state, setState] = useState({
    visible: false,
    x: 50,
    y: 30,
    size: 5,
    driftX1: 0,
    driftY1: 0,
    driftX2: 0,
    driftY2: 0,
    durationS: 2.5,
    baseGlow: 0.2,
    peakGlowA: 0.7,
    peakGlowB: 0.75,
    pulseTimeA: 0.35,
    pulseTimeB: 0.72,
    scalePeak: 1.06,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;

    const run = () => {
      if (!mountedRef.current) return;
      const verticalBias = Math.pow(Math.random(), 1.85);
      const spawnY = 8 + verticalBias * 48;
      const sizeMultiplier = randomBetween(0.2 + verticalBias * 0.55, 1);
      const durationS = clamp(randomNormal(2.5, 0.9), 3, 7);
      const pulseTimeA = randomBetween(0.16, 0.46);
      const pulseTimeB = clamp(randomBetween(0.54, 0.9), pulseTimeA + 0.16, 0.93);
      const baseSizeMin = 3 + verticalBias * 5;
      const baseSizeMax = 6 + verticalBias * 9.5;

      setState({
        visible: true,
        x: 14 + Math.random() * 66,
        y: spawnY,
        size: randomBetween(baseSizeMin, baseSizeMax) * sizeMultiplier,
        driftX1: randomBetween(-4.8, 4.8),
        driftY1: randomBetween(-4.8, 4.8),
        driftX2: randomBetween(-8.4, 8.4),
        driftY2: randomBetween(-8.4, 8.4),
        durationS,
        baseGlow: randomBetween(0.14, 0.34),
        peakGlowA: randomBetween(0.7, 1),
        peakGlowB: randomBetween(0.7, 1),
        pulseTimeA,
        pulseTimeB,
        scalePeak: randomBetween(1.02, 1.22),
      });
      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, visible: false }));
        const nextDelay = 900 + Math.random() * 2200;
        timeoutId = setTimeout(run, nextDelay);
      }, durationS * 1000);
    };

    const initialDelay = index * 180 + Math.random() * 700;
    timeoutId = setTimeout(run, initialDelay);

    return () => {
      mountedRef.current = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [index]);

  return state;
}

/**
 * @param {{ index: number }} props
 */
function FireflyParticle({ index }) {
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
  } = useFirefly(index);

  const earlySoftTime = Math.max(0.08, pulseTimeA - 0.09);
  const betweenPulseTime = clamp((pulseTimeA + pulseTimeB) / 2, pulseTimeA + 0.06, pulseTimeB - 0.06);
  const tailTime = clamp(pulseTimeB + 0.08, pulseTimeB + 0.04, 0.94);
  const opacityTimes = [0, earlySoftTime, pulseTimeA, betweenPulseTime, pulseTimeB, tailTime, 1];
  const opacityFrames = [0, baseGlow, peakGlowA, baseGlow * 0.72, peakGlowB, baseGlow * 0.45, 0];
  const scaleFrames = [0.55, 0.9, scalePeak, 0.94, scalePeak * 1.04, 0.88, 0.72];
  const xFrames = [0, driftX1 * 0.35, driftX1, driftX1 * 0.55, driftX2, driftX2 * 0.82, driftX2 * 0.7];
  const yFrames = [0, driftY1 * 0.35, driftY1, driftY1 * 0.55, driftY2, driftY2 * 0.82, driftY2 * 0.7];

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
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(255,251,184,0.98) 0%, rgba(255,236,126,0.9) 18%, rgba(255,214,74,0.48) 42%, rgba(255,196,45,0.18) 64%, rgba(255,184,28,0.05) 82%, transparent 100%)",
            boxShadow: `0 0 ${size * 1.2}px rgba(255,245,175,0.65), 0 0 ${size * 3.8}px rgba(255,214,86,${baseGlow}), 0 0 ${size * 7}px rgba(255,184,28,0.22)`,
            filter: `blur(${Math.max(0.18, size * 0.04)}px)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}

export default function GuestHomeFlow() {
  const navigate = useNavigate();
  const snapContainerRef = useRef(null);
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);
  const [displayedSnapIndex, setDisplayedSnapIndex] = useState(0);
  const [contentTransitionPhase, setContentTransitionPhase] = useState("idle");
  const [parallaxScrollTop, setParallaxScrollTop] = useState(0);

  useEffect(() => {
    if (activeSnapIndex === displayedSnapIndex) {
      return;
    }

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let fadeInTimeoutId;
    setContentTransitionPhase("fading-out");

    const fadeOutTimeoutId = setTimeout(() => {
      setDisplayedSnapIndex(activeSnapIndex);
      setContentTransitionPhase("fading-in");

      fadeInTimeoutId = setTimeout(() => {
        setContentTransitionPhase("idle");
      }, CONTENT_FADE_IN_MS);
    }, CONTENT_FADE_OUT_MS);

    return () => {
      clearTimeout(fadeOutTimeoutId);
      if (fadeInTimeoutId) {
        clearTimeout(fadeInTimeoutId);
      }
    };
  }, [activeSnapIndex, displayedSnapIndex]);

  /** @param {React.UIEvent<HTMLDivElement>} event */
  const handleSnapScroll = (event) => {
    const container = event.currentTarget;
    const sectionHeight = Math.max(1, container.clientHeight);
    const nextIndex = Math.round(container.scrollTop / sectionHeight);
    setActiveSnapIndex(clamp(nextIndex, 0, SNAP_SECTION_COUNT - 1));
    setParallaxScrollTop(container.scrollTop);
  };

  /** @param {number} panelIndex */
  const getPanelOpacity = (panelIndex) => (
    displayedSnapIndex === panelIndex
      ? contentTransitionPhase === "fading-out"
        ? 0
        : 1
      : 0
  );

  const firstPanelOpacity = getPanelOpacity(0);
  const secondPanelOpacity = getPanelOpacity(1);

  const panelFadeDuration = contentTransitionPhase === "fading-out"
    ? CONTENT_FADE_OUT_MS / 1000
    : CONTENT_FADE_IN_MS / 1000;

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${GUEST_BG_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translate3d(0, ${(-parallaxScrollTop * 0.12).toFixed(2)}px, 0)`,
          willChange: "transform",
        }}
      />

      <div
        className="absolute inset-0 z-[6]"
        style={{
          backgroundImage: `url(${GUEST_MG_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translate3d(0, ${(-parallaxScrollTop * 0.24).toFixed(2)}px, 0)`,
          willChange: "transform",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-[16]"
        style={{
          height: "48%",
          background:
            "linear-gradient(to top, rgba(5,15,8,0.88) 0%, rgba(5,15,8,0.52) 45%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 pointer-events-none z-[10]">
        {Array.from({ length: FIREFLY_COUNT }, (_, i) => (
          <FireflyParticle key={i} index={i} />
        ))}
      </div>

      <div
        className="absolute inset-0 z-[14] pointer-events-none"
        style={{
          backgroundImage: `url(${GUEST_FG_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translate3d(0, ${(-parallaxScrollTop * 0.36).toFixed(2)}px, 0)`,
          willChange: "transform",
        }}
      />

      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-10 md:pt-14 px-4">
        <h1
          className="font-bold text-stone-50 uppercase text-center whitespace-nowrap drop-shadow-[0_2px_24px_rgba(0,0,0,0.65)]"
          style={{
            width: "95vw",
            maxWidth: "95vw",
            fontSize: "clamp(2.1rem, 8.9vw, 5.5rem)",
            letterSpacing: "clamp(0.2em, 0.62vw, 0.4em)",
            lineHeight: 1,
          }}
        >
          FLORALOG
        </h1>
        <p
          className="mt-2 rounded-full border border-amber-100/30 bg-black/18 px-4 py-1.5 text-amber-50/95 font-medium backdrop-blur-[2px]"
          style={{
            fontSize: "clamp(0.85rem, 3vw, 1.05rem)",
            letterSpacing: "0.1em",
            textShadow: "0 0 10px rgba(255,244,180,0.45), 0 1px 12px rgba(0,0,0,0.72)",
            boxShadow: "0 0 0 1px rgba(255,241,186,0.08), 0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          Dein Naturbegleiter
        </p>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-30 px-4"
        style={{ top: "57%" }}
      >
        <div className="relative flex h-full w-full justify-center overflow-visible">
          <div
            ref={snapContainerRef}
            onScroll={handleSnapScroll}
            className="absolute inset-0 mx-auto h-full w-full max-w-2xl overflow-y-auto snap-y snap-mandatory scroll-smooth opacity-0"
          >
            <section className="h-full min-h-full snap-start" />
            <section className="h-full min-h-full snap-start" />
          </div>

          <div className="relative h-full w-full max-w-2xl overflow-visible">
            <motion.div
              className="absolute inset-x-0 top-0 flex flex-col items-center gap-5 pt-[11%] md:pt-[10%]"
              animate={{ opacity: firstPanelOpacity }}
              transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
              style={{ pointerEvents: displayedSnapIndex === 0 && firstPanelOpacity > 0.01 ? "auto" : "none" }}
            >
              <motion.button
                onClick={() => navigate(createPageUrl("Scanner"))}
                className="rounded-2xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white font-semibold tracking-wide flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(34,197,94,0.35)] hover:brightness-110 transition-all"
                style={{
                  width: "70vw",
                  maxWidth: "420px",
                  height: "3.25rem",
                  fontSize: "1.1rem",
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Camera className="w-5 h-5" />
                Scan starten
              </motion.button>

              <button
                onClick={() => navigate("/register")}
                className="font-bold text-amber-200 hover:text-amber-100 transition-colors drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]"
                style={{
                  fontSize: "clamp(1rem, 4vw, 1.2rem)",
                  letterSpacing: "0.04em",
                }}
              >
                Kostenlos registrieren
              </button>

              <button
                onClick={() => navigate("/login")}
                className="font-medium text-stone-300/80 hover:text-stone-200 transition-colors drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
                style={{
                  fontSize: "clamp(0.85rem, 3vw, 1rem)",
                  letterSpacing: "0.03em",
                }}
              >
                Anmelden
              </button>
            </motion.div>

            <motion.div
              className="absolute inset-x-0 top-0 flex flex-col items-center pt-[11%] md:pt-[10%]"
              animate={{ opacity: secondPanelOpacity }}
              initial={false}
              transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
              style={{ pointerEvents: displayedSnapIndex === 1 && secondPanelOpacity > 0.01 ? "auto" : "none" }}
            >
              <div className="w-full max-w-xl rounded-3xl border border-amber-100/20 bg-black/24 px-5 py-5 backdrop-blur-[2px]">
                <p className="text-[0.73rem] uppercase tracking-[0.24em] text-amber-100/80">Floralog</p>
                <h2 className="mt-2 text-xl md:text-2xl font-semibold text-stone-100">Natur neu entdecken, spielerisch im Alltag.</h2>
                <p className="mt-3 text-sm md:text-base leading-relaxed text-stone-200/92">
                  Floralog verbindet Scanner, Entdeckergeist und echtes Naturwissen. Du lernst Pflanzen direkt vor deiner Haustuer kennen,
                  dokumentierst Funde und entwickelst Schritt fuer Schritt deinen eigenen Naturbegleiter weiter.
                </p>
                <p className="mt-3 text-sm md:text-base leading-relaxed text-stone-200/88">
                  Wische wieder nach unten fuer den schnellen Einstieg oder scrolle weiter, um tiefer in Vision und Features einzutauchen.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

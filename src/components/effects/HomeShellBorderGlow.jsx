import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// One full lap of the light sweep.
const SHIMMER_LAP_SECONDS = 8;
const PATH_SAMPLES = 12;

const SHIMMER_CONIC =
  "conic-gradient(from 0deg, rgba(200,172,98,0.08) 0%, rgba(240,229,165,0.85) 9%, rgba(255,252,230,1) 12%, rgba(240,229,165,0.85) 15%, rgba(200,172,98,0.08) 26%, rgba(200,172,98,0.08) 50%, rgba(200,172,98,0.75) 59%, rgba(255,252,230,0.95) 62%, rgba(200,172,98,0.75) 65%, rgba(200,172,98,0.08) 76%, rgba(200,172,98,0.08) 100%)";

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
 * Spawns a single shimmer particle that drifts along the border perimeter.
 */
function useShellBorderSpark(index, active) {
  const [state, setState] = useState({
    visible: false,
    progress: 0,
    travel: 0.25,
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

      setState({
        visible: true,
        progress: Math.random(),
        travel: randomBetween(0.15, 0.35),
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
  const { visible, progress, travel, size, durationS, baseGlow, peakGlow, pulseTime } =
    useShellBorderSpark(index, active);

  // Keyframes sampled along the perimeter so a spark turning a corner follows the
  // border instead of cutting straight across the surface.
  const path = useMemo(
    () => Array.from({ length: PATH_SAMPLES }, (_, step) => progressToPosition(progress + (travel * step) / (PATH_SAMPLES - 1))),
    [progress, travel]
  );

  const earlySoftTime = Math.max(0.06, pulseTime - 0.1);
  const tailTime = clamp(pulseTime + 0.15, pulseTime + 0.05, 0.92);
  const opacityTimes = [0, earlySoftTime, pulseTime, tailTime, 1];
  const opacityFrames = [0, baseGlow * 0.6, peakGlow, baseGlow * 0.4, 0];
  const scaleFrames = [0.6, 0.85, 1.15, 0.9, 0.65];
  const pathTransition = { duration: durationS, ease: "linear" };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${progress.toFixed(3)}-${index}`}
          initial={{
            opacity: 0,
            scale: 0.3,
            left: `${path[0].x}%`,
            top: `${path[0].y}%`,
          }}
          animate={{
            opacity: opacityFrames,
            scale: scaleFrames,
            left: path.map((point) => `${point.x}%`),
            top: path.map((point) => `${point.y}%`),
          }}
          transition={{
            default: { duration: durationS, ease: "easeInOut", times: opacityTimes },
            left: pathTransition,
            top: pathTransition,
          }}
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
 * Light sweep along the border. The masked ring itself stays fixed; only an oversized
 * conic gradient behind the mask rotates (same technique as CommunityEventGlowBorder),
 * so the border never visibly turns on non-square surfaces.
 */
function ShellBorderShimmerOverlay({ radius, borderWidth, reduceMotion }) {
  return (
    <>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: radius,
          padding: borderWidth,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
        }}
      >
        <motion.div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: "max(250%, 600px)",
            aspectRatio: "1 / 1",
            x: "-50%",
            y: "-50%",
            background: SHIMMER_CONIC,
          }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={reduceMotion ? undefined : { duration: SHIMMER_LAP_SECONDS, ease: "linear", repeat: Infinity }}
        />
      </div>
      {/* Static ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow: "inset 0 0 18px rgba(240,229,165,0.16), inset 0 0 42px rgba(200,172,98,0.08)",
        }}
      />
    </>
  );
}

/**
 * HomeShellBorderGlow – light sweep + sparkle particles along the border of the
 * surrounding `relative` container ("shell_border_glow" profile effect).
 */
export default function HomeShellBorderGlow({ active = false, particleCount = 14, radius = "2rem", borderWidth = 2 }) {
  const reduceMotion = useReducedMotion();
  if (!active) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 3, borderRadius: radius }}>
      <ShellBorderShimmerOverlay radius={radius} borderWidth={borderWidth} reduceMotion={reduceMotion} />
      {!reduceMotion && (
        <div className="absolute inset-0 overflow-visible" style={{ borderRadius: radius }}>
          {Array.from({ length: particleCount }, (_, idx) => (
            <ShellBorderSparkParticle key={`shell-spark-${idx}`} index={idx} active={active} />
          ))}
        </div>
      )}
    </div>
  );
}

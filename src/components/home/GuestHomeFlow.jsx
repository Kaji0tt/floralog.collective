import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { signIn, signUp } from "@/api/authService";
import { checkLegacyUser, upsertLegacyUserFromRegistration } from "@/api/migrationService";

const GUEST_BG_IMAGE_URL = new URL("../../../guestfunnel-bg.png", import.meta.url).href;
const GUEST_MG_IMAGE_URL = new URL("../../../guestfunnel-mg.png", import.meta.url).href;
const GUEST_FG_IMAGE_URL = new URL("../../../guestfunnel-fg.png", import.meta.url).href;
const SINGLE_LEAF_IMAGE_URL = new URL("../../../singleleaf.png", import.meta.url).href;
const FIREFLY_COUNT = 36;
const SNAP_SECTION_COUNT = 2;
const CONTENT_FADE_OUT_MS = 240;
const CONTENT_FADE_IN_MS = 360;
const TILT_MAX_HORIZONTAL_DEG = 22;
const TILT_MAX_VERTICAL_DEG = 28;
const TILT_OFFSET_MAX_X = 24;
const TILT_OFFSET_MAX_Y = 20;

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
      const spawnInLowerZone = Math.random() < 0.03;
      const upperZoneBias = Math.pow(Math.random(), 1.7);
      const spawnY = spawnInLowerZone
        ? randomBetween(35, 56)
        : 8 + upperZoneBias * 27;
      const durationS = clamp(randomNormal(2.5, 0.9), 3, 7);
      const pulseTimeA = randomBetween(0.16, 0.46);
      const pulseTimeB = clamp(randomBetween(0.54, 0.9), pulseTimeA + 0.16, 0.93);
      const baseSizeMin = 3;
      const baseSizeMax = 8.5;

      setState({
        visible: true,
        x: 14 + Math.random() * 66,
        y: spawnY,
        size: randomBetween(baseSizeMin, baseSizeMax),
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

function useLeafTwitch() {
  const [twitch, setTwitch] = useState({
    shiftX: 0,
    shiftY: 0,
    rotate: 0,
    scale: 1,
  });

  useEffect(() => {
    let isMounted = true;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;

    const schedule = () => {
      timeoutId = setTimeout(() => {
        if (!isMounted) {
          return;
        }

        const rotate = randomBetween(-7, 7);
        const shiftX = randomBetween(-4, 3);
        const shiftY = randomBetween(-2, 2);
        const scale = randomBetween(0.985, 1.03);

        setTwitch({ shiftX, shiftY, rotate, scale });
        schedule();
      }, randomBetween(4500, 12000));
    };

    schedule();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return twitch;
}

export default function GuestHomeFlow() {
  const gestureLockRef = useRef(false);
  const touchStartYRef = useRef(/** @type {number | null} */ (null));
  const orientationPermissionRequestedRef = useRef(false);
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);
  const [displayedSnapIndex, setDisplayedSnapIndex] = useState(0);
  const [contentTransitionPhase, setContentTransitionPhase] = useState("idle");
  const [tiltOffset, setTiltOffset] = useState({ x: 0, y: 0 });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(/** @type {string | null} */ (null));
  const [authSuccess, setAuthSuccess] = useState(/** @type {string | null} */ (null));
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
  });

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

  useEffect(() => {
    /** @param {number} gamma */
    const toTiltX = (gamma) => {
      const normalized = clamp(gamma / TILT_MAX_HORIZONTAL_DEG, -1, 1);
      return normalized * TILT_OFFSET_MAX_X;
    };

    /** @param {number} beta */
    const toTiltY = (beta) => {
      const centered = clamp((beta - 35) / TILT_MAX_VERTICAL_DEG, -1, 1);
      return centered * TILT_OFFSET_MAX_Y;
    };

    /** @param {DeviceOrientationEvent} event */
    const handleDeviceOrientation = (event) => {
      const nextX = toTiltX(event.gamma ?? 0);
      const nextY = toTiltY(event.beta ?? 35);
      setTiltOffset({ x: nextX, y: nextY });
    };

    /** @param {MouseEvent} event */
    const handleMouseMove = (event) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const normalizedX = clamp((event.clientX - centerX) / Math.max(centerX, 1), -1, 1);
      const normalizedY = clamp((event.clientY - centerY) / Math.max(centerY, 1), -1, 1);
      setTiltOffset({
        x: normalizedX * TILT_OFFSET_MAX_X,
        y: normalizedY * TILT_OFFSET_MAX_Y,
      });
    };

    window.addEventListener("deviceorientation", handleDeviceOrientation);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  /** @param {number} direction */
  const triggerSnapStep = (direction) => {
    if (gestureLockRef.current) {
      return;
    }

    const nextIndex = clamp(activeSnapIndex + direction, 0, SNAP_SECTION_COUNT - 1);
    if (nextIndex === activeSnapIndex) {
      return;
    }

    gestureLockRef.current = true;
    setActiveSnapIndex(nextIndex);

    window.setTimeout(() => {
      gestureLockRef.current = false;
    }, 540);
  };

  /** @param {React.WheelEvent<HTMLDivElement>} event */
  const handleGestureWheel = (event) => {
    if (Math.abs(event.deltaY) < 10) {
      return;
    }

    event.preventDefault();
    triggerSnapStep(event.deltaY > 0 ? 1 : -1);
  };

  /** @param {React.TouchEvent<HTMLDivElement>} event */
  const handleGestureTouchStart = (event) => {
    if (!orientationPermissionRequestedRef.current) {
      orientationPermissionRequestedRef.current = true;
      /** @type {{ requestPermission?: () => Promise<"granted" | "denied"> }} */
      const orientationCtor = /** @type {any} */ (window.DeviceOrientationEvent);
      if (orientationCtor && typeof orientationCtor.requestPermission === "function") {
        orientationCtor.requestPermission().catch(() => {
          // Ignore permission errors; fallback remains pointer-based movement.
        });
      }
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  /** @param {React.TouchEvent<HTMLDivElement>} event */
  const handleGestureTouchMove = (event) => {
    event.preventDefault();
  };

  /** @param {React.TouchEvent<HTMLDivElement>} event */
  const handleGestureTouchEnd = (event) => {
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartYRef.current = null;

    if (startY == null || endY == null) {
      return;
    }

    const deltaY = startY - endY;
    if (Math.abs(deltaY) < 26) {
      return;
    }

    triggerSnapStep(deltaY > 0 ? 1 : -1);
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
  const leafTwitch = useLeafTwitch();

  /** @param {"login" | "register"} mode */
  const openAuthModal = (mode) => {
    setAuthError(null);
    setAuthSuccess(null);
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(false);
  };

  /** @param {React.ChangeEvent<HTMLInputElement>} event */
  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setAuthError(null);
  };

  /** @param {React.FormEvent<HTMLFormElement>} event */
  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      if (authMode === "login") {
        const signInResult = await signIn(authForm.email, authForm.password);
        if (!signInResult?.session) {
          throw new Error("Anmeldung fehlgeschlagen. Bitte pruefe deine Zugangsdaten.");
        }

        closeAuthModal();
        window.location.assign("/");
        return;
      }

      if (!authForm.username.trim()) {
        throw new Error("Name ist erforderlich");
      }

      if (authForm.password !== authForm.confirmPassword) {
        throw new Error("Passwoerter stimmen nicht ueberein");
      }

      if (authForm.password.length < 6) {
        throw new Error("Passwort muss mindestens 6 Zeichen lang sein");
      }

      const legacyUser = await checkLegacyUser(authForm.email);
      if (legacyUser) {
        throw new Error("Diese E-Mail existiert bereits. Bitte melde dich an oder nutze die Migration.");
      }

      const signUpResult = await signUp(authForm.email, authForm.password, authForm.username);
      await upsertLegacyUserFromRegistration({
        email: authForm.email,
        displayName: authForm.username,
        authId: signUpResult?.user?.id || null,
      });

      setAuthSuccess("Fast geschafft: Bitte bestaetige jetzt deine E-Mail und melde dich danach an.");
      setAuthMode("login");
      setAuthForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const panelFadeDuration = contentTransitionPhase === "fading-out"
    ? CONTENT_FADE_OUT_MS / 1000
    : CONTENT_FADE_IN_MS / 1000;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#141a12]">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${GUEST_BG_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          willChange: "auto",
        }}
      />

      <div
        className="absolute inset-0 z-[6]"
        style={{
          backgroundImage: `url(${GUEST_MG_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translate3d(${(tiltOffset.x * 0.3).toFixed(2)}px, ${(tiltOffset.y * 0.3).toFixed(2)}px, 0) scale(1.08)`,
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
        className="absolute inset-0 z-[110] pointer-events-none"
        style={{
          backgroundImage: `url(${GUEST_FG_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translate3d(${(tiltOffset.x * 0.7).toFixed(2)}px, ${(tiltOffset.y * 0.7).toFixed(2)}px, 0) scale(1.16)`,
          willChange: "transform",
        }}
      />

      <div
        className="absolute inset-0 z-[111] pointer-events-none"
        style={{
          transform: `translate3d(${(tiltOffset.x * 0.7).toFixed(2)}px, ${(tiltOffset.y * 0.7).toFixed(2)}px, 0) scale(1.2)`,
          willChange: "transform",
        }}
      >
        <motion.img
          src={SINGLE_LEAF_IMAGE_URL}
          alt=""
          aria-hidden="true"
          className="absolute right-[-2vw] md:right-[-1vw]"
          style={{
            top: "53%",
            width: "clamp(144px, 26vw, 296px)",
            height: "auto",
            transformOrigin: "88% 12%",
            filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))",
          }}
          initial={false}
          animate={{
            x: [0, leafTwitch.shiftX * 0.45, leafTwitch.shiftX, leafTwitch.shiftX * -0.3, 0],
            y: [0, leafTwitch.shiftY * 0.4, leafTwitch.shiftY, leafTwitch.shiftY * -0.15, 0],
            rotate: [0, leafTwitch.rotate * 0.4, leafTwitch.rotate, leafTwitch.rotate * -0.24, 0],
            scale: [1, leafTwitch.scale, 1 + (leafTwitch.scale - 1) * 0.35, 1],
          }}
          transition={{ duration: 0.78, ease: "easeInOut" }}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-10 md:pt-14 px-4">
        <div className="relative w-[95vw] max-w-[95vw] flex justify-center">
          <div
            className="absolute inset-x-auto top-1/2 -translate-y-1/2 rounded-full border border-amber-100/30 bg-black/18 backdrop-blur-[2px]"
            style={{
              width: "min(74vw, 760px)",
              height: "clamp(2.8rem, 7.4vw, 4.4rem)",
              boxShadow: "0 0 0 1px rgba(255,241,186,0.08), 0 8px 24px rgba(0,0,0,0.18)",
            }}
            aria-hidden="true"
          />
          <h1
            className="relative font-bold text-stone-50 uppercase text-center whitespace-nowrap drop-shadow-[0_2px_24px_rgba(0,0,0,0.65)]"
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
        </div>
        <p
          className="mt-2 px-2 font-medium"
          style={{
            fontSize: "clamp(0.85rem, 3vw, 1.05rem)",
            letterSpacing: "0.4em",
            color: "#f5f8f2",
            textShadow:
              "1px 0 0 rgba(0,0,0,0.20), -1px 0 0 rgba(0,0,0,0.20), 0 1px 0 rgba(0,0,0,0.20), 0 -1px 0 rgba(0,0,0,0.20), 0 0 2px rgba(0,0,0,0.20)",
          }}
        >
          - Naturbegleiter -
        </p>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-30 px-4"
        style={{ top: "50%" }}
      >
        <div
          className="relative flex h-full w-full justify-center overflow-visible overscroll-none touch-none"
          onWheel={handleGestureWheel}
          onTouchStart={handleGestureTouchStart}
          onTouchMove={handleGestureTouchMove}
          onTouchEnd={handleGestureTouchEnd}
        >
          <div
            className="relative h-full w-full max-w-2xl overflow-visible pointer-events-none"
          >
            <motion.div
              className="absolute inset-x-0 top-0 flex flex-col items-center gap-5 pt-[11%] md:pt-[10%]"
              animate={{ opacity: firstPanelOpacity }}
              transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
              style={{ pointerEvents: displayedSnapIndex === 0 && firstPanelOpacity > 0.01 ? "auto" : "none" }}
            >
              <motion.button
                onClick={() => openAuthModal("register")}
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
                Jetzt Sammeln
              </motion.button>

              <button
                onClick={() => openAuthModal("login")}
                className="font-normal text-amber-200 hover:text-amber-100 transition-colors drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]"
                style={{
                  fontSize: "clamp(1rem, 4vw, 1.2rem)",
                  letterSpacing: "0.04em",
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
              <div className="w-[70vw] max-w-[420px] rounded-3xl border border-amber-100/20 bg-black/24 px-4 py-4 backdrop-blur-[2px] overflow-hidden">
                <p className="text-[0.73rem] uppercase tracking-[0.24em] text-amber-100/80">Floralog</p>
                <h2 className="mt-2 text-lg md:text-xl font-semibold text-stone-100 leading-tight">Natur spielerisch im Alltag entdecken.</h2>
                <p className="mt-2 text-sm md:text-base leading-relaxed text-stone-200/92">
                  Scanne Pflanzen, sammle Funde und entwickle deinen Naturbegleiter Schritt fuer Schritt weiter.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {authModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeAuthModal} />

          <div
            className="relative z-10 w-full max-w-[92vw] sm:max-w-md rounded-3xl border border-amber-100/30 bg-[linear-gradient(180deg,rgba(10,24,16,0.95)_0%,rgba(6,16,10,0.96)_100%)] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl p-5 pointer-events-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl border border-amber-100/15 pointer-events-none" />

            <button
              type="button"
              onClick={closeAuthModal}
              className="absolute right-4 top-3 text-stone-400 hover:text-stone-100"
            >
              ✕
            </button>

            <div className="relative z-10">
              <h3 className="text-xl font-semibold text-amber-50">
                {authMode === "login" ? "Anmelden" : "Kostenlos registrieren"}
              </h3>
              <p className="text-sm text-stone-300 mt-1">
                {authMode === "login"
                  ? "Melde dich an und sichere deinen Fortschritt in Floralog."
                  : "Erstelle deinen Account und starte direkt mit deinem Naturbegleiter."}
              </p>
            </div>

            <div className="relative z-10 mt-4 flex items-center gap-2 rounded-xl border border-amber-100/20 bg-black/25 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  authMode === "login" ? "bg-emerald-500/80 text-white" : "text-stone-300 hover:text-stone-100"
                }`}
              >
                Anmelden
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  authMode === "register" ? "bg-emerald-500/80 text-white" : "text-stone-300 hover:text-stone-100"
                }`}
              >
                Registrieren
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="relative z-10 space-y-3 mt-4">
              {authSuccess && (
                <div className="rounded-xl border border-emerald-300/35 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {authError && (
                <div className="rounded-xl border border-red-300/35 bg-red-900/30 px-3 py-2 text-sm text-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authMode === "register" && (
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Name</span>
                  <input
                    name="username"
                    type="text"
                    value={authForm.username}
                    onChange={handleAuthChange}
                    disabled={authLoading}
                    required
                    className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                    placeholder="Dein Name"
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-Mail</span>
                <input
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  disabled={authLoading}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="deine@email.de"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Passwort</span>
                <input
                  name="password"
                  type="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  disabled={authLoading}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="••••••••"
                />
              </label>

              {authMode === "register" && (
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Passwort bestaetigen</span>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={handleAuthChange}
                    disabled={authLoading}
                    required
                    className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                    placeholder="••••••••"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/85 via-emerald-500/75 to-emerald-700/85 py-2.5 text-white font-semibold hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {authMode === "login" ? "Anmelden" : "Jetzt registrieren"}
              </button>
            </form>
          </div>
        </div>
      )}

      <motion.div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[130] flex justify-center text-stone-100/80 select-none pointer-events-none"
        aria-hidden="true"
        animate={{ 
          y: [0, 4, 0], 
          opacity: displayedSnapIndex < SNAP_SECTION_COUNT - 1 ? [0.4, 0.8, 0.4] : 0
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "clamp(1rem, 4vw, 1.4rem)",
          height: "clamp(1rem, 4vw, 1.4rem)",
        }}
      >
        <ChevronDown className="h-full w-full" strokeWidth={2.4} />
      </motion.div>

      <div
        className="fixed bottom-0 inset-x-0 z-[130] flex flex-col items-center justify-center py-4"
      >
        <p
          className="text-center text-stone-300/40 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
          style={{
            fontSize: "clamp(0.55rem, 2vw, 0.7rem)",
            letterSpacing: "0.08em",
          }}
        >
          by Floralog Collective, enabled by Pl@ntNet
        </p>
      </div>
    </div>
  );
}

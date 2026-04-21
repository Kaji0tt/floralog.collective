import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { signIn, signUp } from "@/api/authService";
import { checkLegacyUser, upsertLegacyUserFromRegistration } from "@/api/migrationService";
import { supabase } from "@/api/supabaseClient";

const GUEST_BG_IMAGE_URL = new URL("../../../guestfunnel-bg.png", import.meta.url).href;
const GUEST_MG_IMAGE_URL = new URL("../../../guestfunnel-mg.png", import.meta.url).href;
const GUEST_FG_IMAGE_URL = new URL("../../../guestfunnel-fg.png", import.meta.url).href;
const SINGLE_LEAF_IMAGE_URL = new URL("../../../singleleaf.png", import.meta.url).href;
const FIREFLY_COUNT = 36;
const SNAP_SECTION_COUNT = 5;
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
  const navigate = useNavigate();
  const gestureLockRef = useRef(false);
  const touchStartYRef = useRef(/** @type {number | null} */ (null));
  const orientationPermissionRequestedRef = useRef(false);
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);
  const [displayedSnapIndex, setDisplayedSnapIndex] = useState(0);
  const [contentTransitionPhase, setContentTransitionPhase] = useState("idle");
  const [tiltOffset, setTiltOffset] = useState({ x: 0, y: 0 });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState(/** @type {"register" | "migration"} */ ("register"));
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(/** @type {string | null} */ (null));
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState(/** @type {string | null} */ (null));
  const [registerSuccess, setRegisterSuccess] = useState(/** @type {string | null} */ (null));
  const [migrateEmail, setMigrateEmail] = useState("");
  const [communityCardIndex, setCommunityCardIndex] = useState(0);
  const [communityStats, setCommunityStats] = useState(/** @type {{ active_researchers_this_month: number, total_species: number, total_scans: number } | null} */ (null));
  const communityCardTouchStartXRef = useRef(/** @type {number | null} */ (null));
  const communityCardTouchStartYRef = useRef(/** @type {number | null} */ (null));

  useEffect(() => {
    supabase.rpc("get_community_stats").then(({ data }) => {
      if (data) setCommunityStats(data);
    });
  }, []);

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

  /** @param {React.TouchEvent<HTMLDivElement>} event */
  const handleCommunityCardTouchStart = (event) => {
    const touch = event.touches[0];
    communityCardTouchStartXRef.current = touch?.clientX ?? null;
    communityCardTouchStartYRef.current = touch?.clientY ?? null;
    event.stopPropagation();
  };

  /** @param {React.TouchEvent<HTMLDivElement>} event */
  const handleCommunityCardTouchMove = (event) => {
    const startX = communityCardTouchStartXRef.current;
    const startY = communityCardTouchStartYRef.current;
    const currentTouch = event.touches[0];
    if (startX == null || startY == null || !currentTouch) {
      return;
    }

    const deltaX = currentTouch.clientX - startX;
    const deltaY = currentTouch.clientY - startY;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /** @param {React.TouchEvent<HTMLDivElement>} event */
  const handleCommunityCardTouchEnd = (event) => {
    const startX = communityCardTouchStartXRef.current;
    const startY = communityCardTouchStartYRef.current;
    const endTouch = event.changedTouches[0];
    communityCardTouchStartXRef.current = null;
    communityCardTouchStartYRef.current = null;

    if (startX == null || startY == null || !endTouch) {
      return;
    }

    const deltaX = endTouch.clientX - startX;
    const deltaY = endTouch.clientY - startY;
    if (Math.abs(deltaX) < 38 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    const direction = deltaX < 0 ? 1 : -1;
    setCommunityCardIndex((prev) => clamp(prev + direction, 0, 2));
    event.stopPropagation();
  };

  /** @param {number} panelIndex */
  const getPanelOpacity = (panelIndex) => (
    displayedSnapIndex === panelIndex
      ? contentTransitionPhase === "fading-out"
        ? 0
        : 1
      : 0
  );

  const panelOpacities = Array.from({ length: SNAP_SECTION_COUNT }, (_, index) => getPanelOpacity(index));
  const leafTwitch = useLeafTwitch();

  const openAuthModal = () => {
    setRegisterError(null);
    setRegisterSuccess(null);
    setAuthModalTab("register");
    setMigrateEmail("");
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterLoading(false);
    setAuthModalTab("register");
    setMigrateEmail("");
  };

  const openSupportModal = () => {
    setSupportModalOpen(true);
  };

  const closeSupportModal = () => {
    setSupportModalOpen(false);
  };

  /** @param {React.ChangeEvent<HTMLInputElement>} event */
  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLoginError(null);
    setRegisterError(null);
  };

  /** @param {React.FormEvent<HTMLFormElement>} event */
  const handleInlineLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const signInResult = await signIn(authForm.email, authForm.password);
      if (!signInResult?.session) {
        throw new Error("Anmeldung fehlgeschlagen. Bitte pruefe deine Zugangsdaten.");
      }

      window.location.assign("/");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  /** @param {React.FormEvent<HTMLFormElement>} event */
  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterLoading(true);

    try {
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

      setRegisterSuccess("Fast geschafft: Bitte bestaetige jetzt deine E-Mail und melde dich danach an.");
      setAuthForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
      setRegisterError(message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const panelFadeDuration = contentTransitionPhase === "fading-out"
    ? CONTENT_FADE_OUT_MS / 1000
    : CONTENT_FADE_IN_MS / 1000;

  const resolvedStats = [
    { label: "Aktive Forscher diesen Monat", value: communityStats ? communityStats.active_researchers_this_month.toLocaleString("de-DE") : "\u2026" },
    { label: "Entdeckte Arten insgesamt", value: communityStats ? communityStats.total_species.toLocaleString("de-DE") : "\u2026" },
    { label: "Anzahl aller Scans bisher", value: communityStats ? communityStats.total_scans.toLocaleString("de-DE") : "\u2026" },
  ];

  const infoPanelMotionClass = "absolute inset-x-0 bottom-[4.5rem] flex flex-col items-center px-2";
  const infoPanelCardClass = "w-[70vw] max-w-[420px] rounded-3xl border border-amber-100/20 bg-black/24 px-4 py-4 backdrop-blur-[2px]";
  const infoPanelScrollableCardClass = `${infoPanelCardClass} overflow-hidden max-h-[40vh] md:max-h-[42vh] overflow-y-auto`;
  const infoPanels = [
    {
      index: 1,
      sectionTitle: "Floralog",
      title: "Mit neuem Blick",
      description:
        "Floralog unterstützt spielerisch dabei, einen neuen Blick auf die Natur im Alltag zu entwickeln. Auf gemeinsamer Mission mit einem digitalen Begleiter, entwickelt sich ein neues Bewusstsein für die Umwelt.",
      scrollable: true,
      sectionTitleClass: "text-amber-100/80",
    },
    {
      index: 2,
      sectionTitle: "Florabot",
      title: "Erkundet die Natur",
      description:
        "Hilf deinem KI-Begleiter Florabot dabei, die Erde besser kennenzulernen indem ihr auf eine gemeinsame Suche nach einzigartigen Pflanzen geht. Lernt gemeinsam die Besonderheiten unseres Ökosystems kennen.",
      scrollable: true,
      sectionTitleClass: "text-amber-100/80",
    },
    {
      index: 4,
      sectionTitle: "Support the Project 🌱",
      title: "Hilf uns beim Keimen",
      description: "Floralog steht noch am Anfang. Mit jedem Scan und jeder abgeschlossenen Quest hilfst du uns bereits. Wer uns darüber hinaus unterstützen möchte,",
      scrollable: false,
      sectionTitleClass: "text-amber-400/90",
    },
  ];

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
          transform: `translate3d(${(tiltOffset.x * 0.15).toFixed(2)}px, ${(tiltOffset.y * 0.15).toFixed(2)}px, 0) scale(1.08)`,
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
            letterSpacing: "0.2em",
            color: "#f5f8f2",
            textShadow:
              "1px 0 0 rgba(0,0,0,0.20), -1px 0 0 rgba(0,0,0,0.20), 0 1px 0 rgba(0,0,0,0.20), 0 -1px 0 rgba(0,0,0,0.20), 0 0 2px rgba(0,0,0,0.20)",
          }}
        >
          - Dein Naturbegleiter -
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
              animate={{ opacity: panelOpacities[0] }}
              transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
              style={{ pointerEvents: displayedSnapIndex === 0 && panelOpacities[0] > 0.01 ? "auto" : "none" }}
            >
              {/* Anker: hält das Formular oberhalb des Chevrons */}
              <form
                onSubmit={handleInlineLoginSubmit}
                className="w-[70vw] max-w-[380px] space-y-2"
                style={{ paddingBottom: "clamp(3.5rem, 9vw, 5rem)" }}
              >
                {loginError && (
                  <div className="rounded-xl border border-red-300/35 bg-red-900/30 px-3 py-1.5 text-xs text-red-100 flex items-start gap-2 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <input
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  disabled={loginLoading}
                  required
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                  style={{
                    height: "2.4rem",
                    boxShadow: "inset 0 3px 10px rgba(0,0,0,0.55), inset 0 1px 4px rgba(0,0,0,0.4)",
                  }}
                  placeholder="E-Mail"
                />

                <input
                  name="password"
                  type="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  disabled={loginLoading}
                  required
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                  style={{
                    height: "2.4rem",
                    boxShadow: "inset 0 3px 10px rgba(0,0,0,0.55), inset 0 1px 4px rgba(0,0,0,0.4)",
                  }}
                  placeholder="Passwort"
                />

                <motion.button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-xl border border-lime-200/30 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white font-semibold tracking-wide flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(34,197,94,0.30)] hover:brightness-110 disabled:opacity-60 transition-all"
                  style={{ height: "2.4rem", fontSize: "0.95rem" }}
                  whileTap={{ scale: 0.97 }}
                >
                  {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  Anmelden
                </motion.button>

                <button
                  type="button"
                  onClick={openAuthModal}
                  className="w-full text-center font-normal text-stone-400/80 hover:text-stone-200 transition-colors"
                  style={{ fontSize: "0.82rem", letterSpacing: "0.03em", paddingTop: "0.15rem" }}
                >
                  Neu hier? Registrieren
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', { state: { email: authForm?.email } })}
                  className="w-full text-center font-normal text-stone-500/70 hover:text-stone-300 transition-colors"
                  style={{ fontSize: "0.78rem", letterSpacing: "0.03em" }}
                >
                  Passwort vergessen?
                </button>
              </form>
            </motion.div>

            {infoPanels.map((panel) => (
              <motion.div
                key={panel.index}
                className={infoPanelMotionClass}
                animate={{ opacity: panelOpacities[panel.index] }}
                initial={false}
                transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
                style={{
                  pointerEvents:
                    displayedSnapIndex === panel.index && panelOpacities[panel.index] > 0.01 ? "auto" : "none",
                }}
              >
                <div className={panel.scrollable ? infoPanelScrollableCardClass : infoPanelCardClass}>
                  <p className={`text-[0.73rem] uppercase tracking-[0.24em] ${panel.sectionTitleClass}`}>{panel.sectionTitle}</p>
                  <h2 className="mt-2 text-lg md:text-xl font-semibold text-stone-100 leading-tight">{panel.title}</h2>
                  {panel.index === 4 ? (
                    <p className="mt-2 text-sm md:text-base leading-relaxed text-amber-50/95">
                      {panel.description}{" "}
                      <button
                        type="button"
                        onClick={openSupportModal}
                        className="inline text-sm md:text-base text-stone-200/65 underline decoration-stone-300/45 underline-offset-4 hover:text-stone-100/90 hover:decoration-stone-200/65 transition-colors"
                      >
                        schaut hier vorbei
                      </button>
                      .
                    </p>
                  ) : (
                    <p className="mt-2 text-sm md:text-base leading-relaxed text-amber-50/95">{panel.description}</p>
                  )}
                  {panel.index === 4 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveSnapIndex(0)}
                        className="mt-3 inline-flex rounded-xl border border-rose-200/30 bg-rose-500/12 px-3 py-2 text-sm font-medium text-rose-100/90 hover:bg-rose-500/20 hover:text-rose-50 transition-colors"
                      >
                        Starte jetzt deine Reise ❤️
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}

            <motion.div
              className={infoPanelMotionClass}
              animate={{ opacity: panelOpacities[3] }}
              initial={false}
              transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
              style={{ pointerEvents: displayedSnapIndex === 3 && panelOpacities[3] > 0.01 ? "auto" : "none" }}
            >
              <div className={infoPanelCardClass}>
                <p className="text-[0.73rem] uppercase tracking-[0.24em] text-amber-100/80">Gemeinsam wachsen</p>
                <h2 className="mt-2 text-lg md:text-xl font-semibold text-stone-100 leading-tight">Werde Teil einer Community</h2>
                <p className="mt-2 text-sm md:text-base leading-relaxed text-amber-50/95">
                  Teile deine Funde, vergleiche Beobachtungen, entwickle und entdecke neue Kollektionen.
                </p>

                <div className="mt-3">
                  <div
                    className="relative overflow-hidden rounded-2xl border border-emerald-200/25 bg-emerald-950/45"
                    onTouchStart={handleCommunityCardTouchStart}
                    onTouchMove={handleCommunityCardTouchMove}
                    onTouchEnd={handleCommunityCardTouchEnd}
                  >
                    <motion.div
                      className="flex"
                      animate={{ x: `${-communityCardIndex * 100}%` }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                      {resolvedStats.map((card) => (
                        <div key={card.label} className="w-full shrink-0 px-3 py-3">
                          <p className="text-[0.68rem] uppercase tracking-[0.16em] text-amber-100/75">Community-Status</p>
                          <p className="mt-1 text-xl font-semibold text-amber-50 leading-tight">{card.value}</p>
                          <p className="mt-1 text-xs md:text-sm text-amber-50/90">{card.label}</p>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    {resolvedStats.map((card, index) => (
                      <button
                        key={card.label}
                        type="button"
                        onClick={() => setCommunityCardIndex(index)}
                        className={`h-1.5 w-1.5 rounded-full transition-all ${
                          communityCardIndex === index ? "bg-amber-100" : "bg-amber-100/35 hover:bg-amber-100/55"
                        }`}
                        aria-label={`Statistik ${index + 1} anzeigen`}
                      />
                    ))}
                  </div>
                </div>
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
              {/* Tab Switcher */}
              <div className="flex rounded-xl border border-amber-100/20 overflow-hidden mb-4">
                <button
                  type="button"
                  onClick={() => setAuthModalTab("register")}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                    authModalTab === "register"
                      ? "bg-emerald-700/70 text-white"
                      : "bg-black/20 text-stone-400 hover:text-stone-200"
                  }`}
                >
                  Registrieren
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalTab("migration")}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                    authModalTab === "migration"
                      ? "bg-emerald-700/70 text-white"
                      : "bg-black/20 text-stone-400 hover:text-stone-200"
                  }`}
                >
                  Migration
                </button>
              </div>

              {authModalTab === "register" && (
                <>
                  <h3 className="text-xl font-semibold text-amber-50">
                    Kostenlos registrieren
                  </h3>
                  <p className="text-sm text-stone-300 mt-1">
                    Erstelle deinen Account und starte direkt mit deinem Naturbegleiter.
                  </p>
                </>
              )}

              {authModalTab === "migration" && (
                <>
                  <h3 className="text-xl font-semibold text-amber-50">
                    Account migrieren
                  </h3>
                  <p className="text-sm text-stone-300 mt-1">
                    Du hattest bereits einen Floralog-Account? Gib deine E-Mail ein und starte die Migration.
                  </p>
                </>
              )}
            </div>

            {authModalTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="relative z-10 space-y-3 mt-4">
              {registerSuccess && (
                <div className="rounded-xl border border-emerald-300/35 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{registerSuccess}</span>
                </div>
              )}

              {registerError && (
                <div className="rounded-xl border border-red-300/35 bg-red-900/30 px-3 py-2 text-sm text-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Name</span>
                <input
                  name="username"
                  type="text"
                  value={authForm.username}
                  onChange={handleAuthChange}
                  disabled={registerLoading}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="Dein Name"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-Mail</span>
                <input
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  disabled={registerLoading}
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
                  disabled={registerLoading}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="••••••••"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Passwort bestaetigen</span>
                <input
                  name="confirmPassword"
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={handleAuthChange}
                  disabled={registerLoading}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                disabled={registerLoading}
                className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/85 via-emerald-500/75 to-emerald-700/85 py-2.5 text-white font-semibold hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {registerLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Jetzt registrieren
              </button>
            </form>
            )}

            {authModalTab === "migration" && (
            <div className="relative z-10 space-y-3 mt-4">
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-Mail</span>
                <input
                  type="email"
                  value={migrateEmail}
                  onChange={(e) => setMigrateEmail(e.target.value)}
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="deine@email.de"
                />
              </label>

              <button
                type="button"
                disabled={!migrateEmail}
                onClick={() => {
                  closeAuthModal();
                  navigate('/migrate', { state: { email: migrateEmail } });
                }}
                className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/85 via-emerald-500/75 to-emerald-700/85 py-2.5 text-white font-semibold hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                Migration starten
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {supportModalOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" onClick={closeSupportModal} />

          <div
            className="relative z-10 w-full max-w-[92vw] sm:max-w-lg rounded-3xl border border-amber-100/28 bg-[linear-gradient(180deg,rgba(15,25,18,0.95)_0%,rgba(8,16,11,0.96)_100%)] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl border border-amber-100/12 pointer-events-none" />

            <button
              type="button"
              onClick={closeSupportModal}
              className="absolute right-4 top-3 text-stone-400 hover:text-stone-100"
            >
              ✕
            </button>

            <div className="relative z-10">
              <p className="text-[0.73rem] uppercase tracking-[0.24em] text-amber-300/90">Support the Project 🌱</p>
              <h3 className="mt-2 text-xl font-semibold text-amber-50">Danke, dass ihr Floralog wachsen lasst</h3>
              <p className="mt-2 text-sm text-stone-300">
                Wir freuen uns über jede Form der Unterstützung.
              </p>
            </div>

            <div className="relative z-10 mt-4 grid gap-3">
              <div className="rounded-2xl border border-emerald-200/20 bg-emerald-900/20 p-3">
                <p className="text-sm font-semibold text-emerald-100">Für Privatpersonen</p>
                <p className="mt-1 text-sm text-stone-300">Durch eine finanzielle Unterstützung kannst du dabei helfen, Serverkosten und API-Kosten zu decken. <br />Und das wichtigste: Du zeigst, dass dir Floralog am Herzen liegt.</p>
                <a
                  href="/Donate?from=guest-funnel"
                  className="mt-2 inline-flex text-sm text-emerald-100/90 underline decoration-emerald-200/50 underline-offset-4 hover:text-emerald-50"
                >
                  Zur Spendenseite
                </a>
              </div>

              <div className="rounded-2xl border border-amber-200/20 bg-amber-900/15 p-3">
                <p className="text-sm font-semibold text-amber-100">Für Unternehmen</p>
                <p className="mt-1 text-sm text-stone-300">Für Kooperationen, Partnerschaften oder gemeinsame Projekte kontaktiert uns direkt.</p>
                <a
                  href="mailto:info@floralog.de?subject=Kooperation%20mit%20Floralog"
                  className="mt-2 inline-flex text-sm text-amber-100/90 underline decoration-amber-200/50 underline-offset-4 hover:text-amber-50"
                >
                  Kooperation anfragen
                </a>
              </div>
            </div>

            <div className="relative z-10 mt-4 text-center">
              <a
                href="mailto:info@floralog.de"
                className="text-sm text-stone-300/85 underline decoration-stone-300/45 underline-offset-4 hover:text-stone-100"
              >
                info@floralog.de
              </a>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {activeSnapIndex < SNAP_SECTION_COUNT - 1 && (
          <motion.div
            className="fixed left-1/2 bottom-[3.2rem] z-[120] -translate-x-1/2 text-stone-100/80 select-none pointer-events-none"
            aria-hidden="true"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0.4, 0.8, 0.4], y: [0, 4, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: "clamp(1rem, 4vw, 1.4rem)",
              height: "clamp(1rem, 4vw, 1.4rem)",
            }}
          >
            <ChevronDown className="h-full w-full" strokeWidth={2.4} />
          </motion.div>
        )}
      </AnimatePresence>

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
          by Floralog Collective, enabled with Pl@ntNet
        </p>
      </div>
    </div>
  );
}

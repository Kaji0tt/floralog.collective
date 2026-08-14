import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Download, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Info, FileText } from "lucide-react";
import { signIn, signUp, signInWithGoogle, updatePassword, getUserProfile } from "@/api/authService";
import { supabase } from "@/api/supabaseClient";
import { checkApkVersion } from "@/lib/apkVersionService";
import { Query } from "@/api/entities";
import CustomLogoAvatar from "@/components/profile/CustomLogoAvatar";
import GuestLogoCustomizerStep from "@/components/home/GuestLogoCustomizerStep";
import { readLastSignedInUserSnapshot, persistLastSignedInUserSnapshot } from "@/lib/lastSignedInUserStorage";
import { LOGO_ACCESSORY_DEFAULTS, resolveEquippedLogoAssets } from "@/lib/logoAccessoryAssets";
import { readGuestLogoCustomizationDraft, persistGuestLogoCustomizationDraft } from "@/lib/guestLogoCustomizationStorage";

const GUEST_BG_IMAGE_URL = new URL("../../../guestfunnel-bg.png", import.meta.url).href;
const GUEST_MG_IMAGE_URL = new URL("../../../guestfunnel-mg.png", import.meta.url).href;
const GUEST_FG_IMAGE_URL = new URL("../../../guestfunnel-fg.png", import.meta.url).href;
const SINGLE_LEAF_IMAGE_URL = new URL("../../../singleleaf.png", import.meta.url).href;

/** @param {{ className?: string }} props */
const GoogleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.44a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.58-5.15 3.58-8.79z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3c-1.07.72-2.45 1.14-4.09 1.14-3.14 0-5.8-2.12-6.75-4.97H1.27v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.25 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l3.98 3.1C6.2 6.87 8.86 4.75 12 4.75z" />
  </svg>
);

const FIREFLY_COUNT = 36;
const SNAP_SECTION_COUNT = 5;
const CONTENT_FADE_OUT_MS = 240;
const CONTENT_FADE_IN_MS = 360;
const TILT_MAX_HORIZONTAL_DEG = 22;
const TILT_MAX_VERTICAL_DEG = 28;
const TILT_OFFSET_MAX_X = 24;
const TILT_OFFSET_MAX_Y = 20;
const LAST_LOGIN_EMAIL_STORAGE_KEY = "floralog:lastLoginEmail";

const readLastLoginEmail = () => {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_LOGIN_EMAIL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const persistLastLoginEmail = (value) => {
  if (typeof window === "undefined") return;

  try {
    const normalizedEmail = String(value || "").trim();
    if (normalizedEmail) {
      window.localStorage.setItem(LAST_LOGIN_EMAIL_STORAGE_KEY, normalizedEmail);
    } else {
      window.localStorage.removeItem(LAST_LOGIN_EMAIL_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage failures (private mode, quotas, etc.)
  }
};


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
  const isNativeRuntime = (() => {
    if (typeof window === "undefined") return false;
    const runtimeWindow = /** @type {any} */ (window);
    return Boolean(runtimeWindow.Capacitor?.isNativePlatform?.());
  })();
  const gestureLockRef = useRef(false);
  const touchStartYRef = useRef(/** @type {number | null} */ (null));
  const orientationPermissionRequestedRef = useRef(false);
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);
  const [displayedSnapIndex, setDisplayedSnapIndex] = useState(0);
  const [contentTransitionPhase, setContentTransitionPhase] = useState("idle");
  const [tiltOffset, setTiltOffset] = useState({ x: 0, y: 0 });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [impressumModalOpen, setImpressumModalOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState(/** @type {string | null} */ (null));
  const [recoverySuccess, setRecoverySuccess] = useState(/** @type {string | null} */ (null));
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(/** @type {string | null} */ (null));
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState(/** @type {string | null} */ (null));
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [emailLoginOpen, setEmailLoginOpen] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(/** @type {string | null} */ (null));
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [lastSignedInUserSnapshot, setLastSignedInUserSnapshot] = useState(() => readLastSignedInUserSnapshot());
  const [guestLogoDraft, setGuestLogoDraft] = useState(() => {
    const stored = readGuestLogoCustomizationDraft();
    return {
      selected_face_asset: stored?.selected_face_asset || LOGO_ACCESSORY_DEFAULTS.selected_face_asset,
      selected_border_asset: stored?.selected_border_asset || LOGO_ACCESSORY_DEFAULTS.selected_border_asset,
      selected_border_color: stored?.selected_border_color ?? null,
    };
  });
  const [registerModalStep, setRegisterModalStep] = useState(/** @type {"customize" | "form"} */ ("customize"));
  const [communityCardIndex, setCommunityCardIndex] = useState(0);
  const [communityStats, setCommunityStats] = useState(/** @type {{ active_researchers_this_month: number, total_species: number, total_scans: number } | null} */ (null));
  const communityCardTouchStartXRef = useRef(/** @type {number | null} */ (null));
  const communityCardTouchStartYRef = useRef(/** @type {number | null} */ (null));

  // Login panel content vs. logo avatar: on small viewports the logo shrinks first
  // so the login content never gets squeezed behind the fixed footer bar.
  const DEFAULT_LOGIN_PANEL_TOP_PERCENT = 50;
  const MIN_LOGIN_PANEL_TOP_PERCENT = 22;
  const [loginPanelTopPercent, setLoginPanelTopPercent] = useState(DEFAULT_LOGIN_PANEL_TOP_PERCENT);
  const loginPanelContentRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const footerBarRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // APK update banner state (non-forced; forced updates are handled in HomeOtaGate)
  const [apkUpdateManifest, setApkUpdateManifest] = useState(/** @type {any|null} */ (null));
  const [apkBannerDismissed, setApkBannerDismissed] = useState(false);

  // Download modals
  const [androidDownloadModalOpen, setAndroidDownloadModalOpen] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [apkManifestForDownload, setApkManifestForDownload] = useState(/** @type {any|null} */ (null));

  useEffect(() => {
    supabase.rpc("get_community_stats").then(({ data }) => {
      if (data) setCommunityStats(data);
    });
  }, []);

  useEffect(() => {
    const base = (import.meta.env.VITE_APK_VERSION_URL || import.meta.env.VITE_OTA_VERSION_URL || 'https://floralog-ota.green-term-27d0.workers.dev/apk-version.json')
      .replace(/\/version\.json$/, '/apk-version.json');
    fetch(base)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.apk_url) setApkManifestForDownload(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNativeRuntime) return;
    checkApkVersion().then(({ isOutdated, isForcedUpdate, manifest }) => {
      // Forced updates are handled in HomeOtaGate; here we only show the soft banner
      if (isOutdated && !isForcedUpdate && manifest) {
        setApkUpdateManifest(manifest);
      }
    });
  }, [isNativeRuntime]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return undefined;
    }

    const viewport = window.visualViewport;
    const initialHeight = viewport.height;

    const handleViewportResize = () => {
      const keyboardLikelyOpen = initialHeight - viewport.height > 140;
      setIsKeyboardOpen(keyboardLikelyOpen);
    };

    viewport.addEventListener("resize", handleViewportResize);

    return () => {
      viewport.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  // Shrink the logo/avatar zone (never the login content) when the viewport
  // is too short to fit the login panel above the fixed footer bar.
  useEffect(() => {
    if (typeof window === "undefined" || isKeyboardOpen) {
      return undefined;
    }

    const SAFETY_MARGIN_PX = 12;
    let rafId = /** @type {number | null} */ (null);

    const recomputeLayout = () => {
      const panelEl = loginPanelContentRef.current;
      const footerEl = footerBarRef.current;
      if (!panelEl || !footerEl) return;

      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const panelBottom = panelEl.getBoundingClientRect().bottom;
      const footerTop = footerEl.getBoundingClientRect().top;
      const overlapPx = panelBottom - footerTop + SAFETY_MARGIN_PX;

      if (overlapPx <= 0) {
        setLoginPanelTopPercent(DEFAULT_LOGIN_PANEL_TOP_PERCENT);
        return;
      }

      const overlapPercent = (overlapPx / viewportHeight) * 100;
      const nextTopPercent = Math.max(
        MIN_LOGIN_PANEL_TOP_PERCENT,
        DEFAULT_LOGIN_PANEL_TOP_PERCENT - overlapPercent
      );
      setLoginPanelTopPercent(nextTopPercent);
    };

    const scheduleRecompute = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recomputeLayout);
    };

    scheduleRecompute();

    window.addEventListener("resize", scheduleRecompute);

    const resizeObserver = new ResizeObserver(scheduleRecompute);
    if (loginPanelContentRef.current) resizeObserver.observe(loginPanelContentRef.current);
    if (footerBarRef.current) resizeObserver.observe(footerBarRef.current);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleRecompute);
      resizeObserver.disconnect();
    };
  }, [isKeyboardOpen, emailLoginOpen, loginError, registerSuccess, apkUpdateManifest, apkBannerDismissed]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const hasRecoveryType = hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery";
    const hasAuthTokens = hashParams.has("access_token") && hashParams.has("refresh_token");
    const recoveryCode = queryParams.get("code");

    const normalizeRecoverySession = async () => {
      if (!(hasRecoveryType || hasAuthTokens || recoveryCode)) {
        return;
      }

      await supabase.auth.signOut({ scope: "local" }).catch(() => {});

      if (hasAuthTokens) {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      } else if (recoveryCode) {
        await supabase.auth.exchangeCodeForSession(recoveryCode);
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    };

    if (hasRecoveryType || hasAuthTokens || recoveryCode) {
      setRecoveryModalOpen(true);
    }

    normalizeRecoverySession().catch((error) => {
      console.error("Failed to normalize recovery session:", error);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && (hasRecoveryType || hasAuthTokens || recoveryCode) && !!session?.user)) {
        setRecoveryModalOpen(true);
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  const [authForm, setAuthForm] = useState({
    email: readLastLoginEmail(),
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
    setRegisterModalStep("customize");
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterLoading(false);
  };

  const updateGuestLogoDraft = (updates) => {
    setGuestLogoDraft((previousDraft) => {
      const nextDraft = { ...previousDraft, ...updates };
      persistGuestLogoCustomizationDraft(nextDraft);
      return nextDraft;
    });
  };

  const handleSelectGuestFace = (value) => updateGuestLogoDraft({ selected_face_asset: value });
  const handleSelectGuestBorder = (value) => updateGuestLogoDraft({ selected_border_asset: value });
  const handleSelectGuestBorderColor = (value) => updateGuestLogoDraft({ selected_border_color: value });

  const openSupportModal = () => {
    setSupportModalOpen(true);
  };

  const closeSupportModal = () => {
    setSupportModalOpen(false);
  };

  /** @param {React.ChangeEvent<HTMLInputElement>} event */
  const handleAuthChange = (event) => {
    const { name, value } = event.target;

    if (name === "email") {
      persistLastLoginEmail(value);
    }

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

      const authUser = signInResult.session.user;
      if (authUser?.id) {
        const [profile, logoAssetsCatalog] = await Promise.all([
          getUserProfile(authUser.id),
          Query.LogoAsset.list(),
        ]);

        const snapshot = persistLastSignedInUserSnapshot({
          authUser,
          profile,
          logoAssetsCatalog,
        });

        if (snapshot) {
          setLastSignedInUserSnapshot(snapshot);
        }
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

      await signUp(authForm.email, authForm.password, authForm.username);

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

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setRegisterError(null);
    setGoogleLoginLoading(true);

    try {
      // Web redirects immediately; native flow returns via appUrlOpen deep link.
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
      setLoginError(message);
      setGoogleLoginLoading(false);
    }
  };

  /** @param {React.FormEvent<HTMLFormElement>} event */
  const handleRecoverySubmit = async (event) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (recoveryPassword !== recoveryConfirmPassword) {
      setRecoveryError("Passwoerter stimmen nicht ueberein.");
      return;
    }

    if (recoveryPassword.length < 8) {
      setRecoveryError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    if (!/[a-z]/.test(recoveryPassword) || !/[A-Z]/.test(recoveryPassword) || !/\d/.test(recoveryPassword)) {
      setRecoveryError("Passwort muss Klein-, Grossbuchstaben und Zahlen enthalten.");
      return;
    }

    setRecoveryLoading(true);
    try {
      await updatePassword(recoveryPassword);
      setRecoverySuccess("Passwort wurde gespeichert. Du kannst dich jetzt anmelden.");
      setRecoveryPassword("");
      setRecoveryConfirmPassword("");
      window.history.replaceState({}, document.title, "/");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Passwort konnte nicht gespeichert werden. Bitte versuche es erneut.";
      setRecoveryError(message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleContinueBrowserLogin = () => {
    setRecoveryModalOpen(false);
    setRecoveryError(null);
  };

  const handleContinueAppLogin = () => {
    if (isNativeRuntime) {
      setRecoveryModalOpen(false);
      setRecoveryError(null);
      return;
    }

    setRecoveryError(null);
    window.location.assign("floralog://open");
    window.setTimeout(() => {
      setRecoveryError("Falls sich die App nicht geoeffnet hat: Bitte stelle sicher, dass Floralog installiert ist.");
    }, 1200);
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

      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center px-4" style={{ paddingTop: "clamp(0.6rem, 3vh, 1.75rem)" }}>
        <div className="relative w-[95vw] max-w-[95vw] flex justify-center">
          <div
            className="absolute inset-x-auto top-1/2 -translate-y-1/2 rounded-full border border-amber-100/30 bg-black/18 backdrop-blur-[2px]"
            style={{
              width: "clamp(2.8rem, min(7.4vw, 6.4vh), 4.4rem)",
              height: "clamp(2.8rem, min(7.4vw, 6.4vh), 4.4rem)",
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
        className="absolute inset-x-0 z-[18] flex items-center justify-center pointer-events-none px-6"
        style={{
          top: "clamp(4.5rem, 12vh, 7.5rem)",
          bottom: `${100 - loginPanelTopPercent}%`,
          minHeight: "3.5rem",
        }}
      >
        <CustomLogoAvatar
          logoAssets={lastSignedInUserSnapshot?.logoAssets || resolveEquippedLogoAssets(guestLogoDraft)}
          className="h-full w-full max-w-[78vw] max-h-full bg-transparent"
          innerClassName="scale-[1.62]"
          tooltipText={lastSignedInUserSnapshot?.displayName || lastSignedInUserSnapshot?.email || "Dein Naturbegleiter"}
          noClip
        />
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-30 px-4"
        style={{ top: `${loginPanelTopPercent}%` }}
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
              ref={loginPanelContentRef}
              className="absolute inset-x-0 top-0 flex flex-col items-center gap-5"
              animate={{ opacity: panelOpacities[0] }}
              transition={{ duration: panelFadeDuration, ease: "easeInOut" }}
              style={{
                pointerEvents: displayedSnapIndex === 0 && panelOpacities[0] > 0.01 ? "auto" : "none",
                paddingTop: "clamp(0.5rem, 3vh, 1.5rem)",
              }}
            >
              <form
                onSubmit={handleInlineLoginSubmit}
                className="w-[70vw] max-w-[380px] space-y-2"
                style={{ paddingBottom: "clamp(0.5rem, 2vh, 1rem)" }}
              >
                {loginError && (
                  <div className="rounded-xl border border-red-300/35 bg-red-900/30 px-3 py-1.5 text-xs text-red-100 flex items-start gap-2 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  {emailLoginOpen ? (
                    <motion.div
                      key="email-login-fields"
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="space-y-2"
                    >
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

                      <div className="flex items-center gap-2">
                        <motion.button
                          type="button"
                          onClick={() => setEmailLoginOpen(false)}
                          aria-label="Zurück zu Google-Login"
                          className="shrink-0 rounded-xl border border-lime-200/30 bg-gradient-to-br from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white flex items-center justify-center shadow-[0_6px_20px_rgba(34,197,94,0.30)] hover:brightness-110 transition-all"
                          style={{ height: "2.4rem", width: "2.4rem" }}
                          whileTap={{ scale: 0.93 }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </motion.button>

                        <motion.button
                          type="submit"
                          disabled={loginLoading}
                          className="flex-1 rounded-xl border border-lime-200/30 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white font-semibold tracking-wide flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(34,197,94,0.30)] hover:brightness-110 disabled:opacity-60 transition-all"
                          style={{ height: "2.4rem", fontSize: "0.95rem" }}
                          whileTap={{ scale: 0.97 }}
                        >
                          {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          Anmelden
                        </motion.button>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate('/forgot-password', { state: { email: authForm?.email } })}
                        className="w-full text-center font-normal text-stone-500/70 hover:text-stone-300 transition-colors"
                        style={{ fontSize: "0.78rem", letterSpacing: "0.03em" }}
                      >
                        Passwort vergessen?
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="google-login-button"
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={googleLoginLoading}
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full rounded-xl border border-lime-200/30 bg-gradient-to-r from-emerald-700/80 via-emerald-500/70 to-emerald-700/80 text-white font-semibold tracking-wide flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(34,197,94,0.30)] hover:brightness-110 disabled:opacity-60 transition-all"
                      style={{ height: "2.4rem", fontSize: "0.95rem" }}
                    >
                      {googleLoginLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <GoogleIcon className="w-4 h-4" />
                      )}
                      Mit Google anmelden
                    </motion.button>
                  )}
                </AnimatePresence>

                {!emailLoginOpen && (
                  <button
                    type="button"
                    onClick={() => setEmailLoginOpen(true)}
                    className="w-full text-center text-stone-400/80 hover:text-stone-200 transition-colors py-1"
                    style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}
                  >
                    oder mit E-Mail anmelden
                  </button>
                )}

                <button
                  type="button"
                  onClick={openAuthModal}
                  className="w-full text-center font-semibold text-amber-200/90 hover:text-amber-100 transition-colors py-1"
                  style={{ fontSize: "0.85rem" }}
                >
                  ✦ Neu hier? Registrieren ✦
                </button>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <a
                    href="https://play.google.com/store/apps/details?id=de.floralog.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-black/40 px-3 py-1.5 text-xs font-medium text-emerald-100/80 hover:bg-black/55 hover:text-emerald-50 transition-colors backdrop-blur-sm"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                      <path d="M17.523 15.34a.5.5 0 0 1-.5.5H6.977a.5.5 0 0 1-.5-.5V9.5h11.046v5.84zM7.5 18.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3.513 9.14l1.3-2.38A.5.5 0 0 1 5.25 6.5h13.5a.5.5 0 0 1 .437.26l1.3 2.38H3.513zM14.6 2.1l-1.5 2.6h-2.2L9.4 2.1a.4.4 0 0 1 .693-.4L11 3.5h2l.907-1.8a.4.4 0 0 1 .693.4z" />
                    </svg>
                    Android
                  </a>
                  <button
                    type="button"
                    onClick={() => setIosModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-stone-400/25 bg-black/40 px-3 py-1.5 text-xs font-medium text-stone-300/70 hover:bg-black/55 hover:text-stone-100 transition-colors backdrop-blur-sm"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    iOS
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => triggerSnapStep(1)}
                  className="mx-auto flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-black/35 px-3 py-1 text-[0.68rem] font-medium text-amber-100/70 hover:bg-black/50 hover:text-amber-50 transition-colors backdrop-blur-sm"
                >
                  <Info className="w-3 h-3" />
                  Über Floralog
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
              <h3 className="text-xl font-semibold text-amber-50">
                Kostenlos registrieren
              </h3>
              <p className="text-sm text-stone-300 mt-1">
                {registerModalStep === "customize"
                  ? "Gestalte zuerst deinen Naturbegleiter - Rahmen, Gesicht und Farbe."
                  : "Erstelle deinen Account und starte direkt mit deinem Naturbegleiter."}
              </p>
            </div>

            {registerModalStep === "customize" ? (
              <div className="relative z-10 mt-4">
                <GuestLogoCustomizerStep
                  draft={guestLogoDraft}
                  onSelectFace={handleSelectGuestFace}
                  onSelectBorder={handleSelectGuestBorder}
                  onSelectColor={handleSelectGuestBorderColor}
                  onContinue={() => setRegisterModalStep("form")}
                />
              </div>
            ) : (
            <form onSubmit={handleRegisterSubmit} className="relative z-10 space-y-3 mt-4">
              <button
                type="button"
                onClick={() => setRegisterModalStep("customize")}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-100/70 hover:text-amber-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Zurück zur Anpassung
              </button>

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
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Anzeigename</span>
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
                <p className="text-[0.72rem] text-stone-400 leading-snug pt-0.5">
                  Dieser Name ist in der App sichtbar und wird bei Bestenlisten &amp; Rewards auch auf Instagram unter{' '}
                  <a href="https://instagram.com/floralog.collective" target="_blank" rel="noopener noreferrer" className="text-pink-300/80 hover:text-pink-200 underline underline-offset-2">@floralog.collective</a>{' '}
                  angegeben.
                </p>
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

              <div className="flex items-center gap-2 py-0.5">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[0.68rem] uppercase tracking-[0.14em] text-stone-500">oder</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoginLoading}
                className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/85 via-emerald-500/75 to-emerald-700/85 py-2.5 text-white font-semibold hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {googleLoginLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GoogleIcon className="w-4 h-4" />
                )}
                Mit Google registrieren
              </button>
            </form>
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

      {recoveryModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" />

          <div
            className="relative z-10 w-full max-w-[92vw] sm:max-w-md rounded-3xl border border-amber-100/30 bg-[linear-gradient(180deg,rgba(10,24,16,0.95)_0%,rgba(6,16,10,0.96)_100%)] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl border border-amber-100/15 pointer-events-none" />

            <div className="relative z-10">
              <h3 className="text-xl font-semibold text-amber-50">Neues Passwort setzen</h3>
              <p className="text-sm text-stone-300 mt-1">
                Du bist ueber den E-Mail-Link angekommen. Vergib jetzt ein neues Passwort fuer deinen Account.
              </p>
            </div>

            <form onSubmit={handleRecoverySubmit} className="relative z-10 space-y-3 mt-4">
              {recoverySuccess && (
                <div className="rounded-xl border border-emerald-300/35 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{recoverySuccess}</span>
                </div>
              )}

              {recoveryError && (
                <div className="rounded-xl border border-red-300/35 bg-red-900/30 px-3 py-2 text-sm text-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{recoveryError}</span>
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Neues Passwort</span>
                <input
                  type="password"
                  value={recoveryPassword}
                  onChange={(event) => setRecoveryPassword(event.target.value)}
                  disabled={recoveryLoading || !!recoverySuccess}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="••••••••"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-amber-100/75 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Passwort bestaetigen</span>
                <input
                  type="password"
                  value={recoveryConfirmPassword}
                  onChange={(event) => setRecoveryConfirmPassword(event.target.value)}
                  disabled={recoveryLoading || !!recoverySuccess}
                  required
                  className="w-full rounded-xl border border-amber-100/25 bg-black/35 px-3 py-2.5 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/55"
                  placeholder="••••••••"
                />
              </label>

              <p className="text-xs text-stone-400/85">
                Anforderungen: mindestens 8 Zeichen, Klein-/Grossbuchstaben und Zahlen.
              </p>

              <button
                type="submit"
                disabled={recoveryLoading || !!recoverySuccess}
                className="w-full rounded-xl border border-lime-200/35 bg-gradient-to-r from-emerald-700/85 via-emerald-500/75 to-emerald-700/85 py-2.5 text-white font-semibold hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {recoveryLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Neues Passwort speichern
              </button>

              {recoverySuccess && (
                <div className="rounded-xl border border-amber-100/20 bg-black/25 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-100/75">Wie moechtest du weitermachen?</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleContinueBrowserLogin}
                      className="rounded-xl border border-emerald-200/35 bg-emerald-700/30 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-700/45 transition-colors"
                    >
                      Im Browser weiter
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueAppLogin}
                      className="rounded-xl border border-amber-200/35 bg-amber-700/20 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-700/30 transition-colors"
                    >
                      In App oeffnen
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setRecoveryModalOpen(false)}
                disabled={recoveryLoading}
                className="w-full rounded-xl border border-amber-100/20 bg-black/25 py-2.5 text-stone-200 hover:bg-black/35 disabled:opacity-60 transition-colors"
              >
                Spaeter
              </button>
            </form>
          </div>
        </div>
      )}

      <div
        ref={footerBarRef}
        className={`fixed bottom-0 inset-x-0 z-[130] flex flex-col items-center justify-center py-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-200 ${isKeyboardOpen ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100"}`}
      >
        {/* APK update banner – shown when a newer APK is available (soft, non-forced) */}
        {apkUpdateManifest && !apkBannerDismissed && (
          <div className="w-full max-w-md px-3 mb-2">
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/50 bg-black/70 px-4 py-2.5 backdrop-blur-md shadow-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-200 leading-snug">
                  Neue App-Version verfügbar
                </p>
                <p className="text-[0.68rem] text-stone-400 truncate">
                  v{apkUpdateManifest.version_name}
                  {apkUpdateManifest.release_notes ? ` – ${apkUpdateManifest.release_notes}` : ''}
                </p>
              </div>
              <a
                href={apkUpdateManifest.apk_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 active:bg-amber-600 transition-colors"
              >
                <Download className="w-3 h-3" />
                APK laden
              </a>
              <button
                type="button"
                onClick={() => setApkBannerDismissed(true)}
                className="text-stone-500 hover:text-stone-300 text-xs shrink-0 px-1"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <p
          className="text-center text-stone-300/40 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
          style={{
            fontSize: "clamp(0.55rem, 2vw, 0.7rem)",
            letterSpacing: "0.08em",
          }}
        >
          by{' '}
          <button
            type="button"
            onClick={() => setImpressumModalOpen(true)}
            className="inline text-stone-300/80 underline decoration-stone-300/45 underline-offset-4 hover:text-stone-100 transition-colors"
          >
            Floralog Collective
          </button>
          , enabled with{' '}
          <a
            href="https://identify.plantnet.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline text-stone-300/80 underline decoration-stone-300/45 underline-offset-4 hover:text-stone-100 transition-colors"
          >
            Pl@ntNet
          </a>
        </p>
      </div>
      {/* ── Android Download Modal ──────────────────────────────────── */}
      {androidDownloadModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" onClick={() => setAndroidDownloadModalOpen(false)} />
          <div
            className="relative z-10 w-full max-w-[92vw] sm:max-w-sm rounded-3xl border border-emerald-100/25 bg-[linear-gradient(180deg,rgba(8,22,14,0.97)_0%,rgba(4,14,8,0.98)_100%)] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl border border-emerald-100/10 pointer-events-none" />
            <button
              type="button"
              onClick={() => setAndroidDownloadModalOpen(false)}
              className="absolute top-3.5 right-3.5 z-20 text-stone-400 hover:text-stone-100 transition-colors"
              aria-label="Schließen"
            >
              ✕
            </button>
            <div className="relative z-10 flex flex-col items-center gap-3 pt-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-900/40">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-emerald-300" aria-hidden="true">
                  <path d="M17.523 15.34a.5.5 0 0 1-.5.5H6.977a.5.5 0 0 1-.5-.5V9.5h11.046v5.84zM7.5 18.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3.513 9.14l1.3-2.38A.5.5 0 0 1 5.25 6.5h13.5a.5.5 0 0 1 .437.26l1.3 2.38H3.513zM14.6 2.1l-1.5 2.6h-2.2L9.4 2.1a.4.4 0 0 1 .693-.4L11 3.5h2l.907-1.8a.4.4 0 0 1 .693.4z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-base font-semibold text-emerald-50">Floralog für Android</h2>
                {apkManifestForDownload ? (
                  <p className="mt-0.5 text-xs text-stone-400">
                    Version {apkManifestForDownload.version_name}
                    {apkManifestForDownload.release_notes ? ` · ${apkManifestForDownload.release_notes}` : ''}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-stone-500">APK-Download</p>
                )}
              </div>
              <div className="w-full rounded-2xl border border-stone-700/50 bg-black/25 p-3 text-xs text-stone-400 space-y-1.5">
                <p className="font-medium text-stone-300">Hinweis zur Installation</p>
                <p>Nach dem Download musst du in den Android-Einstellungen <span className="text-stone-200">&bdquo;Installation aus unbekannten Quellen&ldquo;</span> für deinen Browser einmalig erlauben.</p>
              </div>
              {apkManifestForDownload ? (
                <a
                  href={apkManifestForDownload.apk_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-700/90 via-emerald-600/80 to-emerald-700/90 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all shadow-[0_4px_18px_rgba(34,197,94,0.22)]"
                >
                  <Download className="w-4 h-4" />
                  APK herunterladen
                </a>
              ) : (
                <div className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl border border-stone-700/50 bg-stone-800/40 py-2.5 text-sm text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Lade Versionsinfo…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── iOS / PWA Modal ───────────────────────────────────────────── */}
      {iosModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" onClick={() => setIosModalOpen(false)} />
          <div
            className="relative z-10 w-full max-w-[92vw] sm:max-w-sm rounded-3xl border border-stone-600/30 bg-[linear-gradient(180deg,rgba(10,10,14,0.97)_0%,rgba(6,6,10,0.98)_100%)] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl border border-stone-500/10 pointer-events-none" />
            <button
              type="button"
              onClick={() => setIosModalOpen(false)}
              className="absolute top-3.5 right-3.5 z-20 text-stone-400 hover:text-stone-100 transition-colors"
              aria-label="Schließen"
            >
              ✕
            </button>
            <div className="relative z-10 flex flex-col gap-3.5 pt-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-500/30 bg-stone-800/50">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-stone-200" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-stone-50">Floralog für iPhone</h2>
                  <p className="text-xs text-stone-400">iOS-App</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-900/15 p-3 text-xs text-amber-200/85 leading-relaxed">
                <p className="font-semibold text-amber-100 mb-1">Warum gibt es keine iPhone-App im App Store?</p>
                <p>Die Veröffentlichung einer iOS-App setzt ein <span className="text-amber-50 font-medium">Apple Developer-Konto</span> voraus, das <span className="text-amber-50 font-medium">99 US-Dollar pro Jahr</span> kostet. Da Floralog ein Community-Projekt im Aufbau ist, wurde vorerst darauf verzichtet.</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-stone-200 mb-2.5">So richtest du Floralog trotzdem auf deinem iPhone ein:</p>
                <ol className="space-y-3">
                  {[
                    { step: "1", title: "Safari öffnen", desc: "Öffne floralog.de in Safari – nicht in Chrome oder Firefox, da nur Safari diese Funktion unterstützt." },
                    { step: "2", title: "Teilen antippen", desc: "Tippe auf das Teilen-Symbol (□ mit Pfeil nach oben) in der Mitte der Menüleiste unten." },
                    { step: "3", title: "\"Zum Home-Bildschirm\"", desc: "Scrolle im Teilen-Menü nach unten und tippe auf \"Zum Home-Bildschirm\"." },
                    { step: "4", title: "Namen bestätigen", desc: "Vergib einen Namen – z.\u202fB. \u201eFloralog\u201c – und tippe oben rechts auf \"Hinzufügen\"." },
                    { step: "5", title: "Fertig!", desc: "Das Floralog-Icon erscheint auf deinem Startbildschirm. Es öffnet sich wie eine App – ohne Browser-Leiste." },
                  ].map(({ step, title, desc }) => (
                    <li key={step} className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700/50 text-[0.65rem] font-bold text-emerald-200 mt-0.5">{step}</span>
                      <div>
                        <p className="text-xs font-semibold text-stone-200">{title}</p>
                        <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setIosModalOpen(false)}
                className="mt-1 w-full rounded-xl border border-stone-600/40 bg-stone-800/50 py-2.5 text-sm text-stone-300 hover:bg-stone-700/50 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
      {impressumModalOpen && (
        <div className="fixed inset-0 z-[155] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/82 backdrop-blur-[2px]" onClick={() => setImpressumModalOpen(false)} />
          <div
            className="relative z-10 w-full max-w-[92vw] sm:max-w-lg rounded-3xl border border-stone-200 bg-white text-stone-900 shadow-[0_28px_90px_rgba(0,0,0,0.65)] p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImpressumModalOpen(false)}
              className="absolute top-3.5 right-3.5 z-20 text-stone-500 hover:text-stone-900 transition-colors"
              aria-label="Schließen"
            >
              ✕
            </button>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 border border-stone-200">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">Impressum</h3>
              </div>

              <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
                <div>
                  <p className="font-semibold">Betreiber</p>
                  <p>
                    Floralog Collective<br />
                    Dorotheenstr. 41<br />
                    24939 Flensburg<br />
                    <br />
                    Eigentümer: Jascha Kruse
                  </p>
                </div>

                <div>
                  <p className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-green-600" />Kontakt</p>
                  <p>info@floralog.de</p>
                </div>

                <div>
                  <p className="font-semibold">Haftungsausschluss</p>
                  <p className="text-sm text-stone-600">Die Inhalte dieser App wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Floralog dient ausschließlich zu Bildungszwecken und ersetzt keine professionelle botanische Beratung.</p>
                </div>

                <div>
                  <p className="font-semibold">Datenschutz</p>
                  <p className="text-sm text-stone-600">Ausführliche Informationen zur Verarbeitung Ihrer Daten finden Sie in unserer <button onClick={() => window.location.href = '/Datenschutz'} className="text-blue-600 hover:underline font-semibold ml-1">Datenschutzerklärung</button>.</p>
                </div>
              </div>

              <div className="mt-4 text-sm text-stone-600 text-right">
                © Floralog Collective, {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

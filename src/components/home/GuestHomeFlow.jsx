import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const BACKGROUND_IMAGE_URL = new URL("../../../FunnelBackground.png", import.meta.url).href;
const FIREFLY_COUNT = 18;
const SHOW_DURATION_MS = 3200;
const SHOW_DURATION_S = SHOW_DURATION_MS / 1000;

/**
 * @param {number} index
 */
function useFirefly(index) {
  const [state, setState] = useState({
    visible: false,
    x: 50,
    y: 30,
    size: 10,
    driftX: 0,
    driftY: 0,
    glow: 1,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;

    const run = () => {
      if (!mountedRef.current) return;
      setState({
        visible: true,
        x: 14 + Math.random() * 66,
        y: 8 + Math.random() * 48,
        size: 8 + Math.random() * 10,
        driftX: -10 + Math.random() * 20,
        driftY: -18 - Math.random() * 20,
        glow: 0.85 + Math.random() * 0.9,
      });
      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, visible: false }));
        const nextDelay = 900 + Math.random() * 2200;
        timeoutId = setTimeout(run, nextDelay);
      }, SHOW_DURATION_MS);
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
  const { visible, x, y, size, driftX, driftY, glow } = useFirefly(index);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${x.toFixed(1)}-${y.toFixed(1)}`}
          initial={{ opacity: 0, scale: 0.25, x: 0, y: 0 }}
          animate={{
            opacity: [0, 0.9, 1, 0.75, 0],
            scale: [0.45, 1, 1.18, 0.9],
            x: [0, driftX * 0.45, driftX],
            y: [0, driftY * 0.55, driftY],
          }}
          transition={{ duration: SHOW_DURATION_S, ease: "easeInOut" }}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(255,251,170,1) 0%, rgba(255,229,98,0.95) 28%, rgba(255,196,45,0.5) 60%, transparent 100%)",
            boxShadow: `0 0 ${size * 1.6}px rgba(255,248,170,0.95), 0 0 ${size * 4.6}px rgba(255,215,72,${glow}), 0 0 ${size * 8}px rgba(255,184,28,0.38)`,
            filter: `blur(${Math.max(0.15, size * 0.025)}px)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}

export default function GuestHomeFlow() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Bottom gradient overlay for CTA readability */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "48%",
          background:
            "linear-gradient(to top, rgba(5,15,8,0.88) 0%, rgba(5,15,8,0.52) 45%, transparent 100%)",
        }}
      />

      {/* Firefly particles â€“ upper bright area of image */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {Array.from({ length: FIREFLY_COUNT }, (_, i) => (
          <FireflyParticle key={i} index={i} />
        ))}
      </div>

      {/* Title â€“ top */}
      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-10 md:pt-14 px-4">
        <h1
          className="font-bold uppercase text-center whitespace-nowrap"
          style={{
            width: "90vw",
            maxWidth: "90vw",
            fontSize: "clamp(2.1rem, 8.5vw, 5.5rem)",
            letterSpacing: "clamp(0.18em, 0.55vw, 0.36em)",
            lineHeight: 1,
            color: "transparent",
            backgroundImage:
              "linear-gradient(180deg, rgba(252,248,227,0.98) 0%, rgba(224,235,203,0.98) 34%, rgba(184,209,148,0.98) 68%, rgba(240,214,150,0.96) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextStroke: "2px rgba(245,223,160,0.78)",
            textShadow:
              "0 0 10px rgba(255,242,196,0.18), 0 2px 22px rgba(0,0,0,0.48), 0 0 36px rgba(209,182,88,0.14)",
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

      {/* CTA â€“ bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-12 md:pb-16 gap-5 px-4">
        {/* Scan button â€“ same visual as Home.jsx */}
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

        {/* Register â€“ prominent text link */}
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

        {/* Login â€“ subtle text link */}
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
      </div>
    </div>
  );
}

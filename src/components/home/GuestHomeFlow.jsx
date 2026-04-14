import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const BACKGROUND_IMAGE_URL = new URL("../../../FunnelBackground.png", import.meta.url).href;
const FIREFLY_COUNT = 18;
const SHOW_DURATION_MS = 1400;
const SHOW_DURATION_S = SHOW_DURATION_MS / 1000;

function useFirefly(index) {
  const [state, setState] = useState({ visible: false, x: 50, y: 30, size: 4 });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId;

    const run = () => {
      if (!mountedRef.current) return;
      setState({
        visible: true,
        x: 12 + Math.random() * 70,
        y: 8 + Math.random() * 50,
        size: 2.5 + Math.random() * 4,
      });
      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setState(prev => ({ ...prev, visible: false }));
        const nextDelay = 1600 + Math.random() * 2800;
        timeoutId = setTimeout(run, nextDelay);
      }, SHOW_DURATION_MS);
    };

    const initialDelay = index * 260 + Math.random() * 900;
    timeoutId = setTimeout(run, initialDelay);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [index]);

  return state;
}

function FireflyParticle({ index }) {
  const { visible, x, y, size } = useFirefly(index);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${x.toFixed(1)}-${y.toFixed(1)}`}
          initial={{ opacity: 0, scale: 0.15 }}
          animate={{ opacity: [0, 1, 0.85, 0] }}
          transition={{ duration: SHOW_DURATION_S, ease: "easeInOut" }}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(255,242,90,1) 0%, rgba(255,210,40,0.5) 50%, transparent 100%)",
            boxShadow: `0 0 ${size * 3}px rgba(255,220,50,0.95), 0 0 ${size * 6}px rgba(255,200,30,0.45)`,
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
          className="font-bold text-stone-50 uppercase drop-shadow-[0_2px_24px_rgba(0,0,0,0.65)]"
          style={{
            fontSize: "clamp(2.8rem, 11vw, 5.5rem)",
            letterSpacing: "0.36em",
          }}
        >
          FLORALOG
        </h1>
        <p
          className="text-amber-100/90 font-medium drop-shadow-[0_1px_10px_rgba(0,0,0,0.8)]"
          style={{
            fontSize: "clamp(0.85rem, 3vw, 1.05rem)",
            letterSpacing: "0.1em",
            marginTop: "0.35rem",
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

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";

const BUBBLE_SIZE = 52; // px diameter
const FLOAT_DURATION = 7; // seconds
const BURST_DURATION = 900; // ms

/**
 * A floating green "soap bubble" that spawns at a fixed viewport position and
 * drifts upward. Tapping the bubble triggers a pulse animation (the care
 * feedback) and calls onBurst.
 *
 * @param {{
 *   isActive: boolean,
 *   position: {x: number, y: number},
 *   onBurst: () => void,
 *   onDismiss: () => void,
 * }} props
 */
export default function GreenCareBubble({ isActive, position, onBurst, onDismiss }) {
  const { isLightUi } = useUiTheme();

  // "floating" → "bursting" → (onDismiss called)
  const [phase, setPhase] = useState("floating");
  const [burstCenter, setBurstCenter] = useState(/** @type {{x:number,y:number}|null} */ (null));

  const bubbleRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const dismissTimerRef = useRef(/** @type {number|null} */ (null));
  const phaseDoneRef = useRef(false);

  const scheduleDismiss = useCallback((delayMs) => {
    if (dismissTimerRef.current != null) {
      window.clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null;
      if (!phaseDoneRef.current) {
        phaseDoneRef.current = true;
        onDismiss?.();
      }
    }, delayMs);
  }, [onDismiss]);

  // Reset internal state when a new bubble is spawned (isActive goes true)
  useEffect(() => {
    if (!isActive) return;
    phaseDoneRef.current = false;
    setPhase("floating");
    setBurstCenter(null);

    // Auto-dismiss if player never taps (float completes)
    scheduleDismiss((FLOAT_DURATION + 0.5) * 1000);

    return () => {
      if (dismissTimerRef.current != null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleTap = useCallback(() => {
    if (phase !== "floating" || phaseDoneRef.current) return;

    const el = bubbleRef.current;
    const rect = el?.getBoundingClientRect?.();
    const cx = rect ? rect.left + rect.width / 2 : position.x;
    const cy = rect ? rect.top + rect.height / 2 : position.y;

    setBurstCenter({ x: cx, y: cy });
    setPhase("bursting");
    onBurst?.();
    scheduleDismiss(BURST_DURATION);
  }, [phase, position, onBurst, scheduleDismiss]);

  if (!isActive || typeof document === "undefined" || !document.body) return null;

  return createPortal(
    <>
      {/* ── Floating soap bubble ── */}
      <AnimatePresence>
        {phase === "floating" && (
          <motion.button
            ref={bubbleRef}
            type="button"
            aria-label="Pflege-Blase antippen"
            key="care-bubble-float"
            initial={{ opacity: 0, scale: 0.25 }}
            animate={{
              opacity: [0, 0.95, 0.9, 0.88, 0],
              scale: [0.25, 1, 0.98, 0.96, 0.88],
              y: [0, -55, -130, -220, -330],
              x: [0, 9, -7, 11, -5],
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{
              duration: FLOAT_DURATION,
              ease: "easeInOut",
              times: [0, 0.1, 0.38, 0.72, 1],
            }}
            onClick={handleTap}
            style={{
              position: "fixed",
              left: position.x - BUBBLE_SIZE / 2,
              top: position.y - BUBBLE_SIZE / 2,
              width: BUBBLE_SIZE,
              height: BUBBLE_SIZE,
              zIndex: 450,
              borderRadius: "50%",
              border: 0,
              padding: 0,
              background: "transparent",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            {/* Outer bubble shell */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: isLightUi
                  ? "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.72) 0%, rgba(134,239,172,0.32) 42%, rgba(74,222,128,0.14) 100%)"
                  : "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.55) 0%, rgba(134,239,172,0.22) 42%, rgba(52,211,153,0.09) 100%)",
                border: `1.5px solid ${isLightUi ? "rgba(134,239,172,0.65)" : "rgba(110,231,183,0.52)"}`,
                boxShadow: isLightUi
                  ? "0 0 10px rgba(134,239,172,0.55), inset 0 0 8px rgba(255,255,255,0.35)"
                  : "0 0 13px rgba(110,231,183,0.48), inset 0 0 8px rgba(255,255,255,0.18)",
              }}
            >
              {/* Specular highlight */}
              <div
                style={{
                  position: "absolute",
                  width: "30%",
                  height: "22%",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.82)",
                  top: "16%",
                  left: "20%",
                  filter: "blur(1.5px)",
                }}
              />
              {/* Secondary soft highlight */}
              <div
                style={{
                  position: "absolute",
                  width: "18%",
                  height: "13%",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.45)",
                  bottom: "22%",
                  right: "18%",
                  filter: "blur(2px)",
                }}
              />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Pulse burst animation (plays at bubble's last screen position) ── */}
      <AnimatePresence>
        {phase === "bursting" && burstCenter != null && (
          <motion.div
            key="care-bubble-burst"
            className="pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              left: burstCenter.x,
              top: burstCenter.y,
              width: 0,
              height: 0,
              zIndex: 451,
            }}
          >
            {/* Glow core */}
            <motion.div
              style={{
                position: "absolute",
                width: "7rem",
                height: "7rem",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                background: isLightUi
                  ? "radial-gradient(circle, rgba(163,230,53,0.44) 0%, rgba(163,230,53,0.22) 38%, rgba(163,230,53,0) 76%)"
                  : "radial-gradient(circle, rgba(190,242,100,0.56) 0%, rgba(190,242,100,0.28) 40%, rgba(190,242,100,0) 78%)",
                filter: "blur(10px)",
              }}
              initial={{ opacity: 0, scale: 0.78 }}
              animate={{ opacity: [0, 1, 0], scale: [0.78, 1.08, 1.28] }}
              transition={{ duration: 0.72, ease: "easeOut" }}
            />
            {/* Outer ring */}
            <motion.div
              style={{
                position: "absolute",
                width: "5rem",
                height: "5rem",
                borderRadius: "50%",
                border: `2px solid ${isLightUi ? "rgba(163,230,53,0.72)" : "rgba(190,242,100,0.66)"}`,
                transform: "translate(-50%, -50%)",
                boxShadow: isLightUi
                  ? "0 0 26px rgba(132,204,22,0.75), 0 0 52px rgba(163,230,53,0.45)"
                  : "0 0 32px rgba(190,242,100,0.9), 0 0 60px rgba(190,242,100,0.5)",
              }}
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: [0, 1, 0], scale: [0.82, 1.04, 1.15] }}
              transition={{ duration: 0.68, ease: "easeOut" }}
            />
            {/* Inner ring */}
            <motion.div
              style={{
                position: "absolute",
                width: "3rem",
                height: "3rem",
                borderRadius: "50%",
                border: `1px solid ${isLightUi ? "rgba(110,231,183,0.62)" : "rgba(110,231,183,0.56)"}`,
                transform: "translate(-50%, -50%)",
                boxShadow: isLightUi
                  ? "0 0 18px rgba(110,231,183,0.52)"
                  : "0 0 20px rgba(110,231,183,0.62)",
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.92, 1, 1.1] }}
              transition={{ duration: 0.64, ease: "easeOut", delay: 0.05 }}
            />
            {/* Burst sparkle dots */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i / 6) * Math.PI * 2;
              const tx = Math.cos(angle) * 38;
              const ty = Math.sin(angle) * 38;
              return (
                <motion.span
                  key={`burst-dot-${i}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: isLightUi ? "rgba(132,204,22,0.9)" : "rgba(190,242,100,0.9)",
                    transform: "translate(-50%, -50%)",
                  }}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], x: [0, tx], y: [0, ty], scale: [0.5, 1, 0.6] }}
                  transition={{ duration: 0.56, ease: "easeOut", delay: i * 0.03 }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

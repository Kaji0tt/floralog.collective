import { useEffect, useRef, useState } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function useDeviceTiltOffset({
  enabled = true,
  maxOffsetX = 24,
  maxOffsetY = 20,
  maxGamma = 22,
  maxBeta = 28,
  betaCenter = 35,
} = {}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef(/** @type {number | null} */ (null));
  const pendingRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      return undefined;
    }

    const flush = () => {
      frameRef.current = null;
      setOffset({ ...pendingRef.current });
    };

    const schedule = (nextX, nextY) => {
      pendingRef.current = { x: nextX, y: nextY };
      if (frameRef.current != null) return;
      frameRef.current = window.requestAnimationFrame(flush);
    };

    /** @param {DeviceOrientationEvent} event */
    const handleDeviceOrientation = (event) => {
      const normalizedX = clamp((event.gamma ?? 0) / Math.max(maxGamma, 1), -1, 1);
      const normalizedY = clamp(((event.beta ?? betaCenter) - betaCenter) / Math.max(maxBeta, 1), -1, 1);
      schedule(normalizedX * maxOffsetX, normalizedY * maxOffsetY);
    };

    /** @param {MouseEvent} event */
    const handleMouseMove = (event) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const normalizedX = clamp((event.clientX - centerX) / Math.max(centerX, 1), -1, 1);
      const normalizedY = clamp((event.clientY - centerY) / Math.max(centerY, 1), -1, 1);
      schedule(normalizedX * maxOffsetX, normalizedY * maxOffsetY);
    };

    window.addEventListener("deviceorientation", handleDeviceOrientation);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      window.removeEventListener("mousemove", handleMouseMove);
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [betaCenter, enabled, maxBeta, maxGamma, maxOffsetX, maxOffsetY]);

  return offset;
}

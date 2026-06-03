import { useUiTheme } from "@/lib/UiThemeContext";
import { useDeviceTiltOffset } from "@/lib/useDeviceTiltOffset";

export default function HomeBackgroundShell({
  user,
  getRgbaFromRgb,
  children,
  enableBackgroundMotion = false,
  foregroundImageUrl = null,
  enableForegroundMotion = true,
}) {
  const { isLightUi } = useUiTheme();
  const shouldTrackTilt = enableBackgroundMotion || (Boolean(foregroundImageUrl) && enableForegroundMotion);
  const tiltOffset = useDeviceTiltOffset({
    enabled: shouldTrackTilt,
    maxOffsetX: 24,
    maxOffsetY: 20,
    maxGamma: 22,
    maxBeta: 28,
    betaCenter: 35,
  });

  const baseBackgroundStyle = user?.background_image_url ? {
    backgroundImage: `url(${user.background_image_url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } : user?.background_color ? {
    background: `linear-gradient(160deg, ${getRgbaFromRgb(user.background_color, 1)} 0%, ${getRgbaFromRgb(user.background_color, 0.55)} 100%)`,
  } : {
    background: isLightUi
      ? "radial-gradient(circle at top, rgb(255, 248, 220) 0%, rgb(244, 231, 187) 52%, rgb(236, 217, 156) 100%)"
      : "radial-gradient(circle at top, rgb(223, 224, 127) 0%, rgb(67, 146, 96) 60%, rgb(53, 90, 68) 100%)",
  };

  const movingBackgroundStyle = enableBackgroundMotion
    ? {
        ...baseBackgroundStyle,
        transform: `translate3d(${(tiltOffset.x * 0.18).toFixed(2)}px, ${(tiltOffset.y * 0.18).toFixed(2)}px, 0) scale(1.08)`,
        willChange: "transform",
      }
    : baseBackgroundStyle;

  const foregroundStyle = foregroundImageUrl
    ? {
        backgroundImage: `url(${foregroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transform: enableForegroundMotion
          ? `translate3d(${(tiltOffset.x * 0.68).toFixed(2)}px, ${(tiltOffset.y * 0.68).toFixed(2)}px, 0) scale(1.14)`
          : undefined,
        willChange: enableForegroundMotion ? "transform" : "auto",
      }
    : null;

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0" style={movingBackgroundStyle} />
      <div className={`absolute inset-0 backdrop-blur-3xl ${isLightUi ? "bg-white/15" : ""}`} />

      <div className="relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center">
        {children}
      </div>

      {foregroundStyle && (
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          style={foregroundStyle}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

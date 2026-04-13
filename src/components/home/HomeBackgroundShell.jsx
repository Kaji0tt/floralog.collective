import { useUiTheme } from "@/lib/UiThemeContext";

const DEFAULT_DARK_BACKGROUND =
  "radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)";

const GUEST_BACKGROUND =
  "linear-gradient(180deg, rgb(252, 241, 179) 0%, rgb(246, 225, 146) 22%, rgb(205, 224, 136) 58%, rgb(97, 151, 88) 100%)";

export default function HomeBackgroundShell({ user, getRgbaFromRgb, children, backgroundVariant = "default" }) {
  const { isLightUi } = useUiTheme();
  const backgroundStyle = user?.background_image_url ? {
    backgroundImage: `url(${user.background_image_url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } : user?.background_color ? {
    background: `linear-gradient(160deg, ${getRgbaFromRgb(user.background_color, 1)} 0%, ${getRgbaFromRgb(user.background_color, 0.55)} 100%)`,
  } : {
    background: isLightUi
      ? "radial-gradient(circle at top, rgb(255, 248, 220) 0%, rgb(244, 231, 187) 52%, rgb(236, 217, 156) 100%)"
      : backgroundVariant === "guest"
        ? GUEST_BACKGROUND
        : DEFAULT_DARK_BACKGROUND,
  };

  const overlayClass = isLightUi
    ? "backdrop-blur-[2px] bg-white/20"
    : backgroundVariant === "guest"
      ? "backdrop-blur-[14px] bg-white/8"
      : "backdrop-blur-3xl";

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0" style={backgroundStyle} />
      <div className={`absolute inset-0 ${overlayClass}`} />

      <div className="relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center">
        {children}
      </div>
    </div>
  );
}

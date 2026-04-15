import { useUiTheme } from "@/lib/UiThemeContext";

export default function HomeBackgroundShell({ user, getRgbaFromRgb, children }) {
  const { isLightUi } = useUiTheme();
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={user?.background_image_url ? {
          backgroundImage: `url(${user.background_image_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : user?.background_color ? {
          background: `linear-gradient(160deg, ${getRgbaFromRgb(user.background_color, 1)} 0%, ${getRgbaFromRgb(user.background_color, 0.55)} 100%)`,
        } : {
          background: isLightUi
            ? "radial-gradient(circle at top, rgb(255, 248, 220) 0%, rgb(244, 231, 187) 52%, rgb(236, 217, 156) 100%)"
            : "radial-gradient(circle at top, rgb(223, 224, 127) 0%, rgb(67, 146, 96) 60%, rgb(53, 90, 68) 100%)",
        }}
      />
      <div className={`absolute inset-0 backdrop-blur-3xl ${isLightUi ? "bg-white/15" : ""}`} />

      <div className="relative z-10 h-full w-full p-3 md:p-6 flex items-start justify-center">
        {children}
      </div>
    </div>
  );
}

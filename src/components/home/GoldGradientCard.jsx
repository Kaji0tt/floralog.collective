import { useUiTheme } from "@/lib/UiThemeContext";

/**
 * Shared "glass + gold gradient border" container used by the redesigned Home containers
 * (profile badges panel, reward card wrapper, active-tasks banner).
 */
export default function GoldGradientCard({
  as: Component = "div",
  className = "",
  contentClassName = "",
  borderClassName = "",
  children,
  ...rest
}) {
  const { isLightUi } = useUiTheme();

  return (
    <Component
      className={`relative rounded-3xl bg-gradient-to-br p-[1.5px] shadow-[0_12px_30px_rgba(0,0,0,0.35)] ${
        isLightUi
          ? "from-[#e8d9a8] via-[#c8ac62] to-[#8f6b22]/70"
          : "from-[#f0e5a5] via-[#c8ac62]/85 to-[#8f6b22]"
      } ${borderClassName} ${className}`}
      {...rest}
    >
      <div
        className={`h-full w-full rounded-[calc(1.5rem-1.5px)] backdrop-blur-xl ${
          isLightUi ? "bg-white/70 text-stone-800" : "bg-black/55 text-stone-100"
        } ${contentClassName}`}
      >
        {children}
      </div>
    </Component>
  );
}

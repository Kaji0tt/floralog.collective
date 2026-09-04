import { useUiTheme } from "@/lib/UiThemeContext";

/**
 * Shared "glass + gold gradient border" container used by the redesigned Home containers
 * (profile badges panel, reward card wrapper, active-tasks banner). The gold border is a
 * ring-only mask overlay (see `.gold-gradient-border-mask` in index.css) layered on top, so the
 * content div underneath keeps its own normal background - no gradient bleed-through is possible.
 */
export default function GoldGradientCard({
  as: Component = "div",
  className = "",
  contentClassName = "",
  borderClassName = "",
  blur = false,
  rounded = "3xl",
  shadow = true,
  children,
  ...rest
}) {
  const { isLightUi } = useUiTheme();
  // Literal strings (not interpolated) so Tailwind's JIT scanner picks up both variants.
  const roundedClass = rounded === "full" ? "rounded-full" : "rounded-3xl";
  // Large soft shadows bleed onto adjacent siblings (e.g. a scrollable list right below a card in
  // normal flow) and can look like the sibling content is fading out prematurely - opt-out via shadow={false}.
  const shadowClass = shadow ? "shadow-[0_12px_30px_rgba(0,0,0,0.45)]" : "";

  const borderGradient = isLightUi
    ? "linear-gradient(to bottom right, #e8d9a8, #c8ac62, rgba(143,107,34,0.7))"
    : "linear-gradient(to bottom right, #f0e5a5, rgba(200,172,98,0.85), #8f6b22)";

  return (
    <Component
      className={`relative ${roundedClass} ${shadowClass} ${className}`}
      {...rest}
    >
      {blur && (
        // Dedicated blur layer, kept between content and the border-mask sibling below
        // (never directly adjacent to a mask-composite element - avoids the iOS compositing bug).
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${roundedClass} backdrop-blur-xl ${
            isLightUi ? "bg-white/45" : "bg-black/35"
          }`}
        />
      )}
      <div
        className={`relative h-full w-full ${roundedClass} ${
          blur
            ? isLightUi
              ? "text-stone-800"
              : "text-stone-100"
            : isLightUi
              ? "bg-white/70 text-stone-800"
              : "bg-black/25 text-stone-100"
        } ${contentClassName}`}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`gold-gradient-border-mask ${borderClassName}`}
        style={{ background: borderGradient }}
      />
    </Component>
  );
}

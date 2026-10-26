import { motion } from "framer-motion";
import HomeBackgroundShell from "./HomeBackgroundShell";
import { useUiTheme } from "@/lib/UiThemeContext";

export function HomeScreenLayout({ user, getRgbaFromRgb = undefined, activePanel = null, children }) {
  const { isLightUi } = useUiTheme();
  return (
    <HomeBackgroundShell user={user} getRgbaFromRgb={getRgbaFromRgb} edgeToEdge={activePanel === "collection"}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        data-ui="home-main-content-shell"
        className={`relative h-full w-full ${activePanel === null ? "overflow-visible" : "overflow-hidden"}`}
      >
        <div className={`relative z-10 h-full flex flex-col ${activePanel === "map" ? "px-0 py-0" : "px-2 md:px-4"} ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>
          {children}
        </div>
      </motion.div>
    </HomeBackgroundShell>
  );
}

export function HomeHeroHeading({ children, titleRef = null }) {
  return (
    <div ref={titleRef} className="pointer-events-none absolute inset-x-4 top-4 z-20 flex max-w-[65%] flex-col md:inset-x-8 md:top-6">
      {children}
    </div>
  );
}

export function HomeHeroSection({ children }) {
  return (
    <section data-ui="home-plant-hero-section" className="relative flex-1 min-h-0 rounded-3xl px-[clamp(0.25rem,1vw,0.75rem)] pt-[clamp(0.1rem,0vh,0.5rem)] pb-[clamp(0.12rem,0.35vh,0.28rem)] flex flex-col gap-2 bg-transparent">
      {children}
    </section>
  );
}

export function HomeBottomArea({ children, activePanel = null }) {
  return (
    <div className={`${activePanel === null ? "pt-0" : "pt-[clamp(0.35rem,0.9vh,0.7rem)]"} pb-[clamp(0.15rem,0.5vh,0.35rem)] flex shrink-0 flex-col`}>
      {children}
    </div>
  );
}

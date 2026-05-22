import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";
import FlorabotLogo from "./FlorabotLogo";
import { buildStoryProfileVariables, resolveIntroSlidesWithVariables } from "@/lib/story/storyDefinition";

/**
 * Full-screen Florabot introduction overlay shown once after the user's first login.
 *
 * @param {{ profile?: object, onDismiss: () => void }} props
 */
export default function FlorabotIntroOverlay({ profile, onDismiss }) {
  const { isLightUi } = useUiTheme();
  const [slideIndex, setSlideIndex] = useState(0);

  const introSlides = useMemo(() => {
    return resolveIntroSlidesWithVariables(buildStoryProfileVariables(profile));
  }, [profile]);

  if (introSlides.length === 0) return null;

  const isLast = slideIndex === introSlides.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDismiss();
    } else {
      setSlideIndex((i) => i + 1);
    }
  };

  const currentSlide = introSlides[slideIndex];

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        background: isLightUi
          ? "rgba(245,240,230,0.82)"
          : "rgba(10,14,10,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Logo */}
      <motion.div
        key="intro-logo"
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
      >
        <FlorabotLogo
          profile={profile}
          sizeClass="w-32 h-32"
          padding="p-[8%]"
          className="drop-shadow-[0_0_32px_rgba(190,242,100,0.55)]"
        />
      </motion.div>

      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slideIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className="mt-8 w-full max-w-[340px]"
        >
          {/* Triangle pointer */}
          <div className="flex justify-center mb-[-1px]">
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderBottom: isLightUi
                  ? "10px solid rgba(200,195,185,0.55)"
                  : "10px solid rgba(255,255,255,0.10)",
              }}
            />
          </div>
          <div
            className={`rounded-2xl px-5 py-4 border ${
              isLightUi
                ? "bg-white/70 border-stone-200/60"
                : "bg-white/8 border-white/10"
            }`}
          >
            <p
              className={`font-semibold text-base leading-snug ${
                isLightUi ? "text-stone-800" : "text-stone-100"
              }`}
            >
              {currentSlide.title}
            </p>
            <p
              className={`mt-2 text-sm leading-relaxed ${
                isLightUi ? "text-stone-600" : "text-stone-300"
              }`}
            >
              {currentSlide.body}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="flex gap-2 mt-6">
        {introSlides.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === slideIndex
                ? "w-5 h-2 bg-lime-400"
                : isLightUi
                ? "w-2 h-2 bg-stone-400/50"
                : "w-2 h-2 bg-stone-500/50"
            }`}
          />
        ))}
      </div>

      {/* CTA button */}
      <motion.button
        type="button"
        onClick={handleNext}
        className={`mt-6 rounded-2xl px-8 py-3 text-sm font-semibold transition-colors ${
          isLightUi
            ? "bg-lime-600 text-white hover:bg-lime-700"
            : "bg-lime-500/85 text-black hover:bg-lime-400"
        }`}
        whileTap={{ scale: 0.96 }}
      >
        {isLast ? "Los geht's!" : "Weiter"}
      </motion.button>

      {/* Skip */}
      <button
        type="button"
        onClick={onDismiss}
        className={`mt-3 text-xs transition-colors ${
          isLightUi
            ? "text-stone-400 hover:text-stone-600"
            : "text-stone-600 hover:text-stone-400"
        }`}
      >
        Überspringen
      </button>
    </motion.div>
  );
}

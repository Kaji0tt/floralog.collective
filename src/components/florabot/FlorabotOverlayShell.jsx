import { motion } from "framer-motion";
import { useUiTheme } from "@/lib/UiThemeContext";
import FlorabotLogo from "./FlorabotLogo";

export default function FlorabotOverlayShell({
  title,
  titleSubline,
  titleSublineClassName,
  titleBadge,
  eyebrow,
  eyebrowClassName,
  profile,
  logoAssets = [],
  showLogo = true,
  logoSizeClass = "w-28 h-28",
  logoPadding = "p-[8%]",
  logoClassName,
  dockContentBottom = false,
  overlayClassName,
  dockContainerClassName,
  contentSectionClassName,
  footerSectionClassName,
  children,
  footer,
}) {
  const { isLightUi } = useUiTheme();

  const defaultLogoClassName = "drop-shadow-[0_0_28px_rgba(190,242,100,0.5)]";
  const titleNode = title ? (
    <motion.h2
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.28 }}
      className={`w-full px-6 text-center text-xl font-semibold tracking-wide leading-tight ${
        isLightUi ? "text-stone-800" : "text-stone-100"
      }`}
    >
      {title}
    </motion.h2>
  ) : null;

  const titleSublineNode = titleSubline ? (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.28 }}
      className={`w-full px-6 text-center text-[0.78rem] font-medium ${isLightUi ? "text-stone-700" : "text-stone-100"} ${titleSublineClassName || ""}`}
    >
      {titleSubline}
    </motion.div>
  ) : null;

  const titleBadgeNode = titleBadge ? (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.28 }}
      className="w-full flex justify-center px-6"
    >
      {titleBadge}
    </motion.div>
  ) : null;

  const eyebrowNode = eyebrow ? (
    <motion.p
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
      className={`w-full px-6 text-center text-[0.68rem] uppercase tracking-[0.22em] font-medium ${
        isLightUi ? "text-lime-700" : "text-lime-400"
      } ${eyebrowClassName || ""}`}
    >
      {eyebrow}
    </motion.p>
  ) : null;

  const logoNode = (
    <motion.div
      initial={{ scale: 0.82, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
    >
      <FlorabotLogo
        profile={profile}
        logoAssets={logoAssets}
        sizeClass={logoSizeClass}
        padding={logoPadding}
        className={logoClassName || defaultLogoClassName}
      />
    </motion.div>
  );

  return (
    <motion.div
      className={`fixed inset-0 z-[190] flex flex-col items-center justify-center ${overlayClassName || ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        background: isLightUi ? "rgba(245,240,230,0.82)" : "rgba(10,14,10,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {dockContentBottom ? (
        <div className={`flex h-full w-full flex-col items-center py-4 ${dockContainerClassName || ""}`}>
          <div className="basis-[20%] grow-0 shrink-0 min-h-0 w-full flex items-center justify-center">
            <div className="w-full max-w-full flex flex-col items-center justify-center gap-1">
              {titleNode}
              {titleSublineNode}
            </div>
          </div>

          <div className={`basis-[40%] grow-0 shrink-0 min-h-0 w-full flex flex-col items-center justify-center ${contentSectionClassName || ""}`}>
            {titleBadgeNode ? <div className="mb-2">{titleBadgeNode}</div> : null}
            {eyebrowNode ? <div className="mb-3">{eyebrowNode}</div> : null}
            {showLogo ? logoNode : null}
            {children}
          </div>

          <div className={`basis-[40%] grow-0 shrink-0 min-h-0 w-full flex flex-col items-center justify-end pb-1 ${footerSectionClassName || ""}`}>
            {footer}
          </div>
        </div>
      ) : (
        <>
          {titleNode ? <div className="mb-3">{titleNode}</div> : null}
          {titleBadgeNode ? <div className="mb-3">{titleBadgeNode}</div> : null}
          {eyebrowNode ? <div className="mb-4">{eyebrowNode}</div> : null}
          {showLogo ? logoNode : null}
          {children}
          {footer}
        </>
      )}
    </motion.div>
  );
}

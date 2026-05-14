"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A tooltip that works correctly on mobile touch devices.
 *
 * On touch: tapping opens the tooltip; tapping anywhere else closes it.
 * On desktop: standard Radix hover behaviour is preserved.
 *
 * Props:
 *  - content  – React nodes rendered inside the tooltip (tooltip is skipped when falsy)
 *  - children – single trigger element (e.g. a <button>)
 */
const LockedTooltip = ({ children, content, unstyled = false, contentClassName = "" }) => {
  const [open, setOpen] = React.useState(false);
  // True while the tooltip is being kept open via a touch interaction.
  const isTouchOpen = React.useRef(false);

  // When the tooltip is open in touch-mode, listen for the next touchstart
  // outside the trigger to close it again.
  React.useEffect(() => {
    if (!open || !isTouchOpen.current) return;

    const close = () => {
      isTouchOpen.current = false;
      setOpen(false);
    };

    // Defer adding the listener until the next task so that the touchstart
    // event that just triggered the open is not immediately processed by this
    // listener (addEventListener only catches future events, but using
    // setTimeout(0) ensures the current event loop cycle has fully unwound).
    const timerId = setTimeout(() => {
      document.addEventListener("touchstart", close, { once: true });
    }, 0);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  // Intercept openChange requests from Radix so that hover-based close events
  // (pointerleave, etc.) do not dismiss a touch-opened tooltip.
  const handleOpenChange = (next) => {
    if (isTouchOpen.current && !next) {
      // Radix wants to close, but we are in touch mode – ignore.
      return;
    }
    setOpen(next);
  };

  const child = React.Children.only(children);

  // If there is no content to show, skip the tooltip entirely.
  // All hooks above have already been called unconditionally.
  if (!content) {
    return child;
  }

  // Add a pointerdown handler to the trigger so we can detect touch input
  // before Radix processes any pointer events.
  // The original onPointerDown handler (if any) is still called first.
  const enhancedChild = React.cloneElement(child, {
    onPointerDown: (e) => {
      child.props.onPointerDown?.(e);
      if (e.pointerType === "touch") {
        isTouchOpen.current = true;
        setOpen(true);
      }
    },
  });

  const renderedContent = unstyled ? content : (
    <div className={`rounded-2xl border backdrop-blur-sm p-3.5 shadow-xl border-amber-400/60 bg-white/88 text-stone-800 dark:border-amber-300/40 dark:bg-black/75 dark:text-white/90 ${contentClassName}`}>
      {content}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>{enhancedChild}</TooltipTrigger>
        <TooltipContent
          className="max-w-xs whitespace-normal break-words border-0 bg-transparent p-0 shadow-none"
          collisionPadding={8}
        >
          {renderedContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export { LockedTooltip };

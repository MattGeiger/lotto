"use client";

import * as React from "react";
import {
  motion,
  useAnimation,
  useReducedMotion,
  type HTMLMotionProps,
  type Transition,
} from "motion/react";

import { cn } from "@/lib/utils";

type AdminAnimatedIconProps = Omit<HTMLMotionProps<"span">, "children" | "animate"> & {
  children: React.ReactNode;
};

const ENTRY_TRANSITION: Transition = {
  duration: 0.34,
  ease: [0.4, 0, 0.2, 1],
};

function AdminAnimatedIcon({ children, className, onMouseEnter, onPointerDown, onClick, ...props }: AdminAnimatedIconProps) {
  const controls = useAnimation();
  const prefersReducedMotion = useReducedMotion();

  const animateIcon = React.useCallback(() => {
    if (prefersReducedMotion) return;
    void controls.start({
      scale: [1, 1.08, 0.96, 1],
      y: [0, -1, 0],
      transition: ENTRY_TRANSITION,
    });
  }, [controls, prefersReducedMotion]);

  React.useEffect(() => {
    animateIcon();
  }, [animateIcon]);

  const handleMouseEnter = (event: React.MouseEvent<HTMLSpanElement>) => {
    animateIcon();
    onMouseEnter?.(event);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    animateIcon();
    onPointerDown?.(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    animateIcon();
    onClick?.(event);
  };

  return (
    <motion.span
      className={cn("inline-flex items-center justify-center", className)}
      onMouseEnter={handleMouseEnter}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      animate={controls}
      {...props}
    >
      {children}
    </motion.span>
  );
}

export { AdminAnimatedIcon };

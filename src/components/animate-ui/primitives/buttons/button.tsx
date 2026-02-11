'use client';

import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

import { cn } from "@/lib/utils";
import { Slot } from "@/components/animate-ui/primitives/animate/slot";

type MotionButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
  hoverScale?: number;
  tapScale?: number;
  disableScaleAnimation?: boolean;
  whileHover?: HTMLMotionProps<"button">["whileHover"];
  whileTap?: HTMLMotionProps<"button">["whileTap"];
  transition?: HTMLMotionProps<"button">["transition"];
};

const Button = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      asChild = false,
      className,
      hoverScale = 1.05,
      tapScale = 0.95,
      disableScaleAnimation = false,
      whileHover,
      whileTap,
      transition,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion();
    const shouldAnimate = !disableScaleAnimation && !prefersReducedMotion && !disabled;
    const Component = asChild ? Slot : motion.button;
    const motionProps = props as unknown as Omit<HTMLMotionProps<"button">, "ref" | "className">;

    return (
      <Component
        ref={ref as never}
        className={cn(className)}
        disabled={disabled}
        whileHover={shouldAnimate ? (whileHover ?? { scale: hoverScale }) : undefined}
        whileTap={shouldAnimate ? (whileTap ?? { scale: tapScale }) : undefined}
        transition={transition ?? { duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
        {...motionProps}
      >
        {children}
      </Component>
    );
  },
);

Button.displayName = "AnimateUIButton";

export { Button };

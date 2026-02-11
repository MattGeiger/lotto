'use client';

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

import { cn } from "@/lib/utils";

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
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    const prefersReducedMotion = useReducedMotion();
    const shouldAnimate = !disableScaleAnimation && !prefersReducedMotion && !disabled;
    const motionProps = props as unknown as Omit<HTMLMotionProps<"button">, "ref">;

    return (
      <motion.button
        ref={ref}
        className={cn(className)}
        disabled={disabled}
        whileHover={shouldAnimate ? (whileHover ?? { scale: hoverScale }) : undefined}
        whileTap={shouldAnimate ? (whileTap ?? { scale: tapScale }) : undefined}
        transition={transition ?? { duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
        {...motionProps}
      >
        {children}
      </motion.button>
    );
  },
);

Button.displayName = "AnimateUIButton";

export { Button };

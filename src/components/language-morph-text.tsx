"use client";

import { MorphingText, type MorphingTextProps } from "@/components/animate-ui/primitives/texts/morphing";
import { cn } from "@/lib/utils";

type LanguageMorphTextProps = Omit<MorphingTextProps, "text"> & {
  text: string;
};

const DEFAULT_TRANSITION = {
  type: "spring",
  stiffness: 90,
  damping: 16,
  mass: 0.4,
} as const;

export function LanguageMorphText({
  text,
  className,
  characterStagger = 0.04,
  wordWrap = "word",
  initial = { opacity: 0, y: 14, filter: "blur(4px)" },
  animate = { opacity: 1, y: 0, filter: "blur(0px)" },
  exit = { opacity: 0, y: -10, filter: "blur(4px)" },
  transition = DEFAULT_TRANSITION,
  ...props
}: LanguageMorphTextProps) {
  return (
    <MorphingText
      text={text}
      className={cn("inline-block overflow-visible align-baseline", className)}
      characterStagger={characterStagger}
      wordWrap={wordWrap}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      {...props}
    />
  );
}

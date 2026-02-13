"use client";

import * as React from "react";
import { flushSync } from "react-dom";

export type ThemeSelection = "light" | "dark" | "system";
export type ResolvedThemeSelection = "light" | "dark";
export type ThemeTogglerDirection = "btt" | "ttb" | "ltr" | "rtl";

type ThemeTogglerRenderState = {
  resolved: ResolvedThemeSelection;
  effective: ThemeSelection;
  toggleTheme: (theme: ThemeSelection) => Promise<void>;
};

type ThemeTogglerChildren =
  | React.ReactNode
  | ((state: ThemeTogglerRenderState) => React.ReactNode);

type ViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
};

type StartViewTransition = (
  callback: () => void | Promise<void>,
) => ViewTransition;

type DocumentWithViewTransition = Document & {
  startViewTransition?: StartViewTransition;
};

export type ThemeTogglerProps = {
  theme: ThemeSelection;
  resolvedTheme: ResolvedThemeSelection;
  setTheme: (theme: ThemeSelection) => void;
  direction?: ThemeTogglerDirection;
  onImmediateChange?: (theme: ThemeSelection) => void;
  children?: ThemeTogglerChildren;
};

function getSystemResolvedTheme(): ResolvedThemeSelection {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getClipKeyframes(direction: ThemeTogglerDirection): [string, string] {
  switch (direction) {
    case "ltr":
      return ["inset(0 100% 0 0)", "inset(0 0 0 0)"];
    case "rtl":
      return ["inset(0 0 0 100%)", "inset(0 0 0 0)"];
    case "ttb":
      return ["inset(0 0 100% 0)", "inset(0 0 0 0)"];
    case "btt":
      return ["inset(100% 0 0 0)", "inset(0 0 0 0)"];
    default:
      return ["inset(0 100% 0 0)", "inset(0 0 0 0)"];
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ThemeToggler({
  theme,
  resolvedTheme,
  setTheme,
  direction = "ltr",
  onImmediateChange,
  children,
}: ThemeTogglerProps) {
  const [preview, setPreview] = React.useState<{
    effective: ThemeSelection;
    resolved: ResolvedThemeSelection;
  } | null>(null);
  const [current, setCurrent] = React.useState<{
    effective: ThemeSelection;
    resolved: ResolvedThemeSelection;
  }>({
    effective: theme,
    resolved: resolvedTheme,
  });

  React.useEffect(() => {
    if (preview) {
      if (theme === preview.effective && resolvedTheme === preview.resolved) {
        setPreview(null);
        setCurrent({ effective: theme, resolved: resolvedTheme });
      }
      return;
    }
    setCurrent({ effective: theme, resolved: resolvedTheme });
  }, [theme, resolvedTheme, preview]);

  const [fromClip, toClip] = React.useMemo(
    () => getClipKeyframes(direction),
    [direction],
  );

  const toggleTheme = React.useCallback(
    async (nextTheme: ThemeSelection) => {
      const resolved =
        nextTheme === "system" ? getSystemResolvedTheme() : nextTheme;

      setCurrent({ effective: nextTheme, resolved });
      onImmediateChange?.(nextTheme);

      if (nextTheme === "system" && resolved === resolvedTheme) {
        setTheme(nextTheme);
        return;
      }

      const documentWithViewTransition =
        document as DocumentWithViewTransition;

      if (
        prefersReducedMotion() ||
        !documentWithViewTransition.startViewTransition
      ) {
        flushSync(() => {
          setPreview({ effective: nextTheme, resolved });
        });
        setTheme(nextTheme);
        return;
      }

      try {
        const transition = documentWithViewTransition.startViewTransition(() => {
          flushSync(() => {
            setPreview({ effective: nextTheme, resolved });
            document.documentElement.classList.toggle(
              "dark",
              resolved === "dark",
            );
          });
        });

        await transition.ready;

        try {
          const animation = document.documentElement.animate(
            { clipPath: [fromClip, toClip] },
            {
              duration: 700,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            },
          );
          await animation.finished;
        } catch {
          // If pseudo-element animation fails, still persist the new theme.
        }
      } catch {
        flushSync(() => {
          setPreview({ effective: nextTheme, resolved });
        });
      }

      setTheme(nextTheme);
    },
    [fromClip, onImmediateChange, resolvedTheme, setTheme, toClip],
  );

  return (
    <>
      {typeof children === "function"
        ? children({
            effective: current.effective,
            resolved: current.resolved,
            toggleTheme,
          })
        : children}
      <style>{`::view-transition-old(root), ::view-transition-new(root){animation:none;mix-blend-mode:normal;}`}</style>
    </>
  );
}

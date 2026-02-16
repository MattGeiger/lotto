"use client";

import * as React from "react";

import { useTheme } from "next-themes";

import { Button } from "@/arcade/ui/8bit";
import { useContrastMode } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type ArcadeModeSwitcherProps = {
  className?: string;
};

export function ArcadeModeSwitcher({ className }: ArcadeModeSwitcherProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { contrastMode, setContrastMode } = useContrastMode();

  React.useEffect(() => {
    if (contrastMode === "hi-viz") {
      setContrastMode("default");
    }
  }, [contrastMode, setContrastMode]);

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      font="normal"
      className="h-9 w-9 p-0 text-[var(--arcade-dot)] hover:text-[var(--arcade-neon)]"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 256 256"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("size-6 [html.dark_&]:block [html.light_&]:hidden", className)}
        aria-hidden="true"
      >
        <rect x="120" y="88" width="14" height="14" rx="1" />
        <rect x="104" y="88" width="14" height="14" rx="1" />
        <rect x="88" y="104" width="14" height="14" rx="1" />
        <rect x="88" y="120" width="14" height="14" rx="1" />
        <rect x="88" y="136" width="14" height="14" rx="1" />
        <rect x="136" y="88" width="14" height="14" rx="1" />
        <rect x="120" y="152" width="14" height="14" rx="1" />
        <rect x="104" y="152" width="14" height="14" rx="1" />
        <rect x="136" y="152" width="14" height="14" rx="1" />
        <rect x="152" y="104" width="14" height="14" rx="1" />
        <rect x="120" y="56" width="14" height="14" rx="1" />
        <rect x="56" y="120" width="14" height="14" rx="1" />
        <rect x="120" y="184" width="14" height="14" rx="1" />
        <rect x="184" y="120" width="14" height="14" rx="1" />
      </svg>
      <svg
        width="24"
        height="24"
        viewBox="0 0 256 256"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("size-6 [html.light_&]:block [html.dark_&]:hidden", className)}
        aria-hidden="true"
      >
        <rect x="104" y="56" width="14" height="14" rx="1" />
        <rect x="88" y="56" width="14" height="14" rx="1" />
        <rect x="72" y="72" width="14" height="14" rx="1" />
        <rect x="88" y="72" width="14" height="14" rx="1" />
        <rect x="88" y="88" width="14" height="14" rx="1" />
        <rect x="72" y="88" width="14" height="14" rx="1" />
        <rect x="56" y="104" width="14" height="14" rx="1" />
        <rect x="88" y="104" width="14" height="14" rx="1" />
        <rect x="72" y="104" width="14" height="14" rx="1" />
        <rect x="56" y="136" width="14" height="14" rx="1" />
        <rect x="88" y="136" width="14" height="14" rx="1" />
        <rect x="72" y="136" width="14" height="14" rx="1" />
        <rect x="56" y="120" width="14" height="14" rx="1" />
        <rect x="88" y="120" width="14" height="14" rx="1" />
        <rect x="104" y="120" width="14" height="14" rx="1" />
        <rect x="72" y="120" width="14" height="14" rx="1" />
        <rect x="104" y="136" width="14" height="14" rx="1" />
        <rect x="72" y="152" width="14" height="14" rx="1" />
        <rect x="104" y="152" width="14" height="14" rx="1" />
        <rect x="120" y="136" width="14" height="14" rx="1" />
        <rect x="88" y="152" width="14" height="14" rx="1" />
        <rect x="120" y="152" width="14" height="14" rx="1" />
        <rect x="104" y="168" width="14" height="14" rx="1" />
        <rect x="120" y="168" width="14" height="14" rx="1" />
        <rect x="136" y="168" width="14" height="14" rx="1" />
      </svg>
      <span className="sr-only">Toggle light and dark mode</span>
    </Button>
  );
}
